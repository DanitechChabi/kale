// EduCourses : catalogue public, profils (élève automatique, parent), leçons, quiz
// corrigé côté serveur, avancement, ouverture de compte et offre payante.
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { definirOffrePayante } from '../../src/contexts/educourses/serviceEduCourses.js';
import {
  app,
  avecJeton,
  chargerReferentiel,
  connecter,
  creerCompte,
  creerEcole,
  creerEleve,
  prisma,
  unique,
} from './aide.js';

const ctx = {};
const client = (jeton) => ({
  get: (url) => request(app).get(url).set(avecJeton(jeton)),
  post: (url, corps) => request(app).post(url).set(avecJeton(jeton)).send(corps),
  put: (url, corps) => request(app).put(url).set(avecJeton(jeton)).send(corps),
  patch: (url, corps) => request(app).patch(url).set(avecJeton(jeton)).send(corps),
  delete: (url) => request(app).delete(url).set(avecJeton(jeton)),
});
const telephoneUnique = () => `+22901${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;

const QUIZ = [
  {
    question: '<p>2 + 2 ?</p>',
    choix: ['<p>3</p>', '<p>4</p>'],
    bonne: 1,
    explication: '<p>Quatre.</p>',
  },
  { question: '<p>3 × 3 ?</p>', choix: ['<p>9</p>', '<p>6</p>'], bonne: 0, explication: null },
];

/** Programme de test (Quatrième) : 1 chapitre, 2 leçons rédigées et 1 à rédiger. */
async function creerProgramme(niveau = 'QUATRIEME', series = []) {
  const programme = await prisma.ecProgramme.create({
    data: {
      cle: `${niveau}|T${unique()}|${series.join('+')}`,
      niveau,
      series,
      matiereCode: 'MATH',
      nomMatiere: 'Mathématiques (test)',
      confiance: 'RECOUPE',
      sources: [],
      ordre: 999,
      chapitres: { create: { ordre: 1, titre: 'Calcul' } },
    },
    include: { chapitres: true },
  });
  const chapitreId = programme.chapitres[0].id;
  const lecons = [];
  for (const ordre of [1, 2, 3]) {
    lecons.push(
      await prisma.ecLecon.create({
        data: {
          chapitreId,
          ordre,
          titre: `Leçon ${ordre}`,
          objectifs: ['Calculer'],
          ...(ordre < 3 && {
            duree: 45,
            contenuHtml: '<p>Cours</p>',
            exercices: [
              {
                titre: 'Exercice 1',
                niveau: 'facile',
                enonceHtml: '<p>E</p>',
                corrigeHtml: '<p>C</p>',
              },
            ],
            quiz: QUIZ,
            redigeeLe: new Date(),
          }),
        },
      }),
    );
  }
  return { programme, lecons };
}

beforeAll(async () => {
  await chargerReferentiel();
  ctx.ecole = await creerEcole();
  const admin = await creerCompte('ADMIN_ECOLE', { ecoleId: ctx.ecole.id });
  const apiAdmin = client((await connecter(admin)).jeton);
  const an = new Date().getUTCFullYear();
  const { annee } = (
    await apiAdmin.post('/api/annees', {
      libelle: `${an - 1}-${an}`,
      dateDebut: `${an - 1}-09-01`,
      dateFin: `${an}-12-31`,
    })
  ).body;
  const { classe } = (await apiAdmin.post('/api/classes', { niveau: 'QUATRIEME' })).body;

  // Élève avec un compte, et un parent relié
  const eleve = await creerEleve(ctx.ecole.id);
  const compteEleve = await creerCompte('ELEVE', { ecoleId: ctx.ecole.id });
  await prisma.eleve.update({
    where: { id: eleve.id },
    data: { utilisateurId: compteEleve.id, prenoms: 'Sèna Marie' },
  });
  await prisma.inscription.create({
    data: {
      ecoleId: ctx.ecole.id,
      eleveId: eleve.id,
      classeId: classe.id,
      anneeScolaireId: annee.id,
    },
  });
  const parent = await creerCompte('PARENT');
  await prisma.lienParentEleve.create({
    data: { ecoleId: ctx.ecole.id, parentId: parent.id, eleveId: eleve.id, lien: 'MERE' },
  });
  const autreParent = await creerCompte('PARENT');

  ctx.eleve = eleve;
  ctx.apiEleve = client((await connecter(compteEleve)).jeton);
  ctx.apiParent = client((await connecter(parent)).jeton);
  ctx.apiAutreParent = client((await connecter(autreParent)).jeton);
  ctx.apiProf = client(
    (await connecter(await creerCompte('ENSEIGNANT', { ecoleId: ctx.ecole.id }))).jeton,
  );
  Object.assign(ctx, await creerProgramme());
});

afterEach(() => {
  definirOffrePayante(false);
});

describe('catalogue public', () => {
  it('liste les matières par niveau et le plan d’un programme, sans compte', async () => {
    const reponse = await request(app).get('/api/educourses/catalogue');
    expect(reponse.status).toBe(200);
    expect(reponse.body.niveaux.map((n) => n.niveau)).toContain('TERMINALE');
    const quatrieme = reponse.body.niveaux.find((n) => n.niveau === 'QUATRIEME');
    expect(quatrieme.programmes.find((p) => p.id === ctx.programme.id)).toMatchObject({
      lecons: 3,
      redigees: 2,
    });

    const plan = await request(app).get(`/api/educourses/programmes/${ctx.programme.id}`);
    expect(plan.body.programme.chapitres[0].lecons.map((l) => l.redigee)).toEqual([
      true,
      true,
      false,
    ]);
    expect(JSON.stringify(plan.body)).not.toContain('Cours'); // pas de contenu sans compte
  });

  it('refuse les leçons sans compte', async () => {
    const reponse = await request(app).get(`/api/educourses/lecons/${ctx.lecons[0].id}`);
    expect(reponse.status).toBe(401);
  });
});

describe('profils', () => {
  it('donne à l’élève un profil automatique tiré de sa classe', async () => {
    const reponse = await ctx.apiEleve.get('/api/educourses/profils');
    expect(reponse.status).toBe(200);
    expect(reponse.body.profils).toEqual([
      expect.objectContaining({
        prenom: 'Sèna',
        niveau: 'QUATRIEME',
        serie: null,
        relieAEleve: true,
      }),
    ]);
    ctx.profilEleve = reponse.body.profils[0];
    // Rejouable : toujours un seul profil
    const encore = await ctx.apiEleve.get('/api/educourses/profils');
    expect(encore.body.profils[0].id).toBe(ctx.profilEleve.id);
  });

  it('propose au parent ses enfants, puis crée les profils', async () => {
    const { body } = await ctx.apiParent.get('/api/educourses/profils');
    expect(body.profils).toEqual([]);
    expect(body.suggestions).toEqual([
      expect.objectContaining({ eleveId: ctx.eleve.id, prenom: 'Sèna', niveau: 'QUATRIEME' }),
    ]);

    const relie = await ctx.apiParent.post('/api/educourses/profils', { eleveId: ctx.eleve.id });
    expect(relie.status).toBe(201);
    expect(relie.body.profil).toMatchObject({ niveau: 'QUATRIEME', relieAEleve: true });
    ctx.profilParent = relie.body.profil;

    // Enfant scolarisé ailleurs : niveau et série déclarés
    const sansSerie = await ctx.apiParent.post('/api/educourses/profils', {
      prenom: 'Koffi',
      niveau: 'PREMIERE',
    });
    expect(sansSerie.status).toBe(400);
    expect(sansSerie.body.erreur.code).toBe('SERIE_REQUISE');
    const libre = await ctx.apiParent.post('/api/educourses/profils', {
      prenom: 'Koffi',
      niveau: 'PREMIERE',
      serie: 'd',
    });
    expect(libre.status).toBe(201);
    expect(libre.body.profil).toMatchObject({ niveau: 'PREMIERE', serie: 'D', relieAEleve: false });
    ctx.profilLibre = libre.body.profil;

    const { body: apres } = await ctx.apiParent.get('/api/educourses/profils');
    expect(apres.profils).toHaveLength(2);
    expect(apres.suggestions).toEqual([]);
  });

  it('ne relie pas l’enfant d’un autre et cache les profils des autres comptes', async () => {
    const vol = await ctx.apiAutreParent.post('/api/educourses/profils', { eleveId: ctx.eleve.id });
    expect(vol.status).toBe(404);
    const lecture = await ctx.apiAutreParent.get(`/api/educourses/profils/${ctx.profilParent.id}`);
    expect(lecture.status).toBe(404);
    const suppression = await ctx.apiAutreParent.delete(
      `/api/educourses/profils/${ctx.profilLibre.id}`,
    );
    expect(suppression.status).toBe(404);
    // Seuls les parents créent des profils
    const eleve = await ctx.apiEleve.post('/api/educourses/profils', {
      prenom: 'X',
      niveau: 'SIXIEME',
    });
    expect(eleve.status).toBe(403);
  });

  it('modifie puis supprime un profil libre, pas le niveau d’un profil relié', async () => {
    const relie = await ctx.apiParent.patch(`/api/educourses/profils/${ctx.profilParent.id}`, {
      niveau: 'SIXIEME',
    });
    expect(relie.status).toBe(400);
    const maj = await ctx.apiParent.patch(`/api/educourses/profils/${ctx.profilLibre.id}`, {
      niveau: 'SIXIEME',
      serie: 'D',
    });
    expect(maj.body.profil).toMatchObject({ niveau: 'SIXIEME', serie: null });
    const suppression = await ctx.apiParent.delete(`/api/educourses/profils/${ctx.profilLibre.id}`);
    expect(suppression.status).toBe(200);
  });
});

describe('leçons, quiz et avancement', () => {
  it('sert la leçon sans les bonnes réponses du quiz', async () => {
    const reponse = await ctx.apiEleve.get(
      `/api/educourses/lecons/${ctx.lecons[0].id}?profil=${ctx.profilEleve.id}`,
    );
    expect(reponse.status).toBe(200);
    expect(reponse.body.lecon).toMatchObject({
      contenuHtml: '<p>Cours</p>',
      libre: true,
      precedente: null,
      suivante: { id: ctx.lecons[1].id, titre: 'Leçon 2' },
    });
    expect(reponse.body.lecon.quiz).toEqual(
      QUIZ.map(({ question, choix }) => ({ question, choix })),
    );
    expect(JSON.stringify(reponse.body)).not.toContain('bonne');
    expect(JSON.stringify(reponse.body)).not.toContain('Quatre.');
    // Le personnel consulte aussi, sans profil
    const prof = await ctx.apiProf.get(`/api/educourses/lecons/${ctx.lecons[0].id}`);
    expect(prof.body.lecon.contenuHtml).toBe('<p>Cours</p>');
  });

  it('corrige le quiz côté serveur et garde le meilleur score', async () => {
    const url = `/api/educourses/lecons/${ctx.lecons[0].id}/quiz`;
    const incomplet = await ctx.apiEleve.post(url, { profilId: ctx.profilEleve.id, reponses: [1] });
    expect(incomplet.status).toBe(400);

    const juste = await ctx.apiEleve.post(url, { profilId: ctx.profilEleve.id, reponses: [1, 0] });
    expect(juste.body).toMatchObject({
      score: 100,
      corrections: [
        { bonne: 1, juste: true, explication: '<p>Quatre.</p>' },
        { bonne: 0, juste: true },
      ],
      progression: { meilleurScore: 100, dernierScore: 100, tentatives: 1, terminee: false },
    });
    const faux = await ctx.apiEleve.post(url, { profilId: ctx.profilEleve.id, reponses: [0, 0] });
    expect(faux.body.progression).toMatchObject({
      meilleurScore: 100,
      dernierScore: 50,
      tentatives: 2,
    });
    // Profil d'un autre compte : refusé
    const autre = await ctx.apiParent.post(url, { profilId: ctx.profilEleve.id, reponses: [1, 0] });
    expect(autre.status).toBe(404);
  });

  it('marque la leçon terminée (rejouable) et l’affiche dans le tableau', async () => {
    const url = `/api/educourses/lecons/${ctx.lecons[0].id}/terminee`;
    const premier = await ctx.apiEleve.put(url, { profilId: ctx.profilEleve.id, terminee: true });
    const second = await ctx.apiEleve.put(url, { profilId: ctx.profilEleve.id, terminee: true });
    expect(second.body.progression.termineeLe).toBe(premier.body.progression.termineeLe);

    const tableau = await ctx.apiEleve.get(`/api/educourses/profils/${ctx.profilEleve.id}`);
    expect(tableau.body.programmes.find((p) => p.id === ctx.programme.id)).toMatchObject({
      terminees: 1,
      scoreMoyen: 100,
    });
    expect(tableau.body.activite[0]).toMatchObject({ titre: 'Leçon 1', terminee: true });
    // Programmes du niveau seulement
    expect(tableau.body.programmes.every((p) => p.niveau === 'QUATRIEME')).toBe(true);

    const plan = await ctx.apiEleve.get(
      `/api/educourses/profils/${ctx.profilEleve.id}/programmes/${ctx.programme.id}`,
    );
    expect(plan.body.programme.chapitres[0].lecons[0].progression).toMatchObject({
      terminee: true,
    });
  });

  it('refuse une leçon pas encore rédigée', async () => {
    const reponse = await ctx.apiEleve.put(`/api/educourses/lecons/${ctx.lecons[2].id}/terminee`, {
      profilId: ctx.profilEleve.id,
      terminee: true,
    });
    expect(reponse.status).toBe(409);
  });

  it('filtre les programmes du second cycle par série', async () => {
    const { programme: pourD } = await creerProgramme('PREMIERE', ['C', 'D']);
    const { programme: pourA } = await creerProgramme('PREMIERE', ['A1']);
    const { profil } = (
      await ctx.apiParent.post('/api/educourses/profils', {
        prenom: 'Afi',
        niveau: 'PREMIERE',
        serie: 'D',
      })
    ).body;
    const { body } = await ctx.apiParent.get(`/api/educourses/profils/${profil.id}`);
    const ids = body.programmes.map((p) => p.id);
    expect(ids).toContain(pourD.id);
    expect(ids).not.toContain(pourA.id);
  });
});

describe('offre payante (désactivée par défaut)', () => {
  it('ne laisse que la 1re leçon de chaque chapitre sans abonnement actif', async () => {
    definirOffrePayante(true);
    const premiere = await ctx.apiEleve.get(`/api/educourses/lecons/${ctx.lecons[0].id}`);
    expect(premiere.body.lecon.contenuHtml).toBe('<p>Cours</p>');
    const seconde = await ctx.apiEleve.get(`/api/educourses/lecons/${ctx.lecons[1].id}`);
    expect(seconde.body.lecon).toMatchObject({ libre: false, contenuHtml: null, quiz: [] });
    const quiz = await ctx.apiEleve.post(`/api/educourses/lecons/${ctx.lecons[1].id}/quiz`, {
      reponses: [1, 0],
    });
    expect(quiz.status).toBe(402);
  });
});

describe('ouverture d’un compte EduCourses', () => {
  it('crée un compte parent sans enfant relié, une seule fois par numéro', async () => {
    const telephone = telephoneUnique();
    const corps = { nom: 'Dossou', prenoms: 'Afiavi', telephone, motDePasse: 'Cotonou2026' };
    const reponse = await request(app).post('/api/public/educourses/compte').send(corps);
    expect(reponse.status).toBe(201);
    const compte = await prisma.utilisateur.findUnique({ where: { telephone } });
    expect(compte).toMatchObject({ role: 'PARENT', nom: 'DOSSOU', ecoleId: null });

    const doublon = await request(app).post('/api/public/educourses/compte').send(corps);
    expect(doublon.status).toBe(409);

    const connexion = await request(app)
      .post('/api/auth/connexion')
      .send({ identifiant: telephone, motDePasse: 'Cotonou2026' });
    const api = client(connexion.body.jetonAcces);
    const { body } = await api.get('/api/educourses/profils');
    expect(body).toEqual({ profils: [], suggestions: [] });
  });
});
