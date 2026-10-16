// Phase 7 : appel et absences, notifications SMS, activation et espace parent,
// suivi de l'élève, USSD, règles garanties par la base.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  app,
  avecJeton,
  chargerReferentiel,
  connecter,
  creerCompte,
  creerEcole,
  creerEleve,
  prisma,
} from './aide.js';
import { remplacerFournisseurSms } from '../../src/contexts/notifications/fournisseursSms.js';
import {
  declencherEnvoi,
  envoyerEnAttente,
} from '../../src/contexts/notifications/serviceNotifications.js';
import { repondreUssd } from '../../src/contexts/ussd/serviceUssd.js';

const ctx = {};
const client = (jeton) => ({
  get: (url) => request(app).get(url).set(avecJeton(jeton)),
  post: (url, corps) => request(app).post(url).set(avecJeton(jeton)).send(corps),
  put: (url, corps) => request(app).put(url).set(avecJeton(jeton)).send(corps),
  patch: (url, corps) => request(app).patch(url).set(avecJeton(jeton)).send(corps),
});
const telephoneUnique = () => `+22901${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
const aujourdhui = new Date().toISOString().slice(0, 10);

// Fournisseur SMS de test : garde les messages envoyés
const envoyes = [];
let enPanne = false;

beforeAll(async () => {
  remplacerFournisseurSms({
    nom: 'test',
    async envoyer({ telephone, message }) {
      if (enPanne) throw new Error('Opérateur indisponible');
      envoyes.push({ telephone, message });
      return { idExterne: `test-${envoyes.length}` };
    },
  });
  await chargerReferentiel();
  ctx.ecole = await creerEcole();
  await prisma.ecole.update({ where: { id: ctx.ecole.id }, data: { telephone: '+2290121304050' } });
  const compte = async (role, ecoleId = ctx.ecole.id) => {
    const c = await creerCompte(role, { ecoleId });
    return { compte: c, api: client((await connecter(c)).jeton) };
  };
  ctx.admin = await compte('ADMIN_ECOLE');
  ctx.secretariat = await compte('SECRETARIAT');
  ctx.prof = await compte('ENSEIGNANT');
  ctx.autreProf = await compte('ENSEIGNANT');

  // Année en cours qui englobe aujourd'hui
  const an = new Date().getUTCFullYear();
  const { annee } = (
    await ctx.admin.api.post('/api/annees', {
      libelle: `${an - 1}-${an}`,
      dateDebut: `${an - 1}-09-01`,
      dateFin: `${an}-12-31`,
    })
  ).body;
  ctx.annee = annee;
  const { classe } = (await ctx.admin.api.post('/api/classes', { niveau: 'QUATRIEME' })).body;
  ctx.classe = classe;
  ctx.math = classe.enseignements.find((e) => e.matiere.code === 'MATH');
  await ctx.admin.api.patch(`/api/enseignements/${ctx.math.id}`, {
    enseignantId: ctx.prof.compte.id,
  });

  ctx.eleves = [];
  ctx.telephones = [telephoneUnique(), telephoneUnique(), null];
  for (const [i, nom] of ['AHOUANDJINOU', 'BOKO', 'CODJIA'].entries()) {
    const eleve = await creerEleve(ctx.ecole.id);
    await prisma.eleve.update({
      where: { id: eleve.id },
      data: {
        nom,
        prenoms: `Prénom${i} Second`,
        dateNaissance: new Date('2011-04-0' + (i + 1)),
        telephoneContactParent: ctx.telephones[i],
      },
    });
    await prisma.inscription.create({
      data: {
        ecoleId: ctx.ecole.id,
        eleveId: eleve.id,
        classeId: classe.id,
        anneeScolaireId: annee.id,
      },
    });
    ctx.eleves.push({ ...eleve, nom, dateNaissance: new Date('2011-04-0' + (i + 1)) });
  }

  // Notes du 1er trimestre en mathématiques
  const { evaluation } = (
    await ctx.prof.api.post('/api/evaluations', {
      enseignementId: ctx.math.id,
      periodeId: annee.periodes[0].id,
      type: 'DEVOIR',
      date: `${an - 1}-10-15`,
    })
  ).body;
  await ctx.prof.api.put(`/api/evaluations/${evaluation.id}/notes`, {
    notes: ctx.eleves.map((e, i) => ({ eleveId: e.id, valeur: [15, 8, 12][i] })),
  });
});

afterAll(() => remplacerFournisseurSms(null));

const appel = (api, corps) =>
  api.put('/api/appels', {
    classeId: ctx.classe.id,
    date: aujourdhui,
    heureDebut: '08:00',
    ...corps,
  });

describe('appel et absences', () => {
  it('réserve l’appel aux enseignants de la classe', async () => {
    const reponse = await appel(ctx.autreProf.api, { presences: [] });
    expect(reponse.status).toBe(403);
  });

  it('enregistre la feuille et prévient les parents une seule fois', async () => {
    const [a, b] = ctx.eleves;
    const presences = [
      { eleveId: a.id, statut: 'ABSENT' },
      { eleveId: b.id, statut: 'RETARD', minutesRetard: 20 },
    ];
    const reponse = await appel(ctx.prof.api, { presences, enseignementId: ctx.math.id });
    expect(reponse.status).toBe(200);
    expect(reponse.body.smsEnFile).toBe(2);
    expect(reponse.body.eleves.map((e) => e.statut)).toEqual(['ABSENT', 'RETARD', 'PRESENT']);

    await declencherEnvoi();
    const messages = envoyes.filter((m) => ctx.telephones.includes(m.telephone));
    expect(messages).toHaveLength(2);
    expect(messages.find((m) => m.telephone === ctx.telephones[0]).message).toMatch(
      /Prénom0 AHOUANDJINOU était absent\(e\) le .* à 8h \(.*\).* au 01 21 30 40 50\./,
    );
    expect(messages.find((m) => m.telephone === ctx.telephones[1]).message).toMatch(
      /en retard de 20 min/,
    );

    // La même feuille renvoyée (réseau instable) ne produit aucun nouveau SMS
    const encore = await appel(ctx.prof.api, { presences, enseignementId: ctx.math.id });
    expect(encore.body.smsEnFile).toBe(0);
    const enBase = await prisma.notification.count({ where: { ecoleId: ctx.ecole.id } });
    expect(enBase).toBe(2);
  });

  it('refuse un appel à une date future', async () => {
    const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const reponse = await appel(ctx.prof.api, { date: demain, presences: [] });
    expect(reponse.body.erreur.code).toBe('DATE_FUTURE');
  });

  it('le secrétariat justifie une absence', async () => {
    const { body } = await ctx.secretariat.api.get('/api/absences?nonJustifiees=true');
    const absence = body.absences.find((x) => x.eleve.id === ctx.eleves[0].id);
    expect(absence).toMatchObject({ statut: 'ABSENT', heureDebut: '08:00', justifiee: false });
    expect(
      (await ctx.prof.api.post(`/api/absences/${absence.id}/justification`, { motif: 'Malade' }))
        .status,
    ).toBe(403);
    const ok = await ctx.secretariat.api.post(`/api/absences/${absence.id}/justification`, {
      motif: 'Certificat médical',
    });
    expect(ok.body.justifiee).toBe(true);
  });

  it('respecte le réglage de l’établissement', async () => {
    const reglage = await ctx.admin.api.patch('/api/notifications/reglages', {
      smsAbsences: false,
    });
    expect(reglage.body.reglages.smsAbsences).toBe(false);
    const reponse = await appel(ctx.prof.api, {
      heureDebut: '10:00',
      presences: [{ eleveId: ctx.eleves[0].id, statut: 'ABSENT' }],
    });
    expect(reponse.body.smsEnFile).toBe(0);
    await ctx.admin.api.patch('/api/notifications/reglages', { smsAbsences: true });
  });

  it('garde les échecs d’envoi et permet de relancer', async () => {
    enPanne = true;
    const reponse = await appel(ctx.prof.api, {
      heureDebut: '11:00',
      presences: [{ eleveId: ctx.eleves[1].id, statut: 'ABSENT' }],
    });
    expect(reponse.body.smsEnFile).toBe(1);
    await declencherEnvoi();
    const { body } = await ctx.admin.api.get('/api/notifications?statut=ECHEC');
    expect(body.notifications).toHaveLength(1);
    expect(body.notifications[0]).toMatchObject({
      tentatives: 3,
      derniereErreur: 'Opérateur indisponible',
    });

    enPanne = false;
    expect(
      (await ctx.secretariat.api.post(`/api/notifications/${body.notifications[0].id}/relance`))
        .status,
    ).toBe(403);
    const relance = await ctx.admin.api.post(
      `/api/notifications/${body.notifications[0].id}/relance`,
    );
    expect(relance.body.relance).toBe(true);
    await declencherEnvoi();
    await envoyerEnAttente();
    const journal = await ctx.admin.api.get('/api/notifications');
    expect(journal.body.compteurs).toMatchObject({ ENVOYEE: 3 });
    expect(journal.body.compteurs.ECHEC).toBeUndefined();
  });
});

describe('activation du compte parent', () => {
  const activation = (corps) =>
    request(app)
      .post('/api/public/parents/activation')
      .send({
        identifiantEleve: ctx.eleves[0].identifiant.toLowerCase(),
        dateNaissance: '2011-04-01',
        telephone: ctx.telephones[0],
        nom: 'Ahouandjinou',
        prenoms: 'Rachelle',
        lien: 'MERE',
        motDePasse: 'Cotonou2026',
        ...corps,
      });

  it('exige les informations enregistrées par l’établissement', async () => {
    for (const corps of [
      { telephone: telephoneUnique() },
      { dateNaissance: '2011-04-02' },
      { identifiantEleve: ctx.eleves[1].identifiant },
    ]) {
      const reponse = await activation(corps);
      expect(reponse.status).toBe(404);
      expect(reponse.body.erreur.code).toBe('INFORMATIONS_INCORRECTES');
    }
  });

  it('crée le compte, relie l’enfant et permet de se connecter', async () => {
    const reponse = await activation();
    expect(reponse.status).toBe(201);
    expect(reponse.body.compteExistant).toBe(false);
    const connexion = await request(app)
      .post('/api/auth/connexion')
      .send({ identifiant: ctx.telephones[0], motDePasse: 'Cotonou2026' });
    expect(connexion.status).toBe(200);
    ctx.parent = { api: client(connexion.body.jetonAcces) };

    // Une seconde activation relie sans recréer de compte
    expect((await activation()).body.compteExistant).toBe(true);
  });
});

describe('espace parent', () => {
  it('liste ses enfants avec un résumé', async () => {
    const { body } = await ctx.parent.api.get('/api/parent/enfants');
    expect(body.enfants).toHaveLength(1);
    expect(body.enfants[0]).toMatchObject({
      id: ctx.eleves[0].id,
      lien: 'MERE',
      classe: ctx.classe.nom,
      ecole: ctx.ecole.nom,
      dernierePeriode: { numero: 1, moyenneGenerale: 15, rang: null },
    });
    // L'absence de 8 h est justifiée, celle de 10 h ne l'est pas
    expect(body.enfants[0].absencesNonJustifiees).toBe(1);
  });

  it('suit les notes et absences de son enfant, et seulement de son enfant', async () => {
    const { body } = await ctx.parent.api.get(`/api/parent/enfants/${ctx.eleves[0].id}`);
    const t1 = body.periodes[0];
    expect(t1.estCloturee).toBe(false);
    expect(t1.rang).toBeNull(); // pas de rang tant que la période est ouverte
    const maths = t1.matieres.find((m) => m.matiere === 'Mathématiques');
    expect(maths.notes).toEqual([
      expect.objectContaining({ type: 'DEVOIR', valeur: 15, bareme: 20, surVingt: 15 }),
    ]);
    expect(maths.moyenneClasse).toBeCloseTo(11.67, 1);
    expect(body.absences.map((a) => [a.heureDebut, a.justifiee])).toEqual([
      ['10:00', false],
      ['08:00', true],
    ]);

    expect((await ctx.parent.api.get(`/api/parent/enfants/${ctx.eleves[1].id}`)).status).toBe(404);
    expect((await ctx.admin.api.get('/api/parent/enfants')).status).toBe(403);
  });

  it('reçoit le SMS du bulletin, avec la moyenne et le numéro', async () => {
    await ctx.admin.api.post(`/api/periodes/${ctx.annee.periodes[0].id}/cloture`, {
      forcer: true,
      motif: 'Conseil de classe',
    });
    const generation = await ctx.secretariat.api.post('/api/releves/generation', {
      classeId: ctx.classe.id,
      periodeId: ctx.annee.periodes[0].id,
    });
    // Deux élèves ont un téléphone de parent : deux SMS
    expect(generation.body).toMatchObject({ generes: 3, smsEnFile: 2 });
    await declencherEnvoi();
    const sms = envoyes.filter((m) => m.telephone === ctx.telephones[0]).at(-1);
    expect(sms.message).toMatch(/bulletin du 1er trimestre de Prénom0 AHOUANDJINOU est disponible/);
    expect(sms.message).toMatch(/Moyenne 15,00\/20, rang 1er sur 3/);

    const { body } = await ctx.parent.api.get('/api/parent/messages');
    expect(body.messages.map((m) => m.type)).toEqual(
      expect.arrayContaining(['ABSENCE', 'BULLETIN']),
    );

    const suivi = await ctx.parent.api.get(`/api/parent/enfants/${ctx.eleves[0].id}`);
    expect(suivi.body.periodes[0].rang).toBe(1);
    const document = suivi.body.documents[0];
    const pdf = await ctx.parent.api.get(
      `/api/parent/enfants/${ctx.eleves[0].id}/documents/${document.id}/pdf`,
    );
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
  });
});

describe('suivi de l’élève connecté', () => {
  it('voit ses propres notes', async () => {
    const compteEleve = await creerCompte('ELEVE', { ecoleId: ctx.ecole.id });
    await prisma.eleve.update({
      where: { id: ctx.eleves[2].id },
      data: { utilisateurId: compteEleve.id },
    });
    const api = client((await connecter(compteEleve)).jeton);
    const { body } = await api.get('/api/moi/suivi');
    expect(body.eleve.nom).toBe('CODJIA');
    expect(body.periodes[0]).toMatchObject({ moyenneGenerale: 12, rang: 2 });
  });
});

describe('USSD', () => {
  it('la passerelle est fermée sans secret configuré', async () => {
    const reponse = await request(app)
      .post('/api/ussd')
      .type('form')
      .send({ phoneNumber: ctx.telephones[0], text: '' });
    expect(reponse.status).toBe(404);
  });

  it('propose le menu puis répond avec les moyennes, absences et bulletins', async () => {
    const accueil = await ctx.parent.api.post('/api/ussd/simulation', { texte: '' });
    expect(accueil.body.reponse).toMatch(/^CON EduRelevé\n1\. Notes et moyennes/);
    const moyennes = await ctx.parent.api.post('/api/ussd/simulation', { texte: '1' });
    expect(moyennes.body.reponse).toMatch(/^END Prénom0 AHOUANDJINOU/);
    expect(moyennes.body.reponse).toMatch(/T1 : 15,00\/20 \(1er\/3\)/);
    const absences = await ctx.parent.api.post('/api/ussd/simulation', { texte: '2' });
    expect(absences.body.reponse).toMatch(/2 absence\(s\) dont 1 non justifiée/);
    const bulletins = await ctx.parent.api.post('/api/ussd/simulation', { texte: '3' });
    expect(bulletins.body.reponse).toMatch(/T1 .* : 15,00 - N° B\d\d-/);
    for (const r of [accueil, moyennes, absences, bulletins]) {
      expect(r.body.reponse.length).toBeLessThanOrEqual(182);
    }
    // Un parent n'interroge que son propre numéro
    const autre = await ctx.parent.api.post('/api/ussd/simulation', {
      texte: '1',
      telephone: ctx.telephones[1],
    });
    expect(autre.body.telephone).toBe(ctx.telephones[0]);
  });

  it('demande de choisir l’enfant quand le numéro en a plusieurs', async () => {
    const commun = telephoneUnique();
    await prisma.eleve.updateMany({
      where: { id: { in: [ctx.eleves[1].id, ctx.eleves[2].id] } },
      data: { telephoneContactParent: commun },
    });
    const choix = await repondreUssd({ telephone: commun, texte: '1' });
    expect(choix).toMatch(/^CON Choisissez l'enfant :\n1\. Prénom1 BOKO\n2\. Prénom2 CODJIA/);
    expect(await repondreUssd({ telephone: commun, texte: '1*2' })).toMatch(/^END Prénom2 CODJIA/);
    expect(await repondreUssd({ telephone: commun, texte: '1*9' })).toMatch(/^END Choix invalide/);
    expect(await repondreUssd({ telephone: telephoneUnique(), texte: '1' })).toMatch(
      /Aucun élève n'est associé/,
    );
  });
});

describe('règles garanties par la base', () => {
  it('un SMS envoyé n’est ni modifié ni supprimé', async () => {
    const envoye = await prisma.notification.findFirst({
      where: { ecoleId: ctx.ecole.id, statut: 'ENVOYEE' },
    });
    await expect(
      prisma.notification.update({ where: { id: envoye.id }, data: { message: 'Falsifié' } }),
    ).rejects.toThrow(/modification interdite/);
    await expect(prisma.notification.delete({ where: { id: envoye.id } })).rejects.toThrow(
      /suppression interdite/,
    );
  });

  it('le téléphone du destinataire est au format international', async () => {
    await expect(
      prisma.notification.create({
        data: {
          ecoleId: ctx.ecole.id,
          eleveId: ctx.eleves[0].id,
          telephone: '0197000000',
          type: 'ABSENCE',
          message: 'x',
          cleUnicite: `test:${Date.now()}`,
        },
      }),
    ).rejects.toThrow(/notifications_telephone_format/);
  });
});
