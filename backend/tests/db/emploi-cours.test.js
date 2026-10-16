// Phase 8 : emplois du temps (conflits, appel par créneau), cours en ligne et devoirs,
// accès élève et parent, règles garanties par la base.
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
  PDF,
  prisma,
} from './aide.js';

const ctx = {};
const client = (jeton) => ({
  get: (url) => request(app).get(url).set(avecJeton(jeton)),
  post: (url, corps) => request(app).post(url).set(avecJeton(jeton)).send(corps),
  put: (url, corps) => request(app).put(url).set(avecJeton(jeton)).send(corps),
  patch: (url, corps) => request(app).patch(url).set(avecJeton(jeton)).send(corps),
  delete: (url) => request(app).delete(url).set(avecJeton(jeton)),
  multipart: (url) => request(app).post(url).set(avecJeton(jeton)),
});
const aujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Porto-Novo' }).format(
  new Date(),
);
const jourSemaine = ((new Date(`${aujourdhui}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

beforeAll(async () => {
  await chargerReferentiel();
  ctx.ecole = await creerEcole();
  const compte = async (role, ecoleId = ctx.ecole.id) => {
    const c = await creerCompte(role, { ecoleId });
    return { compte: c, api: client((await connecter(c)).jeton) };
  };
  ctx.admin = await compte('ADMIN_ECOLE');
  ctx.secretariat = await compte('SECRETARIAT');
  ctx.prof = await compte('ENSEIGNANT');
  ctx.autreProf = await compte('ENSEIGNANT');
  ctx.autreEcole = await creerEcole();
  ctx.autreAdmin = await compte('ADMIN_ECOLE', ctx.autreEcole.id);

  const an = new Date().getUTCFullYear();
  const { annee } = (
    await ctx.admin.api.post('/api/annees', {
      libelle: `${an - 1}-${an}`,
      dateDebut: `${an - 1}-09-01`,
      dateFin: `${an}-12-31`,
    })
  ).body;
  ctx.annee = annee;
  ctx.classeA = (await ctx.admin.api.post('/api/classes', { niveau: 'TROISIEME' })).body.classe;
  ctx.classeB = (await ctx.admin.api.post('/api/classes', { niveau: 'TROISIEME' })).body.classe;
  ctx.mathA = ctx.classeA.enseignements.find((e) => e.matiere.code === 'MATH');
  ctx.frA = ctx.classeA.enseignements.find((e) => e.matiere.code === 'FR');
  ctx.mathB = ctx.classeB.enseignements.find((e) => e.matiere.code === 'MATH');
  for (const e of [ctx.mathA, ctx.mathB]) {
    await ctx.admin.api.patch(`/api/enseignements/${e.id}`, { enseignantId: ctx.prof.compte.id });
  }
  await ctx.admin.api.patch(`/api/enseignements/${ctx.frA.id}`, {
    enseignantId: ctx.autreProf.compte.id,
  });

  ctx.eleve = await creerEleve(ctx.ecole.id);
  await prisma.inscription.create({
    data: {
      ecoleId: ctx.ecole.id,
      eleveId: ctx.eleve.id,
      classeId: ctx.classeA.id,
      anneeScolaireId: annee.id,
    },
  });
  const compteEleve = await creerCompte('ELEVE', { ecoleId: ctx.ecole.id });
  await prisma.eleve.update({
    where: { id: ctx.eleve.id },
    data: { utilisateurId: compteEleve.id },
  });
  ctx.eleveApi = client((await connecter(compteEleve)).jeton);

  const parent = await creerCompte('PARENT');
  await prisma.lienParentEleve.create({
    data: { ecoleId: ctx.ecole.id, parentId: parent.id, eleveId: ctx.eleve.id, lien: 'PERE' },
  });
  ctx.parentApi = client((await connecter(parent)).jeton);
});

const creneau = (api, corps) =>
  api.post('/api/creneaux', { jour: 1, heureDebut: '08:00', heureFin: '10:00', ...corps });

describe('emploi du temps', () => {
  it('planifie une classe et refuse les conflits', async () => {
    expect((await creneau(ctx.prof.api, { enseignementId: ctx.mathA.id })).status).toBe(403);

    const maths = await creneau(ctx.secretariat.api, {
      enseignementId: ctx.mathA.id,
      salle: 'B12',
    });
    expect(maths.status).toBe(201);
    expect(maths.body.creneau).toMatchObject({ jour: 1, heureDebut: '08:00', heureFin: '10:00' });
    ctx.creneauMaths = maths.body.creneau;

    // Même classe, horaire qui chevauche
    const classe = await creneau(ctx.secretariat.api, {
      enseignementId: ctx.frA.id,
      heureDebut: '09:00',
      heureFin: '11:00',
    });
    expect(classe.status).toBe(409);
    expect(classe.body.erreur.details.conflits[0].motif).toBe('CLASSE');

    // Même enseignant dans une autre classe
    const enseignant = await creneau(ctx.secretariat.api, {
      enseignementId: ctx.mathB.id,
      heureDebut: '09:30',
      heureFin: '10:30',
    });
    expect(enseignant.body.erreur.message).toMatch(/L’enseignant a déjà cours en/);

    // Même salle occupée
    const salle = await creneau(ctx.secretariat.api, {
      enseignementId: ctx.classeB.enseignements.find((e) => e.matiere.code === 'FR').id,
      salle: 'b12',
    });
    expect(salle.body.erreur.message).toMatch(/La salle B12 est occupée/);

    // Bout à bout : accepté
    const suite = await creneau(ctx.secretariat.api, {
      enseignementId: ctx.frA.id,
      heureDebut: '10:00',
      heureFin: '12:00',
    });
    expect(suite.status).toBe(201);

    expect(
      (
        await creneau(ctx.secretariat.api, {
          enseignementId: ctx.frA.id,
          heureDebut: '12:00',
          heureFin: '11:00',
        })
      ).body.erreur.code,
    ).toBe('HORAIRE_INVALIDE');
  });

  it('montre l’emploi du temps de la classe, de l’enseignant, de l’élève et du parent', async () => {
    const classe = await ctx.prof.api.get(`/api/emplois-du-temps/classes/${ctx.classeA.id}`);
    expect(classe.body.creneaux.map((c) => [c.heureDebut, c.code])).toEqual([
      ['08:00', 'MATH'],
      ['10:00', 'FR'],
    ]);
    const prof = await ctx.prof.api.get('/api/emplois-du-temps/moi');
    expect(prof.body.creneaux.map((c) => c.classe.nom)).toEqual([ctx.classeA.nom]);

    const eleve = await ctx.eleveApi.get('/api/moi/emploi-du-temps');
    expect(eleve.body.creneaux).toHaveLength(2);
    const parent = await ctx.parentApi.get(`/api/parent/enfants/${ctx.eleve.id}/emploi-du-temps`);
    expect(parent.body.creneaux[0]).toMatchObject({ matiere: 'Mathématiques', salle: 'B12' });

    expect(
      (await ctx.autreAdmin.api.get(`/api/emplois-du-temps/classes/${ctx.classeA.id}`)).status,
    ).toBe(404);
  });

  it('modifie un créneau en contrôlant toujours les conflits', async () => {
    const deplace = await ctx.secretariat.api.patch(`/api/creneaux/${ctx.creneauMaths.id}`, {
      heureDebut: '07:00',
      heureFin: '09:00',
    });
    expect(deplace.body.creneau.heureDebut).toBe('07:00');
    const conflit = await ctx.secretariat.api.patch(`/api/creneaux/${ctx.creneauMaths.id}`, {
      heureFin: '10:30',
    });
    expect(conflit.status).toBe(409);
  });

  it('propose les cours du jour à l’appel et garde un créneau déjà utilisé', async () => {
    if (jourSemaine > 6) return; // dimanche : pas de cours
    const { creneau: duJour } = (
      await creneau(ctx.secretariat.api, {
        enseignementId: ctx.mathA.id,
        jour: jourSemaine,
        heureDebut: '15:00',
        heureFin: '16:00',
      })
    ).body;
    const feuille = await ctx.prof.api.get(
      `/api/appels?classeId=${ctx.classeA.id}&date=${aujourdhui}&heureDebut=15:00`,
    );
    expect(feuille.body.creneaux.map((c) => c.id)).toContain(duJour.id);

    const appel = await ctx.prof.api.put('/api/appels', {
      classeId: ctx.classeA.id,
      date: aujourdhui,
      heureDebut: '07:00', // remplacé par l'horaire du créneau
      creneauId: duJour.id,
      presences: [],
    });
    expect(appel.body.heureDebut).toBe('15:00');
    const enregistre = await prisma.appel.findFirst({ where: { creneauId: duJour.id } });
    expect(enregistre.enseignementId).toBe(ctx.mathA.id);

    // Supprimé de l'emploi du temps, il reste attaché à l'appel (clos, pas effacé)
    const suppression = await ctx.secretariat.api.delete(`/api/creneaux/${duJour.id}`);
    expect(suppression.body.archive).toBe(true);
    const sansCours = await ctx.prof.api.get(
      `/api/appels?classeId=${ctx.classeA.id}&date=${aujourdhui}&heureDebut=15:00`,
    );
    expect(sansCours.body.creneaux.map((c) => c.id)).not.toContain(duJour.id);
  });
});

describe('cours en ligne', () => {
  it('l’enseignant de la matière publie un PDF ou une vidéo', async () => {
    const pdf = await ctx.prof.api
      .multipart('/api/cours')
      .field('enseignementId', ctx.mathA.id)
      .field('titre', 'Théorème de Thalès')
      .field('type', 'DOCUMENT')
      .attach('fichier', PDF, 'thales.pdf');
    expect(pdf.status).toBe(201);
    expect(pdf.body.cours.fichier).toMatchObject({
      nom: 'thales.pdf',
      typeMime: 'application/pdf',
    });
    ctx.coursPdf = pdf.body.cours;

    const video = await ctx.prof.api
      .multipart('/api/cours')
      .field('enseignementId', ctx.mathA.id)
      .field('titre', 'Vidéo : les fonctions affines')
      .field('type', 'VIDEO')
      .field('url', 'https://www.youtube.com/watch?v=abc');
    expect(video.status).toBe(201);

    const http = await ctx.prof.api
      .multipart('/api/cours')
      .field('enseignementId', ctx.mathA.id)
      .field('titre', 'Lien non sécurisé')
      .field('type', 'LIEN')
      .field('url', 'http://exemple.bj');
    expect(http.status).toBe(400);

    // Un faux PDF (contenu texte) est refusé
    const faux = await ctx.prof.api
      .multipart('/api/cours')
      .field('enseignementId', ctx.mathA.id)
      .field('titre', 'Faux')
      .field('type', 'DOCUMENT')
      .attach('fichier', Buffer.from('<script>alert(1)</script>'), 'cours.pdf');
    expect(faux.body.erreur.code).toBe('FICHIER_INVALIDE');

    // Un autre enseignant ne publie pas dans cette matière
    const autre = await ctx.autreProf.api
      .multipart('/api/cours')
      .field('enseignementId', ctx.mathA.id)
      .field('titre', 'Intrusion')
      .field('type', 'VIDEO')
      .field('url', 'https://exemple.bj');
    expect(autre.status).toBe(403);
  });

  it('l’élève et le parent consultent les cours de la classe', async () => {
    const eleve = await ctx.eleveApi.get('/api/moi/cours');
    expect(eleve.body.cours.map((c) => c.titre)).toEqual([
      'Vidéo : les fonctions affines',
      'Théorème de Thalès',
    ]);
    const fichier = await ctx.eleveApi.get(`/api/moi/cours/${ctx.coursPdf.id}/fichier`);
    expect(fichier.status).toBe(200);
    expect(fichier.headers['content-security-policy']).toMatch(/sandbox/);
    const parent = await ctx.parentApi.get(
      `/api/parent/enfants/${ctx.eleve.id}/cours/${ctx.coursPdf.id}/fichier`,
    );
    expect(parent.status).toBe(200);
  });

  it('un cours d’une autre classe reste inaccessible à l’élève', async () => {
    const { body } = await ctx.prof.api
      .multipart('/api/cours')
      .field('enseignementId', ctx.mathB.id)
      .field('titre', 'Cours de la classe B')
      .field('type', 'DOCUMENT')
      .attach('fichier', PDF, 'b.pdf');
    expect((await ctx.eleveApi.get(`/api/moi/cours/${body.cours.id}/fichier`)).status).toBe(404);
    expect((await ctx.eleveApi.get('/api/moi/cours')).body.cours).toHaveLength(2);
  });

  it('l’auteur retire un cours', async () => {
    expect((await ctx.autreProf.api.delete(`/api/cours/${ctx.coursPdf.id}`)).status).toBe(403);
    expect((await ctx.prof.api.delete(`/api/cours/${ctx.coursPdf.id}`)).body.retire).toBe(true);
    expect((await ctx.eleveApi.get('/api/moi/cours')).body.cours).toHaveLength(1);
  });
});

describe('devoirs', () => {
  it('l’enseignant donne un devoir, l’élève le coche, le parent et l’enseignant le voient', async () => {
    const demain = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    const devoir = await ctx.prof.api
      .multipart('/api/devoirs')
      .field('enseignementId', ctx.mathA.id)
      .field('titre', 'Exercices 4 à 7 page 52')
      .field('consignes', 'Rédiger proprement sur le cahier.')
      .field('pourLe', demain)
      .attach('fichier', PDF, 'exercices.pdf');
    expect(devoir.status).toBe(201);
    ctx.devoir = devoir.body.devoir;

    const liste = await ctx.eleveApi.get('/api/moi/devoirs');
    expect(liste.body.devoirs[0]).toMatchObject({
      titre: 'Exercices 4 à 7 page 52',
      fait: false,
      pourLe: demain,
    });

    // Rejouable : deux fois « fait » ne crée qu'une ligne
    for (let i = 0; i < 2; i++) {
      expect(
        (await ctx.eleveApi.put(`/api/moi/devoirs/${ctx.devoir.id}/fait`, { fait: true })).body
          .fait,
      ).toBe(true);
    }
    const parent = await ctx.parentApi.get(`/api/parent/enfants/${ctx.eleve.id}/devoirs`);
    expect(parent.body.devoirs[0].fait).toBe(true);
    const prof = await ctx.prof.api.get(`/api/enseignements/${ctx.mathA.id}/devoirs`);
    expect(prof.body.devoirs[0]).toMatchObject({ faits: 1, effectif: 1 });

    await ctx.eleveApi.put(`/api/moi/devoirs/${ctx.devoir.id}/fait`, { fait: false });
    expect((await ctx.eleveApi.get('/api/moi/devoirs')).body.devoirs[0].fait).toBe(false);

    const fichier = await ctx.parentApi.get(
      `/api/parent/enfants/${ctx.eleve.id}/devoirs/${ctx.devoir.id}/fichier`,
    );
    expect(fichier.status).toBe(200);
  });

  it('le parent ne voit que la classe de son enfant', async () => {
    const autre = await creerEleve(ctx.ecole.id);
    expect((await ctx.parentApi.get(`/api/parent/enfants/${autre.id}/devoirs`)).status).toBe(404);
  });

  it('l’enseignant retire un devoir (les coches suivent)', async () => {
    await ctx.eleveApi.put(`/api/moi/devoirs/${ctx.devoir.id}/fait`, { fait: true });
    expect((await ctx.prof.api.delete(`/api/devoirs/${ctx.devoir.id}`)).body.retire).toBe(true);
    expect(await prisma.devoirFait.count({ where: { devoirId: ctx.devoir.id } })).toBe(0);
  });
});

describe('règles garanties par la base', () => {
  it('une classe n’a jamais deux cours en même temps', async () => {
    const existant = await prisma.creneauEmploiDuTemps.findFirst({
      where: { classeId: ctx.classeA.id, valideAu: null },
    });
    await expect(
      prisma.creneauEmploiDuTemps.create({
        data: {
          ecoleId: ctx.ecole.id,
          classeId: ctx.classeA.id,
          enseignementId: ctx.frA.id,
          jour: existant.jour,
          heureDebut: existant.heureDebut,
          heureFin: existant.heureFin,
          valideDu: existant.valideDu,
        },
      }),
    ).rejects.toThrow(/déjà un cours sur ce créneau/);
  });

  it('un cours est un document ou un lien https', async () => {
    await expect(
      prisma.cours.create({
        data: {
          ecoleId: ctx.ecole.id,
          enseignementId: ctx.mathA.id,
          titre: 'Incohérent',
          type: 'VIDEO',
          url: 'javascript:alert(1)',
        },
      }),
    ).rejects.toThrow(/cours_url_https/);
    await expect(
      prisma.cours.create({
        data: {
          ecoleId: ctx.ecole.id,
          enseignementId: ctx.mathA.id,
          titre: 'Sans fichier',
          type: 'DOCUMENT',
        },
      }),
    ).rejects.toThrow(/cours_contenu_selon_type/);
  });
});
