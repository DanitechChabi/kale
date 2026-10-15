import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prismaPourEcole } from '../../src/db/isolation.js';
import { app, avecJeton, connecter, creerCompte, creerEcole, creerEleve, prisma } from './aide.js';

const ctx = {};

beforeAll(async () => {
  ctx.ecoleA = await creerEcole();
  ctx.ecoleB = await creerEcole();
  ctx.eleveA = await creerEleve(ctx.ecoleA.id);
  ctx.eleveB = await creerEleve(ctx.ecoleB.id);
  ctx.dbA = prismaPourEcole(ctx.ecoleA.id);
});

describe('client Prisma isolé par établissement', () => {
  it('ne lit que les données de son établissement', async () => {
    const eleves = await ctx.dbA.eleve.findMany();
    expect(eleves.every((e) => e.ecoleId === ctx.ecoleA.id)).toBe(true);
    expect(eleves.some((e) => e.id === ctx.eleveA.id)).toBe(true);

    expect(await ctx.dbA.eleve.findUnique({ where: { id: ctx.eleveB.id } })).toBeNull();
    expect(await ctx.dbA.eleve.findFirst({ where: { id: ctx.eleveB.id } })).toBeNull();
    expect(await ctx.dbA.eleve.count({ where: { id: ctx.eleveB.id } })).toBe(0);
  });

  it('ne modifie ni ne supprime les données d’une autre école', async () => {
    await expect(
      ctx.dbA.eleve.update({ where: { id: ctx.eleveB.id }, data: { nom: 'PIRATE' } }),
    ).rejects.toThrow();
    const { count } = await ctx.dbA.eleve.updateMany({
      where: { id: ctx.eleveB.id },
      data: { nom: 'PIRATE' },
    });
    expect(count).toBe(0);
    await expect(ctx.dbA.eleve.delete({ where: { id: ctx.eleveB.id } })).rejects.toThrow();
    expect((await prisma.eleve.findUnique({ where: { id: ctx.eleveB.id } })).nom).toBe('ELEVE');
  });

  it('impose l’établissement à la création et refuse un autre établissement', async () => {
    const cree = await ctx.dbA.matiere.create({ data: { code: 'INFO', nom: 'Informatique' } });
    expect(cree.ecoleId).toBe(ctx.ecoleA.id);

    await expect(
      ctx.dbA.matiere.create({ data: { code: 'X', nom: 'X', ecoleId: ctx.ecoleB.id } }),
    ).rejects.toThrow(/autre établissement/);
    await expect(
      ctx.dbA.eleve.update({ where: { id: ctx.eleveA.id }, data: { ecoleId: ctx.ecoleB.id } }),
    ).rejects.toThrow(/autre établissement/);
  });

  it('n’accède qu’à sa propre fiche établissement', async () => {
    expect(await ctx.dbA.ecole.findUnique({ where: { id: ctx.ecoleB.id } })).toBeNull();
    expect((await ctx.dbA.ecole.findUnique({ where: { id: ctx.ecoleA.id } })).id).toBe(
      ctx.ecoleA.id,
    );
    await expect(ctx.dbA.ecole.findMany()).rejects.toThrow(/interdite/);
  });

  it('laisse les référentiels nationaux en lecture seule', async () => {
    await expect(ctx.dbA.departement.findMany()).resolves.toBeInstanceOf(Array);
    await expect(
      ctx.dbA.departement.create({ data: { code: 'ZZ', nom: 'Inventé' } }),
    ).rejects.toThrow(/lecture seule/);
  });

  it('refuse les modèles non classés (sessions)', async () => {
    await expect(ctx.dbA.jetonRafraichissement.findMany()).rejects.toThrow(/non autorisé/);
  });
});

describe('isolation au niveau de l’API', () => {
  it('un responsable ne voit et ne gère que les comptes de son établissement', async () => {
    const adminA = await creerCompte('ADMIN_ECOLE', { ecoleId: ctx.ecoleA.id });
    const profB = await creerCompte('ENSEIGNANT', { ecoleId: ctx.ecoleB.id });
    const { jeton } = await connecter(adminA);

    const liste = await request(app).get('/api/utilisateurs').set(avecJeton(jeton));
    expect(liste.status).toBe(200);
    expect(liste.body.comptes.some((c) => c.id === profB.id)).toBe(false);

    const desactivation = await request(app)
      .patch(`/api/utilisateurs/${profB.id}/statut`)
      .set(avecJeton(jeton))
      .send({ actif: false });
    expect(desactivation.status).toBe(404);
    expect((await prisma.utilisateur.findUnique({ where: { id: profB.id } })).actif).toBe(true);

    const reinitialisation = await request(app)
      .post(`/api/utilisateurs/${profB.id}/reinitialiser-mot-de-passe`)
      .set(avecJeton(jeton));
    expect(reinitialisation.status).toBe(404);
  });

  it('un responsable ne télécharge pas les pièces d’une autre école', async () => {
    const adminA = await creerCompte('ADMIN_ECOLE', { ecoleId: ctx.ecoleA.id });
    const documentB = await prisma.documentEcole.create({
      data: {
        ecoleId: ctx.ecoleB.id,
        type: 'AUTRE',
        nomFichier: 'b.pdf',
        cheminFichier: 'documents-ecoles/b/b.pdf',
        typeMime: 'application/pdf',
        tailleOctets: 10,
        empreinteSha256: 'd'.repeat(64),
      },
    });
    const { jeton } = await connecter(adminA);
    const reponse = await request(app)
      .get(`/api/mon-ecole/dossier/documents/${documentB.id}/fichier`)
      .set(avecJeton(jeton));
    expect(reponse.status).toBe(404);
  });
});
