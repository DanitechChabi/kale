import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  formaterIdentifiantEleve,
  normaliserIdentifiantEleve,
} from '../../src/utils/identifiantEleve.js';
import {
  app,
  avecJeton,
  chargerReferentiel,
  connecter,
  creerCompte,
  creerEcole,
  prisma,
} from './aide.js';

const ctx = {};
const api = (jeton) => ({
  get: (url) => request(app).get(url).set(avecJeton(jeton)),
  post: (url, corps) => request(app).post(url).set(avecJeton(jeton)).send(corps),
  patch: (url, corps) => request(app).patch(url).set(avecJeton(jeton)).send(corps),
  delete: (url) => request(app).delete(url).set(avecJeton(jeton)),
});

beforeAll(async () => {
  await chargerReferentiel();
  ctx.ecole = await creerEcole();
  const jeton = async (role) =>
    (await connecter(await creerCompte(role, { ecoleId: ctx.ecole.id }))).jeton;
  ctx.admin = api(await jeton('ADMIN_ECOLE'));
  ctx.secretariat = api(await jeton('SECRETARIAT'));
  ctx.enseignant = api(await jeton('ENSEIGNANT'));
  ctx.serieD = await prisma.serie.findUnique({ where: { code: 'D' } });
  ctx.serieF1 = await prisma.serie.findUnique({ where: { code: 'F1' } });
});

describe('années scolaires', () => {
  it('crée l’année courante découpée en trimestres contigus', async () => {
    const ancienne = await ctx.admin.post('/api/annees', {
      libelle: '2024-2025',
      dateDebut: '2024-10-01',
      dateFin: '2025-07-15',
    });
    expect(ancienne.status).toBe(201);

    const reponse = await ctx.admin.post('/api/annees', {
      libelle: '2025-2026',
      dateDebut: '2025-10-01',
      dateFin: '2026-07-15',
    });
    expect(reponse.status).toBe(201);
    const { annee } = reponse.body;
    expect(annee.estCourante).toBe(true);
    expect(annee.periodes.map((p) => p.numero)).toEqual([1, 2, 3]);
    expect(annee.periodes[0].dateDebut.slice(0, 10)).toBe('2025-10-01');
    expect(annee.periodes[2].dateFin.slice(0, 10)).toBe('2026-07-15');
    for (let i = 1; i < 3; i++) {
      const fin = new Date(annee.periodes[i - 1].dateFin);
      const debut = new Date(annee.periodes[i].dateDebut);
      expect(debut - fin).toBe(86_400_000);
    }
    ctx.annee = annee;

    const annees = (await ctx.admin.get('/api/annees')).body.annees;
    expect(annees.filter((a) => a.estCourante)).toHaveLength(1);
  });

  it('refuse des années qui ne se suivent pas', async () => {
    const reponse = await ctx.admin.post('/api/annees', {
      libelle: '2025-2027',
      dateDebut: '2025-10-01',
      dateFin: '2026-07-15',
    });
    expect(reponse.status).toBe(400);
  });
});

