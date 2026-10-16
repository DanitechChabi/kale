// Relevés archivés : génération après clôture, PDF figé, vérification publique,
// corrections, accès de l'élève, duplicata en ligne et règles garanties par la base.
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
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

const ctx = {};
const client = (jeton) => ({
  get: (url) => request(app).get(url).set(avecJeton(jeton)),
  post: (url, corps) => request(app).post(url).set(avecJeton(jeton)).send(corps),
  put: (url, corps) => request(app).put(url).set(avecJeton(jeton)).send(corps),
  patch: (url, corps) => request(app).patch(url).set(avecJeton(jeton)).send(corps),
});
const sha256 = (contenu) => createHash('sha256').update(contenu).digest('hex');
// Lecture binaire des réponses PDF avec Supertest
const binaire = (req) =>
  req.buffer(true).parse((res, fin) => {
    const morceaux = [];
    res.on('data', (m) => morceaux.push(m));
    res.on('end', () => fin(null, Buffer.concat(morceaux)));
  });

beforeAll(async () => {
  await chargerReferentiel();
  ctx.ecole = await creerEcole();
  await prisma.ecole.update({
    where: { id: ctx.ecole.id },
    data: { nomChefEtablissement: 'Mme Afiavi DOSSOU' },
  });
  const compte = async (role, ecoleId = ctx.ecole.id) => {
    const c = await creerCompte(role, { ecoleId });
    return { compte: c, api: client((await connecter(c)).jeton) };
  };
  ctx.admin = await compte('ADMIN_ECOLE');
  ctx.secretariat = await compte('SECRETARIAT');
  ctx.prof = await compte('ENSEIGNANT');
  ctx.autreEcole = await creerEcole();
  ctx.autreAdmin = await compte('ADMIN_ECOLE', ctx.autreEcole.id);

  const { annee } = (
    await ctx.admin.api.post('/api/annees', {
      libelle: '2024-2025',
      dateDebut: '2024-10-01',
      dateFin: '2025-07-15',
    })
  ).body;
  ctx.annee = annee;
  ctx.t1 = annee.periodes[0];
  const { classe } = (await ctx.admin.api.post('/api/classes', { niveau: 'CINQUIEME' })).body;
  ctx.classe = classe;
  const math = classe.enseignements.find((e) => e.matiere.code === 'MATH');
  const francais = classe.enseignements.find((e) => e.matiere.code === 'FR');

  ctx.eleves = [];
  for (const [nom, prenoms, naissance] of [
    ['HOUNKPATIN', 'Sèna Marie', '2012-03-01'],
    ['AGOSSOU', 'Koffi', '2012-06-12'],
    ['DOSSOU', 'Afi', '2012-09-30'],
  ]) {
    const eleve = await creerEleve(ctx.ecole.id);
    await prisma.eleve.update({
      where: { id: eleve.id },
      data: { nom, prenoms, dateNaissance: new Date(naissance) },
    });
    await prisma.inscription.create({
      data: {
        ecoleId: ctx.ecole.id,
        eleveId: eleve.id,
        classeId: classe.id,
        anneeScolaireId: annee.id,
      },
    });
    ctx.eleves.push({ ...eleve, nom, prenoms });
  }

  // Compte de connexion de la première élève
  const compteEleve = await creerCompte('ELEVE', { ecoleId: ctx.ecole.id });
  await prisma.eleve.update({
    where: { id: ctx.eleves[0].id },
    data: { utilisateurId: compteEleve.id },
  });
  ctx.eleve = { compte: compteEleve, api: client((await connecter(compteEleve)).jeton) };

  // Notes du 1er trimestre : 16, 12, 8 en maths ; 14, 11, 9 en français
  for (const [enseignement, valeurs] of [
    [math, [16, 12, 8]],
    [francais, [14, 11, 9]],
  ]) {
    const { evaluation } = (
      await ctx.admin.api.post('/api/evaluations', {
        enseignementId: enseignement.id,
        periodeId: ctx.t1.id,
        type: 'DEVOIR',
        date: '2024-11-15',
      })
    ).body;
    await ctx.admin.api.put(`/api/evaluations/${evaluation.id}/notes`, {
      notes: ctx.eleves.map((e, i) => ({ eleveId: e.id, valeur: valeurs[i] })),
    });
  }
});

