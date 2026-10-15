import { randomUUID } from 'node:crypto';
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

beforeAll(async () => {
  await chargerReferentiel();
  ctx.ecole = await creerEcole();
  const compte = async (role) => {
    const c = await creerCompte(role, { ecoleId: ctx.ecole.id });
    return { compte: c, api: client((await connecter(c)).jeton) };
  };
  ctx.admin = await compte('ADMIN_ECOLE');
  ctx.prof = await compte('ENSEIGNANT');
  ctx.autreProf = await compte('ENSEIGNANT');
  ctx.secretariat = await compte('SECRETARIAT');

  const { annee } = (
    await ctx.admin.api.post('/api/annees', {
      libelle: '2025-2026',
      dateDebut: '2025-10-01',
      dateFin: '2026-07-15',
    })
  ).body;
  ctx.trimestre1 = annee.periodes[0];
  const { classe } = (await ctx.admin.api.post('/api/classes', { niveau: 'SIXIEME' })).body;
  ctx.classe = classe;
  ctx.math = classe.enseignements.find((e) => e.matiere.code === 'MATH');
  ctx.francais = classe.enseignements.find((e) => e.matiere.code === 'FR');
  await ctx.admin.api.patch(`/api/enseignements/${ctx.math.id}`, {
    enseignantId: ctx.prof.compte.id,
  });

  ctx.eleves = [];
  for (let i = 0; i < 3; i++) {
    const eleve = await creerEleve(ctx.ecole.id);
    await prisma.inscription.create({
      data: {
        ecoleId: ctx.ecole.id,
        eleveId: eleve.id,
        classeId: classe.id,
        anneeScolaireId: annee.id,
      },
    });
    ctx.eleves.push(eleve);
  }
});

const evaluation = (api, corps) =>
  api.post('/api/evaluations', {
    enseignementId: ctx.math.id,
    periodeId: ctx.trimestre1.id,
    date: '2025-11-10',
    ...corps,
  });
const saisir = (api, evaluationId, notes) =>
  api.put(`/api/evaluations/${evaluationId}/notes`, { notes });

describe('évaluations', () => {
  it('liste les matières de l’enseignant', async () => {
    const { body } = await ctx.prof.api.get('/api/mes-enseignements');
    expect(body.enseignements.map((e) => `${e.classe.nom} · ${e.matiere}`)).toEqual([
      '6e A · Mathématiques',
    ]);
    expect(body.enseignements[0].effectif).toBe(3);
  });

  it('réserve la saisie à l’enseignant de la matière', async () => {
    expect((await evaluation(ctx.autreProf.api, { type: 'DEVOIR' })).status).toBe(403);
    expect((await evaluation(ctx.secretariat.api, { type: 'DEVOIR' })).status).toBe(403);
  });

  it('nomme automatiquement et crée de façon idempotente (saisie hors connexion)', async () => {
    const id = randomUUID();
    const premiere = await evaluation(ctx.prof.api, { id, type: 'INTERROGATION' });
    expect(premiere.status).toBe(201);
    expect(premiere.body.evaluation.libelle).toBe('Interrogation 1');
    const rejeu = await evaluation(ctx.prof.api, { id, type: 'INTERROGATION' });
    expect(rejeu.body.evaluation.id).toBe(id);
    expect(await prisma.evaluation.count({ where: { id } })).toBe(1);
    ctx.interro1 = premiere.body.evaluation;
  });
});

describe('saisie des notes', () => {
  it('enregistre une feuille, puis ne change rien si elle est renvoyée', async () => {
    const [a, b, c] = ctx.eleves;
    const feuille = [
      { eleveId: a.id, valeur: 14.5, absent: false },
      { eleveId: b.id, valeur: null, absent: true },
      { eleveId: c.id, valeur: null, absent: false },
    ];
    const premiere = await saisir(ctx.prof.api, ctx.interro1.id, feuille);
    expect(premiere.status).toBe(200);
    expect(premiere.body.bilan).toEqual({ creees: 2, modifiees: 0, retirees: 0, inchangees: 0 });
    expect(premiere.body.eleves.find((e) => e.id === a.id).note.valeur).toBe(14.5);

    const rejeu = await saisir(ctx.prof.api, ctx.interro1.id, feuille);
    expect(rejeu.body.bilan).toEqual({ creees: 0, modifiees: 0, retirees: 0, inchangees: 2 });
  });

  it('trace chaque modification avec l’ancienne et la nouvelle valeur', async () => {
    const [a] = ctx.eleves;
    const modification = await saisir(ctx.prof.api, ctx.interro1.id, [
      { eleveId: a.id, valeur: 16, absent: false },
    ]);
    expect(modification.body.bilan.modifiees).toBe(1);
    const noteId = modification.body.eleves.find((e) => e.id === a.id).note.id;

    const { body } = await ctx.admin.api.get(`/api/notes/${noteId}/historique`);
    expect(body.historique.map((h) => h.action)).toEqual(['CREATION', 'MODIFICATION']);
    expect(body.historique[1].ancienneValeur.valeur).toBe(14.5);
    expect(body.historique[1].nouvelleValeur.valeur).toBe(16);
    expect(body.historique[1].utilisateur.role).toBe('ENSEIGNANT');
  });

  it('refuse une note hors barème ou un élève d’une autre classe', async () => {
    const horsBareme = await saisir(ctx.prof.api, ctx.interro1.id, [
      { eleveId: ctx.eleves[0].id, valeur: 21, absent: false },
    ]);
    expect(horsBareme.body.erreur.code).toBe('HORS_BAREME');
    const intrus = await creerEleve(ctx.ecole.id);
    const horsClasse = await saisir(ctx.prof.api, ctx.interro1.id, [
      { eleveId: intrus.id, valeur: 10, absent: false },
    ]);
    expect(horsClasse.body.erreur.code).toBe('ELEVE_HORS_CLASSE');
  });
});

