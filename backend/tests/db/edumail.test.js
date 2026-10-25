// EduMail : éligibilité, consentement, décisions, création idempotente chez le fournisseur
// (simulé), isolation des établissements, absence de secrets, réinitialisation, cycle de vie
// et règles garanties par la base.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { creerApp } from '../../src/app.js';
import {
  creerSimulation,
  remplacerFournisseurEduMail,
} from '../../src/contexts/edumail/fournisseurs.js';
import { verifierDossiers } from '../../src/contexts/edumail/serviceEduMail.js';
import {
  app,
  avecJeton,
  connecter,
  creerCompte,
  creerEcole,
  creerEleve,
  MOT_DE_PASSE,
  PDF,
  prisma,
  unique,
} from './aide.js';

const ctx = {};
const client = (jeton, application = app) => ({
  get: (url) => request(application).get(url).set(avecJeton(jeton)),
  post: (url, corps) => request(application).post(url).set(avecJeton(jeton)).send(corps),
  put: (url, corps) => request(application).put(url).set(avecJeton(jeton)).send(corps),
  delete: (url, corps) => request(application).delete(url).set(avecJeton(jeton)).send(corps),
  attestation: (url, champs, fichier) => {
    const r = request(application).post(url).set(avecJeton(jeton));
    for (const [k, v] of Object.entries(champs)) r.field(k, v);
    return fichier ? r.attach('fichier', fichier, 'attestation.pdf') : r;
  },
});
const compte = async (role, ecoleId) => {
  const c = await creerCompte(role, { ecoleId });
  return { compte: c, api: client((await connecter(c)).jeton) };
};

/** Année courante et classe d'un établissement (données de test). */
async function anneeEtClasse(ecoleId) {
  const an = new Date().getUTCFullYear();
  const annee = await prisma.anneeScolaire.create({
    data: {
      ecoleId,
      libelle: `${an - 1}-${an}`,
      dateDebut: new Date(`${an - 1}-09-01`),
      dateFin: new Date(`${an}-12-31`),
      estCourante: true,
    },
  });
  const classe = await prisma.classe.create({
    data: { ecoleId, anneeScolaireId: annee.id, niveau: 'TROISIEME', nom: `3e ${unique()}` },
  });
  return { annee, classe };
}

/** Élève avec un compte de connexion, inscrit (ou non) pour l'année en cours. */
async function eleveConnecte(ecole, { inscrit = true } = {}) {
  const fiche = await creerEleve(ecole.id);
  const c = await compte('ELEVE', ecole.id);
  await prisma.eleve.update({ where: { id: fiche.id }, data: { utilisateurId: c.compte.id } });
  let inscription = null;
  if (inscrit) {
    const { annee, classe } = ctx.scolarite.get(ecole.id);
    inscription = await prisma.inscription.create({
      data: {
        ecoleId: ecole.id,
        eleveId: fiche.id,
        classeId: classe.id,
        anneeScolaireId: annee.id,
      },
    });
  }
  return { ...c, fiche, inscription };
}

async function relierParent(parent, eleve) {
  await prisma.lienParentEleve.create({
    data: {
      ecoleId: eleve.fiche.ecoleId,
      parentId: parent.compte.id,
      eleveId: eleve.fiche.id,
      lien: 'MERE',
    },
  });
}

/** Demande + consentement du parent : dossier prêt pour la décision. */
async function dossierPret(eleve) {
  const d = await eleve.api.post('/api/edumail/moi/demande');
  await relierParent(ctx.parent, eleve);
  const c = await ctx.parent.api.put(`/api/edumail/parent/enfants/${eleve.fiche.id}/consentement`);
  // Le consentement du parent fait passer le dossier à la décision de l'établissement
  expect(c.body.compte.statut).toBe('EN_ATTENTE_DECISION');
  expect(c.body.consentement.donneParMoi).toBe(true);
  return d.body.compte.id;
}

const approuver = (api, id) =>
  api.post(`/api/edumail/ecole/dossiers/${id}/decision`, { decision: 'APPROUVER' });