describe('classes créées avec le programme national', () => {
  it('donne à une 6e ses matières par défaut, conduite comprise', async () => {
    const reponse = await ctx.admin.post('/api/classes', { niveau: 'SIXIEME' });
    expect(reponse.status).toBe(201);
    const { classe } = reponse.body;
    expect(classe.nom).toBe('6e A');
    const codes = classe.enseignements.map((e) => e.matiere.code);
    expect(codes).toEqual(['FR', 'ANG', 'HG', 'MATH', 'PCT', 'SVT', 'EPS', 'CONDUITE']);
    expect(classe.enseignements.find((e) => e.matiere.code === 'MATH').coefficient).toBe(3);
    ctx.classe6A = classe;

    const suivante = await ctx.admin.post('/api/classes', { niveau: 'SIXIEME' });
    expect(suivante.body.classe.nom).toBe('6e B');
    ctx.classe6B = suivante.body.classe;
  });

  it('propose la LV2 au choix en 4e', async () => {
    const { classe } = (await ctx.admin.post('/api/classes', { niveau: 'QUATRIEME' })).body;
    const lv2 = classe.enseignements
      .filter((e) => e.groupeOption === 'LV2')
      .map((e) => e.matiere.code);
    expect(lv2.sort()).toEqual(['LV2-ALL', 'LV2-ESP']);
  });

  it('crée une terminale D avec ses coefficients de série', async () => {
    const reponse = await ctx.admin.post('/api/classes', {
      niveau: 'TERMINALE',
      serieId: ctx.serieD.id,
    });
    expect(reponse.status).toBe(201);
    const { classe } = reponse.body;
    expect(classe.nom).toBe('Tle D A');
    const coef = Object.fromEntries(
      classe.enseignements.map((e) => [e.matiere.code, e.coefficient]),
    );
    expect(coef).toMatchObject({ SVT: 5, MATH: 4, PCT: 4, PHILO: 2, CONDUITE: 1 });
  });

  it('exige une série au second cycle et refuse une série technique à un établissement général', async () => {
    expect((await ctx.admin.post('/api/classes', { niveau: 'SECONDE' })).body.erreur.code).toBe(
      'SERIE_REQUISE',
    );
    const technique = await ctx.admin.post('/api/classes', {
      niveau: 'SECONDE',
      serieId: ctx.serieF1.id,
    });
    expect(technique.status).toBe(400);
    expect(technique.body.erreur.code).toBe('SERIE_HORS_ORDRE');
  });

  it('permet d’ajouter une matière propre à l’établissement, en facultatif', async () => {
    const matiere = await ctx.admin.post('/api/matieres', { code: 'echecs', nom: 'Échecs' });
    expect(matiere.status).toBe(201);
    expect(matiere.body.matiere.code).toBe('ECHECS');
    const ajout = await ctx.admin.post(`/api/classes/${ctx.classe6A.id}/enseignements`, {
      matiereId: matiere.body.matiere.id,
      coefficient: 1,
      estFacultative: true,
    });
    expect(ajout.status).toBe(201);
    expect(ajout.body.enseignement.estFacultative).toBe(true);

    const coef = await ctx.admin.patch(`/api/enseignements/${ajout.body.enseignement.id}`, {
      coefficient: 2,
    });
    expect(coef.body.enseignement.coefficient).toBe(2);
    expect(
      (await ctx.admin.delete(`/api/enseignements/${ajout.body.enseignement.id}`)).status,
    ).toBe(204);
  });

  it('réserve la structure au responsable et laisse les enseignants consulter', async () => {
    expect((await ctx.secretariat.post('/api/classes', { niveau: 'SIXIEME' })).status).toBe(403);
    expect((await ctx.enseignant.get('/api/classes')).status).toBe(200);
    expect((await ctx.enseignant.post('/api/eleves', {})).status).toBe(403);
  });
});