describe('résultats', () => {
  it('calcule moyennes, moyenne générale et rangs avec ex æquo', async () => {
    const [a, b, c] = ctx.eleves;
    // Mathématiques (coef 3) : MI de a = 16 ; devoir : a 10, b 13, c 13
    const devoir = (await evaluation(ctx.prof.api, { type: 'DEVOIR' })).body.evaluation;
    expect(devoir.libelle).toBe('Devoir 1');
    await saisir(ctx.prof.api, devoir.id, [
      { eleveId: a.id, valeur: 10, absent: false },
      { eleveId: b.id, valeur: 13, absent: false },
      { eleveId: c.id, valeur: 13, absent: false },
    ]);
    // Français (coef 2), saisi par le responsable : a 12, b 9, c 9
    const fr = (
      await ctx.admin.api.post('/api/evaluations', {
        enseignementId: ctx.francais.id,
        periodeId: ctx.trimestre1.id,
        type: 'DEVOIR',
        date: '2025-11-12',
        bareme: 40,
      })
    ).body.evaluation;
    await saisir(ctx.admin.api, fr.id, [
      { eleveId: a.id, valeur: 24, absent: false },
      { eleveId: b.id, valeur: 18, absent: false },
      { eleveId: c.id, valeur: 18, absent: false },
    ]);

    const { body } = await ctx.secretariat.api.get(
      `/api/resultats?classeId=${ctx.classe.id}&periodeId=${ctx.trimestre1.id}`,
    );
    const par = Object.fromEntries(body.eleves.map((e) => [e.id, e]));
    // a : maths (16 + 10) / 2 = 13 ; générale (13×3 + 12×2) / 5 = 12,6
    expect(par[a.id].moyennes[ctx.math.id].moyenne).toBe(13);
    expect(par[a.id].moyenneGenerale).toBe(12.6);
    // b et c : maths 13, français 9 → (39 + 18) / 5 = 11,4, ex æquo 2e
    expect(par[b.id].moyenneGenerale).toBe(11.4);
    expect([par[a.id].rang, par[b.id].rang, par[c.id].rang]).toEqual([1, 2, 2]);
    expect(par[b.id].exAequo).toBe(true);
    expect(body.statistiques.moyenne).toBe(11.8);
  });
});

describe('contrôle et clôture de la période', () => {
  it('signale les notes manquantes et refuse une clôture incomplète sans motif', async () => {
    const controle = await ctx.admin.api.get(`/api/periodes/${ctx.trimestre1.id}/controle`);
    expect(controle.status).toBe(200);
    expect(controle.body.pret).toBe(false);
    const classe = controle.body.classes[0];
    expect(classe.sansEvaluation).toContain('Anglais');
    expect(classe.notesManquantes).toBe(1); // interrogation 1 : le 3e élève n'a pas de note

    expect((await ctx.prof.api.post(`/api/periodes/${ctx.trimestre1.id}/cloture`, {})).status).toBe(
      403,
    );
    const refus = await ctx.admin.api.post(`/api/periodes/${ctx.trimestre1.id}/cloture`, {});
    expect(refus.status).toBe(409);
    expect(refus.body.erreur.code).toBe('CLOTURE_INCOMPLETE');
    const sansMotif = await ctx.admin.api.post(`/api/periodes/${ctx.trimestre1.id}/cloture`, {
      forcer: true,
    });
    expect(sansMotif.body.erreur.code).toBe('MOTIF_OBLIGATOIRE');
  });

  it('clôture définitivement : plus aucune note ni évaluation', async () => {
    const cloture = await ctx.admin.api.post(`/api/periodes/${ctx.trimestre1.id}/cloture`, {
      forcer: true,
      motif: 'Conseil de classe du 20 décembre',
    });
    expect(cloture.status).toBe(200);
    expect(cloture.body.periode.estCloturee).toBe(true);

    const modification = await saisir(ctx.prof.api, ctx.interro1.id, [
      { eleveId: ctx.eleves[0].id, valeur: 20, absent: false },
    ]);
    expect(modification.status).toBe(409);
    expect(modification.body.erreur.code).toBe('PERIODE_CLOTUREE');
    expect((await evaluation(ctx.prof.api, { type: 'DEVOIR' })).status).toBe(409);

    // Même en contournant l'application, la base refuse
    const note = await prisma.note.findFirst({
      where: { evaluationId: ctx.interro1.id, absent: false },
    });
    await expect(
      prisma.note.update({ where: { id: note.id }, data: { valeur: 20 } }),
    ).rejects.toThrow(/clôturée/);

    const journal = await prisma.journalAudit.findFirst({
      where: { entite: 'Periode', entiteId: ctx.trimestre1.id },
    });
    expect(journal.nouvelleValeur).toMatchObject({
      forcee: true,
      motif: 'Conseil de classe du 20 décembre',
    });
  });
});