beforeAll(async () => {
  ctx.simulation = creerSimulation();
  remplacerFournisseurEduMail(ctx.simulation);
  ctx.scolarite = new Map();
  ctx.ecole = await creerEcole();
  ctx.autreEcole = await creerEcole();
  ctx.ecoleNonVerifiee = await creerEcole({ statutVerification: 'EN_ATTENTE' });
  for (const e of [ctx.ecole, ctx.autreEcole, ctx.ecoleNonVerifiee])
    ctx.scolarite.set(e.id, await anneeEtClasse(e.id));
  ctx.admin = await compte('ADMIN_ECOLE', ctx.ecole.id);
  ctx.secretariat = await compte('SECRETARIAT', ctx.ecole.id);
  ctx.secretariat2 = await compte('SECRETARIAT', ctx.ecole.id);
  ctx.enseignant = await compte('ENSEIGNANT', ctx.ecole.id);
  ctx.autreAdmin = await compte('ADMIN_ECOLE', ctx.autreEcole.id);
  ctx.parent = await compte('PARENT', null);
  ctx.autreParent = await compte('PARENT', null);
  ctx.ministere = await compte('MINISTERE', null);
  ctx.superAdmin = await compte('SUPER_ADMIN', null);
});

afterAll(() => remplacerFournisseurEduMail(null));

describe('EduMail : demande et éligibilité', () => {
  it('un élève inscrit demande son compte ; la demande est rejouable', async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const r = await eleve.api.post('/api/edumail/moi/demande');
    expect(r.status).toBe(201);
    expect(r.body.compte.statut).toBe('EN_ATTENTE_CONSENTEMENT'); // politique « toujours »
    expect(r.body.compte.adresse).toBeNull();
    const rejeu = await eleve.api.post('/api/edumail/moi/demande');
    expect(rejeu.status).toBe(200);
    expect(rejeu.body.deja).toBe(true);
    expect(rejeu.body.compte.id).toBe(r.body.compte.id);
    expect(await prisma.eduMailCompte.count({ where: { eleveId: eleve.fiche.id } })).toBe(1);
  });

  it('sans inscription vérifiée, le dossier reste « à vérifier » et ne peut pas être approuvé', async () => {
    const eleve = await eleveConnecte(ctx.ecole, { inscrit: false });
    const r = await eleve.api.post('/api/edumail/moi/demande');
    expect(r.body.compte.statut).toBe('A_VERIFIER');
    const d = await approuver(ctx.admin.api, r.body.compte.id);
    expect(d.status).toBe(409);
    expect(d.body.erreur.code).toBe('INSCRIPTION_A_VERIFIER');
    const vue = await eleve.api.get('/api/edumail/moi');
    expect(vue.body.eligibilite.statut).toBe('A_VERIFIER');
  });

  it("l'élève d'un établissement non vérifié ne peut rien demander", async () => {
    const eleve = await eleveConnecte(ctx.ecoleNonVerifiee);
    // Connexion refusée (401) ou accès refusé (403) : aucun dossier dans les deux cas
    const r = await eleve.api.post('/api/edumail/moi/demande');
    expect([401, 403]).toContain(r.status);
    expect(await prisma.eduMailCompte.count({ where: { eleveId: eleve.fiche.id } })).toBe(0);
  });

  it('sans consentement validé, aucune approbation possible', async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const { body } = await eleve.api.post('/api/edumail/moi/demande');
    const d = await approuver(ctx.admin.api, body.compte.id);
    expect(d.status).toBe(409);
    expect(d.body.erreur.code).toBe('CONSENTEMENT_MANQUANT');
  });
});