describe('génération des bulletins', () => {
  it('refuse tant que la période est ouverte', async () => {
    const reponse = await ctx.secretariat.api.post('/api/releves/generation', {
      classeId: ctx.classe.id,
      periodeId: ctx.t1.id,
    });
    expect(reponse.status).toBe(409);
    expect(reponse.body.erreur.code).toBe('PERIODE_OUVERTE');
  });

  it('archive un bulletin par élève après la clôture, sans doublon', async () => {
    const cloture = await ctx.admin.api.post(`/api/periodes/${ctx.t1.id}/cloture`, {
      forcer: true,
      motif: 'Conseil de classe du 20 décembre',
    });
    expect(cloture.status).toBe(200);

    const selection = { classeId: ctx.classe.id, periodeId: ctx.t1.id };
    const premiere = await ctx.secretariat.api.post('/api/releves/generation', selection);
    expect(premiere.status).toBe(201);
    expect(premiere.body).toMatchObject({ generes: 3, dejaArchives: 0 });

    const seconde = await ctx.secretariat.api.post('/api/releves/generation', selection);
    expect(seconde.body).toMatchObject({ generes: 0, dejaArchives: 3 });

    const etat = await ctx.secretariat.api.get(
      `/api/releves/classe?classeId=${ctx.classe.id}&periodeId=${ctx.t1.id}`,
    );
    expect(etat.body.cloturee).toBe(true);
    expect(etat.body.eleves.every((e) => e.document?.numero.startsWith('B25'))).toBe(true);
    ctx.document = etat.body.eleves.find((e) => e.id === ctx.eleves[0].id).document;
  });

  it('fige les moyennes et les rangs dans l’instantané', async () => {
    const releve = await prisma.releveArchive.findUnique({ where: { id: ctx.document.id } });
    const { donnees } = releve;
    expect(donnees.eleve.nom).toBe('HOUNKPATIN');
    expect(donnees.etablissement.chef).toBe('Mme Afiavi DOSSOU');
    expect(donnees.resultats.rang).toBe(1);
    expect(donnees.resultats.classes).toBe(3);
    const maths = donnees.matieres.find((m) => m.matiere === 'Mathématiques');
    expect(maths).toMatchObject({ moyenne: 16, devoirs: [16], rang: 1, appreciation: 'Très bien' });
    expect(donnees.delivrance.par).toMatch(/secrétariat/);
  });

  it('sert le PDF figé, identique à son empreinte', async () => {
    const reponse = await binaire(ctx.secretariat.api.get(`/api/releves/${ctx.document.id}/pdf`));
    expect(reponse.status).toBe(200);
    expect(reponse.headers['content-type']).toBe('application/pdf');
    expect(reponse.body.subarray(0, 5).toString()).toBe('%PDF-');
    const releve = await prisma.releveArchive.findUnique({ where: { id: ctx.document.id } });
    expect(sha256(reponse.body)).toBe(releve.empreinteSha256);
    expect(reponse.headers['x-empreinte-sha256']).toBe(releve.empreinteSha256);
    ctx.pdf = reponse.body;
  });

  it('réserve la génération au secrétariat et à la direction', async () => {
    const reponse = await ctx.prof.api.post('/api/releves/generation', {
      classeId: ctx.classe.id,
      periodeId: ctx.t1.id,
    });
    expect(reponse.status).toBe(403);
  });

  it('isole les documents par établissement', async () => {
    expect((await ctx.autreAdmin.api.get(`/api/releves/${ctx.document.id}`)).status).toBe(404);
    expect((await ctx.autreAdmin.api.get(`/api/releves/${ctx.document.id}/pdf`)).status).toBe(404);
  });
});