describe('élèves et inscriptions', () => {
  const afi = {
    nom: 'dossou',
    prenoms: 'Afi',
    sexe: 'F',
    dateNaissance: '2014-03-12',
    telephoneContactParent: '97 00 11 22',
  };

  it('crée un élève avec identifiant EduRelevé, matricule automatique et inscription', async () => {
    const reponse = await ctx.secretariat.post('/api/eleves', {
      ...afi,
      classeId: ctx.classe6A.id,
    });
    expect(reponse.status).toBe(201);
    const { eleve } = reponse.body;
    expect(eleve.nom).toBe('DOSSOU');
    expect(normaliserIdentifiantEleve(eleve.identifiant)).toBe(eleve.identifiant);
    expect(eleve.matricule).toBe('2025-0001');
    expect(eleve.telephoneContactParent).toBe('+2290197001122');
    expect(eleve.inscriptions[0].classe.nom).toBe('6e A');
    ctx.afi = eleve;

    const second = await ctx.secretariat.post('/api/eleves', {
      nom: 'Hounsou',
      prenoms: 'Koffi',
      sexe: 'M',
      dateNaissance: '2013-09-05',
    });
    expect(second.body.eleve.matricule).toBe('2025-0002');
    ctx.koffi = second.body.eleve;
  });

  it('retrouve un élève par son identifiant ou son nom', async () => {
    const parId = await ctx.secretariat.get(
      `/api/eleves?recherche=${formaterIdentifiantEleve(ctx.afi.identifiant)}`,
    );
    expect(parId.body.eleves.map((e) => e.id)).toEqual([ctx.afi.id]);
    const sansClasse = await ctx.secretariat.get('/api/eleves?sansClasse=true');
    expect(sansClasse.body.eleves.map((e) => e.id)).toContain(ctx.koffi.id);
    expect(sansClasse.body.eleves.map((e) => e.id)).not.toContain(ctx.afi.id);
  });

  it('refuse une double inscription et permet de changer de classe', async () => {
    const doublon = await ctx.secretariat.post('/api/inscriptions', {
      eleveId: ctx.afi.id,
      classeId: ctx.classe6B.id,
    });
    expect(doublon.status).toBe(409);
    expect(doublon.body.erreur.message).toMatch(/6e A/);

    const inscriptionId = ctx.afi.inscriptions[0].id;
    const changement = await ctx.secretariat.patch(`/api/inscriptions/${inscriptionId}`, {
      classeId: ctx.classe6B.id,
    });
    expect(changement.body.inscription.classe.nom).toBe('6e B');
    await ctx.secretariat.patch(`/api/inscriptions/${inscriptionId}`, {
      classeId: ctx.classe6A.id,
    });
  });

  it('ne supprime pas une classe qui a des élèves', async () => {
    const reponse = await ctx.admin.delete(`/api/classes/${ctx.classe6A.id}`);
    expect(reponse.status).toBe(409);
    expect(reponse.body.erreur.code).toBe('CLASSE_UTILISEE');
  });

  it('crée les comptes d’une classe ; l’élève se connecte avec son identifiant', async () => {
    const reponse = await ctx.secretariat.post('/api/utilisateurs/comptes-classe', {
      classeId: ctx.classe6A.id,
    });
    expect(reponse.status).toBe(201);
    expect(reponse.body.fiches).toHaveLength(1);
    const [fiche] = reponse.body.fiches;
    expect(fiche.identifiant).toBe(ctx.afi.identifiant);

    // Saisie approximative de l'identifiant : minuscules et tiret acceptés
    const connexion = await request(app)
      .post('/api/auth/connexion')
      .send({
        identifiant: formaterIdentifiantEleve(fiche.identifiant).toLowerCase(),
        motDePasse: fiche.motDePasseTemporaire,
      });
    expect(connexion.status).toBe(200);
    expect(connexion.body.utilisateur).toMatchObject({
      role: 'ELEVE',
      doitChangerMotDePasse: true,
    });

    // Relance : aucun compte en double
    const relance = await ctx.secretariat.post('/api/utilisateurs/comptes-classe', {
      classeId: ctx.classe6A.id,
    });
    expect(relance.body.fiches).toHaveLength(0);
  });

  it('protège une fiche qui a un historique et supprime une fiche saisie par erreur', async () => {
    expect((await ctx.secretariat.delete(`/api/eleves/${ctx.afi.id}`)).status).toBe(409);
    expect((await ctx.secretariat.delete(`/api/eleves/${ctx.koffi.id}`)).status).toBe(204);
  });

  it('isole les classes et élèves des autres établissements', async () => {
    const autre = await creerEcole();
    const { jeton } = await connecter(await creerCompte('ADMIN_ECOLE', { ecoleId: autre.id }));
    expect((await api(jeton).get(`/api/classes/${ctx.classe6A.id}`)).status).toBe(404);
    expect((await api(jeton).get(`/api/eleves/${ctx.afi.id}`)).status).toBe(404);
    const inscription = await api(jeton).post('/api/inscriptions', {
      eleveId: ctx.afi.id,
      classeId: ctx.classe6A.id,
    });
    expect(inscription.status).toBe(404);
  });
});