describe('EduMail : nul ne s’accorde lui-même un compte', () => {
  it("l'élève ne peut ni décider ni consentir à la place du parent", async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const { body } = await eleve.api.post('/api/edumail/moi/demande');
    const id = body.compte.id;
    expect((await approuver(eleve.api, id)).status).toBe(403);
    expect(
      (await eleve.api.put(`/api/edumail/parent/enfants/${eleve.fiche.id}/consentement`)).status,
    ).toBe(403);
    expect((await eleve.api.post(`/api/edumail/ecole/dossiers/${id}/creation`)).status).toBe(403);
    // Un parent non relié à l'élève ne peut pas consentir
    const etranger = await ctx.autreParent.api.put(
      `/api/edumail/parent/enfants/${eleve.fiche.id}/consentement`,
    );
    expect(etranger.status).toBe(404);
    const apres = await prisma.eduMailCompte.findUnique({ where: { id } });
    expect(apres.statut).toBe('EN_ATTENTE_CONSENTEMENT');
  });

  it('le secrétariat ne décide pas sans délégation ; avec délégation, la décision est tracée', async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const id = await dossierPret(eleve);
    const refuse = await approuver(ctx.secretariat.api, id);
    expect(refuse.status).toBe(403);
    // Seule la direction peut accorder la délégation
    expect(
      (await ctx.secretariat.api.put('/api/edumail/ecole/delegation', { secretariat: true }))
        .status,
    ).toBe(403);
    await ctx.admin.api.put('/api/edumail/ecole/delegation', { secretariat: true });
    try {
      const r = await approuver(ctx.secretariat.api, id);
      expect(r.status).toBe(200);
      expect(r.body.dossier.decision.parDelegation).toBe(true);
      const types = r.body.evenements.map((e) => e.type);
      expect(types).toContain('APPROBATION_PAR_DELEGATION');
      const audit = await prisma.journalAudit.findMany({
        where: { entite: 'Ecole', entiteId: ctx.ecole.id, utilisateurId: ctx.admin.compte.id },
      });
      expect(audit.some((a) => a.nouvelleValeur?.edumailDelegationSecretariat === true)).toBe(true);
    } finally {
      await ctx.admin.api.put('/api/edumail/ecole/delegation', { secretariat: false });
    }
  });

  it('un refus exige un motif', async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const id = await dossierPret(eleve);
    const sans = await ctx.admin.api.post(`/api/edumail/ecole/dossiers/${id}/decision`, {
      decision: 'REFUSER',
    });
    expect(sans.status).toBe(400);
    const avec = await ctx.admin.api.post(`/api/edumail/ecole/dossiers/${id}/decision`, {
      decision: 'REFUSER',
      motif: 'Identité à confirmer',
    });
    expect(avec.body.dossier.statut).toBe('REFUSE');
    // L'élève voit le motif, puis peut redemander (nouveau dossier, même identifiant)
    const vue = await eleve.api.get('/api/edumail/moi');
    expect(vue.body.compte.motifDecision).toBe('Identité à confirmer');
    const nouvelle = await eleve.api.post('/api/edumail/moi/demande');
    expect(nouvelle.status).toBe(201);
    const dossiers = await prisma.eduMailCompte.findMany({ where: { eleveId: eleve.fiche.id } });
    expect(new Set(dossiers.map((d) => d.identifiantId)).size).toBe(1);
  });
});