describe('relevé annuel', () => {
  it('attend la clôture de toutes les périodes, puis reprend chaque trimestre', async () => {
    const selection = { classeId: ctx.classe.id };
    const refus = await ctx.secretariat.api.post('/api/releves/generation', selection);
    expect(refus.body.erreur.code).toBe('PERIODE_OUVERTE');

    for (const periode of ctx.annee.periodes.slice(1)) {
      await ctx.admin.api.post(`/api/periodes/${periode.id}/cloture`, {
        forcer: true,
        motif: 'Aucune évaluation saisie (test)',
      });
    }
    const reponse = await ctx.secretariat.api.post('/api/releves/generation', selection);
    expect(reponse.body).toMatchObject({ generes: 3, dejaArchives: 0 });

    const etat = await ctx.secretariat.api.get(`/api/releves/classe?classeId=${ctx.classe.id}`);
    expect(etat.body.type).toBe('RELEVE_ANNUEL');
    const ligne = etat.body.eleves.find((e) => e.id === ctx.eleves[0].id);
    expect(ligne.document.numero).toMatch(/^R25/);

    const { donnees } = await prisma.releveArchive.findUnique({ where: { id: ligne.document.id } });
    expect(donnees.periodes).toHaveLength(3);
    // Seul le 1er trimestre a des notes : la moyenne annuelle est celle du trimestre
    expect(donnees.resultats.periodes[0].moyenne).toBe(donnees.resultats.moyenneGenerale);
    expect(donnees.resultats.periodes[1].moyenne).toBeNull();
    const maths = donnees.matieres.find((m) => m.matiere === 'Mathématiques');
    expect(maths.moyennesPeriodes).toEqual([16, null, null]);
    expect(maths.moyenne).toBe(16);
  });
});