describe('EduMail : approbation et création chez le fournisseur', () => {
  it('la direction approuve : compte créé, marqué simulé, audité', async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const id = await dossierPret(eleve);
    const r = await approuver(ctx.admin.api, id);
    expect(r.status).toBe(200);
    expect(r.body.dossier.statut).toBe('ACTIF');
    expect(r.body.dossier.simule).toBe(true);
    expect(r.body.dossier.adresse).toMatch(/^[0-9a-z]{10}@edumail\.test$/);
    // Adresse neutre : sans nom, matricule, identifiant ni téléphone
    const local = r.body.dossier.adresse.split('@')[0];
    for (const donnee of [eleve.fiche.nom, eleve.fiche.matricule, eleve.fiche.identifiant])
      expect(local).not.toContain(String(donnee).toLowerCase());
    const types = r.body.evenements.map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining(['DEMANDE', 'CONSENTEMENT_DONNE', 'APPROBATION', 'CREATION_REUSSIE']),
    );
    const audit = await prisma.journalAudit.findMany({
      where: { entite: 'EduMailCompte', entiteId: id },
    });
    expect(audit.map((a) => a.nouvelleValeur?.statut)).toEqual(
      expect.arrayContaining(['EN_ATTENTE_CONSENTEMENT', 'APPROUVE', 'ACTIF']),
    );
    const vue = await eleve.api.get('/api/edumail/moi');
    expect(vue.body.compte.statut).toBe('ACTIF');
    expect(vue.body.compte.simule).toBe(true);
    expect(vue.body.service.simulation).toBe(true);
  });

  it('sans fournisseur prêt, le dossier reste approuvé : rien n’est créé', async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const id = await dossierPret(eleve);
    remplacerFournisseurEduMail({
      ...creerSimulation(),
      nom: 'aucun',
      simule: false,
      etat: async () => ({
        pret: false,
        raison: 'Aucun fournisseur de messagerie n’est configuré.',
      }),
    });
    try {
      const r = await approuver(ctx.admin.api, id);
      expect(r.body.dossier.statut).toBe('APPROUVE');
      expect(r.body.creation.activee).toBe(false);
      expect(r.body.dossier.adresse).toBeNull();
    } finally {
      remplacerFournisseurEduMail(ctx.simulation);
    }
    // Le fournisseur configuré, la relance crée le compte
    const relance = await ctx.admin.api.post(`/api/edumail/ecole/dossiers/${id}/creation`);
    expect(relance.body.dossier.statut).toBe('ACTIF');
  });

  it('une panne du fournisseur laisse le dossier en erreur, sans détail technique pour l’élève', async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const id = await dossierPret(eleve);
    ctx.simulation._incident({
      operation: 'creerCompte',
      code: 'INDISPONIBLE',
      message: 'clé=secret-api',
    });
    const r = await approuver(ctx.admin.api, id);
    expect(r.body.dossier.statut).toBe('ERREUR');
    expect(r.body.creation.erreur.code).toBe('INDISPONIBLE');
    const vue = await eleve.api.get('/api/edumail/moi');
    expect(vue.body.compte.statut).toBe('ERREUR');
    expect(JSON.stringify(vue.body)).not.toContain('secret-api');
    expect(vue.body.compte).not.toHaveProperty('derniereErreur');
    // La relance aboutit
    const relance = await ctx.admin.api.post(`/api/edumail/ecole/dossiers/${id}/creation`);
    expect(relance.body.dossier.statut).toBe('ACTIF');
    expect(relance.body.dossier.tentatives).toBe(2);
  });

  it('une réponse perdue après création : la relance reprend le compte sans doublon', async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const id = await dossierPret(eleve);
    ctx.simulation._incident({ operation: 'creerCompte:apres', code: 'DELAI_DEPASSE' });
    const r = await approuver(ctx.admin.api, id);
    expect(r.body.dossier.statut).toBe('ERREUR');
    const relance = await ctx.admin.api.post(`/api/edumail/ecole/dossiers/${id}/creation`);
    expect(relance.body.dossier.statut).toBe('ACTIF');
    expect(relance.body.evenements.map((e) => e.type)).toContain('CREATION_REPRISE');
    const chezFournisseur = [...ctx.simulation._comptes.values()].filter((c) => c.cle === id);
    expect(chezFournisseur).toHaveLength(1);
    // Relancer un compte actif est refusé (pas de seconde création)
    const encore = await ctx.admin.api.post(`/api/edumail/ecole/dossiers/${id}/creation`);
    expect(encore.status).toBe(409);
  });

  it('deux relances simultanées ne créent qu’un compte', async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const id = await dossierPret(eleve);
    ctx.simulation._incident({ operation: 'creerCompte', code: 'INDISPONIBLE' });
    await approuver(ctx.admin.api, id);
    const [a, b] = await Promise.all([
      ctx.admin.api.post(`/api/edumail/ecole/dossiers/${id}/creation`),
      ctx.admin.api.post(`/api/edumail/ecole/dossiers/${id}/creation`),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect([...ctx.simulation._comptes.values()].filter((c) => c.cle === id)).toHaveLength(1);
  });

  it('une adresse occupée chez le fournisseur n’est jamais reprise par un autre élève', async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const id = await dossierPret(eleve);
    const { identifiant } = await prisma.eduMailCompte.findUnique({
      where: { id },
      include: { identifiant: true },
    });
    // Boîte existant déjà chez le fournisseur, créée par un autre dossier
    ctx.simulation._comptes.set('sim-occupe', {
      cle: 'autre-dossier',
      adresse: `${identifiant.partieLocale}@edumail.test`,
      statut: 'ACTIF',
    });
    // trouver() par adresse la renverrait : on l'écarte pour tester le contrôle de disponibilité
    const trouver = ctx.simulation.trouver;
    ctx.simulation.trouver = async ({ cle }) => trouver.call(ctx.simulation, { cle });
    try {
      const r = await approuver(ctx.admin.api, id);
      expect(r.body.dossier.statut).toBe('ERREUR');
      expect(r.body.creation.erreur.code).toBe('ADRESSE_INDISPONIBLE');
    } finally {
      ctx.simulation.trouver = trouver;
      ctx.simulation._comptes.delete('sim-occupe');
    }
  });
});

describe('EduMail : isolation et accès', () => {
  it("un établissement ne voit ni ne modifie les dossiers d'un autre", async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const { body } = await eleve.api.post('/api/edumail/moi/demande');
    const id = body.compte.id;
    expect((await ctx.autreAdmin.api.get(`/api/edumail/ecole/dossiers/${id}`)).status).toBe(404);
    expect((await approuver(ctx.autreAdmin.api, id)).status).toBe(404);
    const liste = await ctx.autreAdmin.api.get('/api/edumail/ecole');
    expect(liste.body.dossiers.map((d) => d.id)).not.toContain(id);
    expect(
      (
        await ctx.autreAdmin.api.post(`/api/edumail/ecole/dossiers/${id}/action`, {
          action: 'CLOTURER',
          motif: 'test',
        })
      ).status,
    ).toBe(404);
  });

  it('accès refusés : sans jeton, mauvais rôle, statistiques nationales', async () => {
    expect((await request(app).get('/api/edumail/moi')).status).toBe(401);
    expect((await ctx.enseignant.api.get('/api/edumail/ecole')).status).toBe(403);
    expect((await ctx.admin.api.get('/api/edumail/moi')).status).toBe(403);
    expect((await ctx.admin.api.get('/api/edumail/national')).status).toBe(403);
    const ministere = await ctx.ministere.api.get('/api/edumail/national');
    expect(ministere.status).toBe(200);
    expect(ministere.body.parStatut).toBeTypeOf('object');
    expect(ministere.body).not.toHaveProperty('erreursParEtablissement');
    const sa = await ctx.superAdmin.api.get('/api/edumail/national');
    expect(sa.body.erreursParEtablissement).toBeInstanceOf(Array);
  });

  it('les avantages numériques ne revendiquent aucun partenariat', async () => {
    const r = await ctx.enseignant.api.get('/api/edumail/avantages');
    expect(r.status).toBe(200);
    expect(r.body.avertissement).toBeTruthy();
    for (const s of r.body.services) {
      expect(s.statutConfiguration).toBe('INFORMATION');
      expect(s.url).toMatch(/^https:\/\//);
    }
  });

  it('les demandes sensibles sont limitées en fréquence', async () => {
    const appLimitee = creerApp({ edumail: { limite: 2 } });
    const eleve = await eleveConnecte(ctx.ecole);
    const api = client((await connecter(eleve.compte)).jeton, appLimitee);
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await api.post('/api/edumail/moi/demande')).status);
    expect(codes).toEqual([201, 200, 429]);
  });
});

describe('EduMail : consentement par attestation écrite', () => {
  it('preuve obligatoire, contrôlée par signature, vérifiée par une autre personne', async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const { body } = await eleve.api.post('/api/edumail/moi/demande');
    const id = body.compte.id;
    const url = `/api/edumail/ecole/dossiers/${id}/consentements`;
    const champs = {
      representantNom: 'HOUNSOU Afi',
      representantLien: 'MERE',
      signeLe: '2026-10-01',
    };
    expect((await ctx.secretariat.api.attestation(url, champs)).status).toBe(400);
    const faux = await ctx.secretariat.api.attestation(url, champs, Buffer.from('pas un pdf'));
    expect(faux.status).toBe(400);
    const r = await ctx.secretariat.api.attestation(url, champs, PDF);
    expect(r.status).toBe(201);
    const c = r.body.consentement.liste[0];
    expect(c.valable).toBe(false);
    expect(c.preuve).toBe(true);
    expect(r.body.dossier.statut).toBe('EN_ATTENTE_CONSENTEMENT');
    // La personne qui a saisi ne peut pas valider
    const meme = await ctx.secretariat.api.post(`${url}/${c.id}/validation`);
    expect(meme.status).toBe(409);
    const v = await ctx.secretariat2.api.post(`${url}/${c.id}/validation`);
    expect(v.body.consentement.obtenu).toBe(true);
    expect(v.body.dossier.statut).toBe('EN_ATTENTE_DECISION');
    // La preuve est servie en ligne, jamais en cache
    const preuve = await ctx.admin.api.get(`${url}/${c.id}/preuve`);
    expect(preuve.status).toBe(200);
    expect(preuve.headers['content-type']).toContain('application/pdf');
    // Correction : retrait motivé, le dossier repasse en attente
    const retrait = await ctx.admin.api.post(`${url}/${c.id}/retrait`, { motif: 'Mauvais élève' });
    expect(retrait.body.dossier.statut).toBe('EN_ATTENTE_CONSENTEMENT');
    expect(retrait.body.consentement.liste[0].retireLe).toBeTruthy();
  });
});