describe('vérification publique', () => {
  it('donne la fiche du document par son numéro, sans compte', async () => {
    const saisie = ctx.document.numero.toLowerCase(); // casse et tirets tolérés
    const reponse = await request(app).get(`/api/public/v1/documents/${saisie}`);
    expect(reponse.status).toBe(200);
    expect(reponse.headers['access-control-allow-origin']).toBe('*');
    const { document } = reponse.body;
    expect(document).toMatchObject({
      numero: ctx.document.numeroAffiche,
      statut: 'EN_VIGUEUR',
      eleve: { nom: 'HOUNKPATIN', prenoms: 'Sèna Marie', dateNaissance: '2012-03-01' },
      resultats: { rang: 1, classes: 3 },
    });
    expect(document.etablissement.nom).toBe(ctx.ecole.nom);
  });

  it('distingue un numéro mal formé d’un numéro inconnu', async () => {
    const numero = ctx.document.numero;
    const faute = numero.slice(0, 5) + (numero[5] === 'A' ? 'B' : 'A') + numero.slice(6);
    const malForme = await request(app).get(`/api/public/v1/documents/${faute}`);
    expect(malForme.body.erreur.code).toBe('NUMERO_INVALIDE');
    const { genererNumero } = await import('../../src/utils/numeroDocument.js');
    const inconnu = await request(app).get(`/api/public/v1/documents/${genererNumero('B', 2025)}`);
    expect(inconnu.status).toBe(404);
    expect(inconnu.body.erreur.code).toBe('INTROUVABLE');
  });

  it('compare l’empreinte d’un fichier reçu à l’archive', async () => {
    const url = `/api/public/v1/documents/${ctx.document.numero}/verification`;
    const conforme = await request(app)
      .post(url)
      .send({ empreinteSha256: sha256(ctx.pdf) });
    expect(conforme.body).toMatchObject({ trouve: true, conforme: true, statut: 'EN_VIGUEUR' });
    const altere = Buffer.from(ctx.pdf);
    altere[altere.length - 20] ^= 1;
    const nonConforme = await request(app)
      .post(url)
      .send({ empreinteSha256: sha256(altere) });
    expect(nonConforme.body.conforme).toBe(false);
  });

  it('affiche une page légère et sûre pour le lien du QR code', async () => {
    const page = await request(app).get(`/verifier/${ctx.document.numeroAffiche}`);
    expect(page.status).toBe(200);
    expect(page.headers['content-type']).toMatch(/text\/html/);
    expect(page.text).toContain('Document authentique');
    expect(page.text).toContain('HOUNKPATIN');
    expect(page.headers['x-robots-tag']).toMatch(/noindex/);
    const nonce = /script-src 'nonce-([^']+)'/.exec(page.headers['content-security-policy'])[1];
    expect(page.text).toContain(`<script nonce="${nonce}">`);
    expect(Buffer.byteLength(page.text)).toBeLessThan(16 * 1024);

    // Saisie approximative : redirection vers l'adresse canonique
    const brute = await request(app).get(`/verifier/${ctx.document.numero.toLowerCase()}`);
    expect(brute.status).toBe(301);
    expect(brute.headers.location).toBe(`/verifier/${ctx.document.numeroAffiche}`);

    const absente = await request(app).get('/verifier/B25-0000-0000');
    expect(absente.status).toBe(404);
    expect(absente.text).toContain('Aucun document archivé');
  });

  it('échappe les données affichées', async () => {
    await prisma.eleve.update({
      where: { id: ctx.eleves[2].id },
      data: { nom: '<script>alert(1)</script>' },
    });
    // Le nom vient de l'instantané (inchangé) : on vérifie un document produit avec ce nom
    const autre = (
      await ctx.secretariat.api.get(
        `/api/releves/classe?classeId=${ctx.classe.id}&periodeId=${ctx.t1.id}`,
      )
    ).body.eleves.find((e) => e.id === ctx.eleves[2].id).document;
    const correction = await ctx.admin.api.post(`/api/releves/${autre.id}/correction`, {
      motif: 'Contrôle de l’échappement',
    });
    const page = await request(app).get(`/verifier/${correction.body.document.numeroAffiche}`);
    expect(page.text).not.toContain('<script>alert(1)</script>');
    expect(page.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

describe('corrections', () => {
  it('produit un nouveau document qui référence l’ancien', async () => {
    expect(
      (
        await ctx.secretariat.api.post(`/api/releves/${ctx.document.id}/correction`, {
          motif: 'Prénom mal orthographié',
        })
      ).status,
    ).toBe(403);

    await prisma.eleve.update({
      where: { id: ctx.eleves[0].id },
      data: { prenoms: 'Sèna Marie-Ange' },
    });
    const reponse = await ctx.admin.api.post(`/api/releves/${ctx.document.id}/correction`, {
      motif: 'Prénom mal orthographié',
    });
    expect(reponse.status).toBe(201);
    const nouveau = reponse.body.document;
    expect(nouveau.remplace.id).toBe(ctx.document.id);
    expect(nouveau.motifCorrection).toBe('Prénom mal orthographié');
    ctx.correction = nouveau;

    const releve = await prisma.releveArchive.findUnique({ where: { id: nouveau.id } });
    expect(releve.donnees.eleve.prenoms).toBe('Sèna Marie-Ange');
    expect(releve.donnees.remplace.numero).toBe(ctx.document.numero);
    // Les notes, figées par la clôture, sont inchangées
    expect(releve.donnees.resultats.rang).toBe(1);
  });

  it('l’ancien reste vérifiable avec la mention « remplacé »', async () => {
    const { body } = await request(app).get(`/api/public/v1/documents/${ctx.document.numero}`);
    expect(body.document.statut).toBe('REMPLACE');
    expect(body.document.remplacePar.numero).toBe(ctx.correction.numeroAffiche);
    const page = await request(app).get(`/verifier/${ctx.document.numeroAffiche}`);
    expect(page.text).toContain('authentique mais remplacé');
  });

  it('refuse de remplacer deux fois le même document', async () => {
    const reponse = await ctx.admin.api.post(`/api/releves/${ctx.document.id}/correction`, {
      motif: 'Deuxième correction',
    });
    expect(reponse.status).toBe(409);
    expect(reponse.body.erreur.code).toBe('DEJA_REMPLACE');
  });

  it('l’état de la classe montre la version en vigueur', async () => {
    const etat = await ctx.secretariat.api.get(
      `/api/releves/classe?classeId=${ctx.classe.id}&periodeId=${ctx.t1.id}`,
    );
    const ligne = etat.body.eleves.find((e) => e.id === ctx.eleves[0].id);
    expect(ligne.document.id).toBe(ctx.correction.id);
    expect(ligne.document.versions).toBe(2);
  });
});

describe('espace élève', () => {
  it('liste et télécharge ses propres documents uniquement', async () => {
    const liste = await ctx.eleve.api.get('/api/releves/mes-documents');
    expect(liste.status).toBe(200);
    const ids = liste.body.documents.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining([ctx.correction.id, ctx.document.id]));
    expect(liste.body.documents.every((d) => d.classe === '5e A')).toBe(true);

    const pdf = await binaire(
      ctx.eleve.api.get(`/api/releves/mes-documents/${ctx.correction.id}/pdf`),
    );
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');

    const autre = (await prisma.releveArchive.findFirst({ where: { eleveId: ctx.eleves[2].id } }))
      .id;
    expect((await ctx.eleve.api.get(`/api/releves/mes-documents/${autre}/pdf`)).status).toBe(404);
    expect((await ctx.eleve.api.get(`/api/releves/${autre}/pdf`)).status).toBe(403);
  });
});

describe('duplicata en ligne', () => {
  const demande = (corps = {}) =>
    request(app)
      .post('/api/public/duplicata')
      .send({
        ecoleId: ctx.ecole.id,
        typeDocument: 'BULLETIN_PERIODE',
        libelleAnnee: '2024-2025',
        numeroPeriode: 1,
        classeDeclaree: '5e A',
        nomEleve: 'Agossou',
        prenomsEleve: 'Koffi Romuald',
        dateNaissance: '2012-06-12',
        nomDemandeur: 'AGOSSOU Koffi',
        telephone: '01 97 55 44 33',
        motif: 'Inscription à l’université',
        ...corps,
      });

  it('enregistre la demande et rapproche l’élève automatiquement', async () => {
    const etablissements = await request(app).get('/api/public/etablissements?q=établissement');
    expect(etablissements.body.etablissements.some((e) => e.id === ctx.ecole.id)).toBe(true);

    const reponse = await demande();
    expect(reponse.status).toBe(201);
    expect(reponse.body.numeroSuivi).toMatch(/^D\d{2}-/);
    ctx.numeroSuivi = reponse.body.numeroSuivi;
    const enregistree = await prisma.demandeDuplicata.findFirst({
      where: { ecoleId: ctx.ecole.id },
      orderBy: { demandeLe: 'desc' },
    });
    expect(enregistree.eleveId).toBe(ctx.eleves[1].id);
    expect(enregistree.anneeScolaireId).toBe(ctx.annee.id);
    expect(enregistree.telephone).toBe('+2290197554433');
    ctx.demandeId = enregistree.id;
  });

  it('valide la demande', async () => {
    const sansPeriode = await demande({ numeroPeriode: undefined });
    expect(sansPeriode.status).toBe(400);
    const nonVerifiee = await creerEcole({ statutVerification: 'EN_ATTENTE' });
    expect((await demande({ ecoleId: nonVerifiee.id })).status).toBe(404);
    expect((await demande({ libelleAnnee: '2024-2026' })).status).toBe(400);
  });

  it('le suivi exige le numéro et le téléphone déclarés', async () => {
    const mauvais = await request(app)
      .post('/api/public/duplicata/suivi')
      .send({ numeroSuivi: ctx.numeroSuivi, telephone: '0196000000' });
    expect(mauvais.status).toBe(404);
    const bon = await request(app)
      .post('/api/public/duplicata/suivi')
      .send({ numeroSuivi: ctx.numeroSuivi, telephone: '+229 01 97 55 44 33' });
    expect(bon.body.demande).toMatchObject({ statut: 'EN_ATTENTE', document: null });
  });

  it('le secrétariat retrouve le document et le délivre', async () => {
    const liste = await ctx.secretariat.api.get('/api/duplicatas?statut=EN_ATTENTE');
    expect(liste.body.demandes.map((d) => d.id)).toContain(ctx.demandeId);
    expect(liste.body.compteurs.EN_ATTENTE).toBeGreaterThanOrEqual(1);

    const prise = await ctx.secretariat.api.post(
      `/api/duplicatas/${ctx.demandeId}/prise-en-charge`,
    );
    expect(prise.body.demande.statut).toBe('EN_COURS');
    const candidat = prise.body.candidats[0];
    expect(candidat.id).toBe(ctx.eleves[1].id);
    const document = candidat.documents.find((d) => d.correspond);
    expect(document).toBeTruthy();

    // Un document d'une autre école est introuvable
    expect((await ctx.autreAdmin.api.get(`/api/duplicatas/${ctx.demandeId}`)).status).toBe(404);

    const delivree = await ctx.secretariat.api.post(`/api/duplicatas/${ctx.demandeId}/delivrance`, {
      releveId: document.id,
    });
    expect(delivree.status).toBe(200);
    expect(delivree.body.demande.statut).toBe('DELIVREE');
    ctx.releveDelivre = document.id;

    const encore = await ctx.secretariat.api.post(`/api/duplicatas/${ctx.demandeId}/rejet`, {
      motif: 'Trop tard pour rejeter',
    });
    expect(encore.body.erreur.code).toBe('DEMANDE_CLOTUREE');
  });

  it('le demandeur télécharge le document délivré depuis le suivi', async () => {
    const suivi = await request(app)
      .post('/api/public/duplicata/suivi')
      .send({ numeroSuivi: ctx.numeroSuivi, telephone: '0197554433' });
    expect(suivi.body.demande.statut).toBe('DELIVREE');
    const { jetonTelechargement } = suivi.body.demande.document;
    const pdf = await binaire(
      request(app).get(`/api/public/duplicata/telechargement/${jetonTelechargement}`),
    );
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-disposition']).toMatch(/^attachment/);
    const releve = await prisma.releveArchive.findUnique({ where: { id: ctx.releveDelivre } });
    expect(sha256(pdf.body)).toBe(releve.empreinteSha256);

    const faux = await request(app).get('/api/public/duplicata/telechargement/abc.def.ghi');
    expect(faux.status).toBe(410);
    // Le jeton de téléchargement n'ouvre aucune session
    expect(
      (await request(app).get('/api/auth/moi').set(avecJeton(jetonTelechargement))).status,
    ).toBe(401);
  });

  it('un rejet exige un motif', async () => {
    const { body } = await demande({ nomEleve: 'INCONNU', prenomsEleve: 'Personne' });
    const id = (
      await prisma.demandeDuplicata.findFirst({
        where: { numeroSuivi: body.numeroSuivi.replace(/-/g, '') },
      })
    ).id;
    expect((await ctx.secretariat.api.post(`/api/duplicatas/${id}/rejet`, {})).status).toBe(400);
    const rejet = await ctx.secretariat.api.post(`/api/duplicatas/${id}/rejet`, {
      motif: 'Aucun élève de ce nom inscrit cette année-là',
    });
    expect(rejet.body.demande).toMatchObject({ statut: 'REJETEE' });
  });
});

describe('règles garanties par la base', () => {
  it('un document archivé n’est jamais modifié ni supprimé', async () => {
    await expect(
      prisma.releveArchive.update({ where: { id: ctx.document.id }, data: { tailleOctets: 1 } }),
    ).rejects.toThrow(/ni modifiés ni supprimés/);
    await expect(prisma.releveArchive.delete({ where: { id: ctx.document.id } })).rejects.toThrow();
  });

  it('un seul document d’origine par élève et par période', async () => {
    const original = await prisma.releveArchive.findUnique({ where: { id: ctx.document.id } });
    const { genererNumero } = await import('../../src/utils/numeroDocument.js');
    await expect(
      prisma.releveArchive.create({
        data: {
          ecoleId: original.ecoleId,
          numero: genererNumero('B', 2025),
          type: original.type,
          eleveId: original.eleveId,
          anneeScolaireId: original.anneeScolaireId,
          periodeId: original.periodeId,
          cheminFichier: 'releves/x.pdf',
          empreinteSha256: 'a'.repeat(64),
          tailleOctets: 1,
          donnees: {},
          genereParId: original.genereParId,
        },
      }),
    ).rejects.toThrow(/releves_original_unique|Unique constraint/);
  });

  it('une correction remplace un document du même élève', async () => {
    const original = await prisma.releveArchive.findFirst({
      where: { eleveId: ctx.eleves[2].id },
    });
    const { genererNumero } = await import('../../src/utils/numeroDocument.js');
    await expect(
      prisma.releveArchive.create({
        data: {
          ecoleId: original.ecoleId,
          numero: genererNumero('B', 2025),
          type: original.type,
          eleveId: ctx.eleves[0].id, // autre élève
          anneeScolaireId: original.anneeScolaireId,
          periodeId: original.periodeId,
          cheminFichier: 'releves/y.pdf',
          empreinteSha256: 'b'.repeat(64),
          tailleOctets: 1,
          donnees: {},
          remplaceReleveId: original.id,
          motifCorrection: 'Tentative',
          genereParId: original.genereParId,
        },
      }),
    ).rejects.toThrow(/même élève/);
  });

  it('le numéro respecte son format', async () => {
    const original = await prisma.releveArchive.findUnique({ where: { id: ctx.document.id } });
    await expect(
      prisma.$executeRaw`INSERT INTO releves_archives (id, ecole_id, numero, type, eleve_id, annee_scolaire_id, chemin_fichier, empreinte_sha256, taille_octets, donnees, genere_par_id)
        VALUES (gen_random_uuid(), ${original.ecoleId}::uuid, 'B25-ABC', 'RELEVE_ANNUEL', ${original.eleveId}::uuid, ${original.anneeScolaireId}::uuid, 'x', ${'c'.repeat(64)}, 1, '{}', ${original.genereParId}::uuid)`,
    ).rejects.toThrow(/releves_numero/);
  });

  it('le PDF archivé stocké en base ne peut être ni réécrit ni supprimé', async () => {
    const original = await prisma.releveArchive.findUnique({ where: { id: ctx.document.id } });
    const fichier = await prisma.fichierStocke.findUnique({
      where: { cle: original.cheminFichier },
    });
    expect(fichier.empreinteSha256).toBe(original.empreinteSha256);
    await expect(
      prisma.fichierStocke.update({
        where: { cle: original.cheminFichier },
        data: { contenu: Buffer.from('%PDF-faux') },
      }),
    ).rejects.toThrow(/interdite/);
    await expect(
      prisma.fichierStocke.delete({ where: { cle: original.cheminFichier } }),
    ).rejects.toThrow(/interdite/);
  });
});