describe('EduMail : secrets et réinitialisation', () => {
  it('aucun identifiant externe ni secret dans les vues ; mot de passe temporaire remis une fois', async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const id = await dossierPret(eleve);
    await approuver(ctx.admin.api, id);
    const vue = await eleve.api.get('/api/edumail/moi');
    expect(JSON.stringify(vue.body)).not.toMatch(/sim-|idExterne|motDePasse/);

    const mauvais = await eleve.api.post('/api/edumail/moi/reinitialisation', {
      motDePasse: 'faux',
    });
    expect(mauvais.status).toBe(401);
    const bon = await eleve.api.post('/api/edumail/moi/reinitialisation', {
      motDePasse: MOT_DE_PASSE,
    });
    expect(bon.status).toBe(200);
    expect(bon.headers['cache-control']).toBe('no-store');
    const secret = bon.body.motDePasseTemporaire;
    expect(secret).toBeTruthy();

    // Le mot de passe temporaire n'est stocké nulle part
    const [evenements, audit, compteBase] = await Promise.all([
      prisma.eduMailEvenement.findMany({ where: { compteId: id } }),
      prisma.journalAudit.findMany({ where: { entiteId: id } }),
      prisma.eduMailCompte.findUnique({ where: { id } }),
    ]);
    expect(JSON.stringify([evenements, audit, compteBase])).not.toContain(secret);
    expect(evenements.map((e) => e.type)).toEqual(
      expect.arrayContaining(['REINITIALISATION_REFUSEE', 'REINITIALISATION']),
    );
    // Côté établissement : réservé à qui peut décider (le secrétariat sans délégation, non)
    const url = `/api/edumail/ecole/dossiers/${id}/reinitialisation`;
    expect((await ctx.secretariat.api.post(url)).status).toBe(403);
    const parDirection = await ctx.admin.api.post(url);
    expect(parDirection.status).toBe(200);
    expect(parDirection.body.motDePasseTemporaire).toBeTruthy();
  });

  it("la direction peut réinitialiser ; un compte non actif ne l'est jamais", async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const { body } = await eleve.api.post('/api/edumail/moi/demande');
    const attente = await ctx.admin.api.post(
      `/api/edumail/ecole/dossiers/${body.compte.id}/reinitialisation`,
    );
    expect(attente.status).toBe(409);
    expect(
      (await eleve.api.post('/api/edumail/moi/reinitialisation', { motDePasse: MOT_DE_PASSE }))
        .status,
    ).toBe(409);
  });
});

describe('EduMail : cycle de vie', () => {
  it('suspension, réactivation et clôture : direction seule, motif obligatoire, adresse conservée', async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const id = await dossierPret(eleve);
    const { body } = await approuver(ctx.admin.api, id);
    const adresse = body.dossier.adresse;
    const idExterne = body.dossier.referenceFournisseur;
    const action = (api, a, motif) =>
      api.post(`/api/edumail/ecole/dossiers/${id}/action`, { action: a, ...(motif && { motif }) });

    expect((await action(ctx.admin.api, 'SUSPENDRE')).status).toBe(400);
    expect((await action(ctx.secretariat.api, 'SUSPENDRE', 'Usage abusif')).status).toBe(403);
    const s = await action(ctx.admin.api, 'SUSPENDRE', 'Usage abusif');
    expect(s.body.dossier.statut).toBe('SUSPENDU');
    expect(await ctx.simulation.statut(idExterne)).toBe('SUSPENDU');
    const vue = await eleve.api.get('/api/edumail/moi');
    expect(vue.body.compte.motifSuspension).toBe('Usage abusif');

    // Échec du fournisseur : le statut ne change pas
    ctx.simulation._incident({ operation: 'reactiver', code: 'INDISPONIBLE' });
    const echec = await action(ctx.admin.api, 'REACTIVER', 'Fin de sanction');
    expect(echec.status).toBe(502);
    expect((await prisma.eduMailCompte.findUnique({ where: { id } })).statut).toBe('SUSPENDU');

    expect((await action(ctx.admin.api, 'REACTIVER', 'Fin de sanction')).body.dossier.statut).toBe(
      'ACTIF',
    );
    const c = await action(ctx.admin.api, 'CLOTURER', 'Départ de l’établissement');
    expect(c.body.dossier.statut).toBe('CLOTURE');
    expect(c.body.dossier.adresse).toBe(adresse);
    // Désactivé chez le fournisseur, jamais supprimé
    expect(await ctx.simulation.statut(idExterne)).toBe('CLOTURE');
    // Un compte clôturé n'est ni rouvert ni recréé automatiquement
    expect((await action(ctx.admin.api, 'REACTIVER', 'test')).status).toBe(409);
    const redemande = await eleve.api.post('/api/edumail/moi/demande');
    expect(redemande.status).toBe(409);
    expect(redemande.body.erreur.code).toBe('COMPTE_CLOTURE');
  });

  it('retrait du consentement ou fin d’inscription : signalé à réexaminer, jamais suspendu automatiquement', async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const id = await dossierPret(eleve);
    await approuver(ctx.admin.api, id);
    await ctx.parent.api.delete(`/api/edumail/parent/enfants/${eleve.fiche.id}/consentement`, {
      motif: 'Je retire mon accord',
    });
    let compteBase = await prisma.eduMailCompte.findUnique({ where: { id } });
    expect(compteBase.statut).toBe('ACTIF');
    expect(compteBase.aReexaminer).toBe('CONSENTEMENT_RETIRE');
    const liste = await ctx.admin.api.get('/api/edumail/ecole?reexaminer=true');
    expect(liste.body.dossiers.map((d) => d.id)).toContain(id);
    await ctx.admin.api.post(`/api/edumail/ecole/dossiers/${id}/reexamen`, {
      note: 'Vu avec la famille',
    });
    expect((await prisma.eduMailCompte.findUnique({ where: { id } })).aReexaminer).toBeNull();

    // Fin d'inscription : la vérification périodique signale, sans suspendre
    await prisma.inscription.update({
      where: { id: eleve.inscription.id },
      data: { statut: 'TRANSFERE' },
    });
    await verifierDossiers();
    compteBase = await prisma.eduMailCompte.findUnique({ where: { id } });
    expect(compteBase.statut).toBe('ACTIF');
    expect(compteBase.aReexaminer).toBe('PLUS_INSCRIT');
  });

  it("signalement de l'élève traité par le secrétariat", async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    await eleve.api.post('/api/edumail/moi/demande');
    const s = await eleve.api.post('/api/edumail/moi/signalements', {
      categorie: 'IDENTITE',
      message: 'Mon prénom est mal orthographié',
    });
    expect(s.status).toBe(201);
    const liste = await ctx.secretariat.api.get('/api/edumail/ecole/signalements?statut=OUVERT');
    const trouve = liste.body.signalements.find((x) => x.id === s.body.signalement.id);
    expect(trouve).toBeTruthy();
    expect(trouve).not.toHaveProperty('auteurId');
    const t = await request(app)
      .patch(`/api/edumail/ecole/signalements/${trouve.id}`)
      .set(avecJeton((await connecter(ctx.secretariat.compte)).jeton))
      .send({ statut: 'TRAITE', reponse: 'Fiche corrigée' });
    expect(t.body.signalement.statut).toBe('TRAITE');
    // Un autre établissement ne peut pas le traiter
    const autre = await request(app)
      .patch(`/api/edumail/ecole/signalements/${trouve.id}`)
      .set(avecJeton((await connecter(ctx.autreAdmin.compte)).jeton))
      .send({ statut: 'REJETE', reponse: 'x' });
    expect(autre.status).toBe(404);
  });
});

describe('EduMail : règles garanties par la base', () => {
  let actif;
  beforeAll(async () => {
    const eleve = await eleveConnecte(ctx.ecole);
    const id = await dossierPret(eleve);
    await approuver(ctx.admin.api, id);
    actif = await prisma.eduMailCompte.findUnique({
      where: { id },
      include: { identifiant: true },
    });
    ctx.eleveActif = eleve;
  });

  it("l'identifiant et l'adresse sont immuables et jamais réattribués", async () => {
    await expect(
      prisma.eduMailIdentifiant.update({
        where: { id: actif.identifiantId },
        data: { partieLocale: 'autrechose' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.eduMailIdentifiant.delete({ where: { id: actif.identifiantId } }),
    ).rejects.toThrow();
    await expect(
      prisma.eduMailCompte.update({
        where: { id: actif.id },
        data: { adresse: 'zzzzzzzzzz@edumail.test' },
      }),
    ).rejects.toThrow();
    // Un autre élève ne peut pas recevoir la même partie locale
    const autre = await creerEleve(ctx.ecole.id);
    await expect(
      prisma.eduMailIdentifiant.create({
        data: {
          ecoleId: ctx.ecole.id,
          eleveId: autre.id,
          partieLocale: actif.identifiant.partieLocale,
        },
      }),
    ).rejects.toThrow();
  });

  it('pas de suppression, pas de compte actif sans adresse, historique en ajout seul', async () => {
    await expect(prisma.eduMailCompte.delete({ where: { id: actif.id } })).rejects.toThrow();
    const ev = await prisma.eduMailEvenement.findFirst({ where: { compteId: actif.id } });
    await expect(
      prisma.eduMailEvenement.update({ where: { id: ev.id }, data: { motif: 'modifié' } }),
    ).rejects.toThrow();
    // Second dossier ouvert pour le même élève refusé
    await expect(
      prisma.eduMailCompte.create({
        data: {
          ecoleId: ctx.ecole.id,
          eleveId: actif.eleveId,
          identifiantId: actif.identifiantId,
          demandeurId: ctx.eleveActif.compte.id,
          statut: 'EN_ATTENTE_DECISION',
        },
      }),
    ).rejects.toThrow();
    // Un statut final ne se rouvre pas
    const eleve = await eleveConnecte(ctx.ecole);
    const id = await dossierPret(eleve);
    await ctx.admin.api.post(`/api/edumail/ecole/dossiers/${id}/decision`, {
      decision: 'REFUSER',
      motif: 'Test',
    });
    await expect(
      prisma.eduMailCompte.update({ where: { id }, data: { statut: 'EN_ATTENTE_DECISION' } }),
    ).rejects.toThrow();
  });

  it('une attestation sans preuve ou validée par son auteur est refusée par la base', async () => {
    await expect(
      prisma.eduMailConsentement.create({
        data: {
          ecoleId: ctx.ecole.id,
          compteId: actif.id,
          mode: 'ATTESTATION_ECRITE',
          representantNom: 'X',
          signeLe: new Date(),
          recueilliParId: ctx.secretariat.compte.id,
          methode: 'ATTESTATION_ECRITE_SIGNEE',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.eduMailConsentement.create({
        data: {
          ecoleId: ctx.ecole.id,
          compteId: actif.id,
          mode: 'ATTESTATION_ECRITE',
          representantNom: 'X',
          signeLe: new Date(),
          recueilliParId: ctx.secretariat.compte.id,
          valideParId: ctx.secretariat.compte.id,
          valideLe: new Date(),
          methode: 'ATTESTATION_ECRITE_SIGNEE',
          preuveChemin: 'edumail/x.pdf',
          preuveEmpreinte: 'a'.repeat(64),
        },
      }),
    ).rejects.toThrow();
  });
});
