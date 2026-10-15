import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, avecJeton, connecter, creerCompte, creerEcole, creerEleve, prisma } from './aide.js';

const ctx = {};

beforeAll(async () => {
  ctx.ecole = await creerEcole();
  ctx.autreEcole = await creerEcole();
  ctx.admin = await creerCompte('ADMIN_ECOLE', { ecoleId: ctx.ecole.id });
  ctx.secretariat = await creerCompte('SECRETARIAT', { ecoleId: ctx.ecole.id });
  ctx.jetonAdmin = (await connecter(ctx.admin)).jeton;
  ctx.jetonSecretariat = (await connecter(ctx.secretariat)).jeton;
});

const creer = (jeton, corps) =>
  request(app).post('/api/utilisateurs').set(avecJeton(jeton)).send(corps);

describe('comptes créés par l’établissement', () => {
  it('le responsable crée un enseignant avec un mot de passe temporaire', async () => {
    const reponse = await creer(ctx.jetonAdmin, {
      role: 'ENSEIGNANT',
      nom: 'Kpadonou',
      prenoms: 'Rodrigue',
      telephone: '0196123456',
    });
    expect(reponse.status).toBe(201);
    expect(reponse.body.compte).toMatchObject({
      role: 'ENSEIGNANT',
      nom: 'KPADONOU',
      doitChangerMotDePasse: true,
    });
    expect(reponse.body.motDePasseTemporaire).toHaveLength(10);

    // Première connexion : changement de mot de passe obligatoire
    const connexion = await request(app)
      .post('/api/auth/connexion')
      .send({ identifiant: '0196123456', motDePasse: reponse.body.motDePasseTemporaire });
    expect(connexion.status).toBe(200);
    expect(connexion.body.utilisateur.doitChangerMotDePasse).toBe(true);

    const compte = await prisma.utilisateur.findUnique({ where: { id: reponse.body.compte.id } });
    expect(compte.ecoleId).toBe(ctx.ecole.id);
  });

  it('le secrétariat ne peut créer que des comptes élève et parent', async () => {
    const refus = await creer(ctx.jetonSecretariat, {
      role: 'ENSEIGNANT',
      nom: 'Test',
      prenoms: 'Test',
      telephone: '0196000111',
    });
    expect(refus.status).toBe(403);
  });

  it('crée un compte élève à partir d’une fiche de l’établissement uniquement', async () => {
    const eleve = await creerEleve(ctx.ecole.id);
    const eleveAilleurs = await creerEleve(ctx.autreEcole.id);

    const ok = await creer(ctx.jetonSecretariat, {
      role: 'ELEVE',
      eleveId: eleve.id,
      telephone: '0196000222',
    });
    expect(ok.status).toBe(201);
    expect((await prisma.eleve.findUnique({ where: { id: eleve.id } })).utilisateurId).toBe(
      ok.body.compte.id,
    );

    const doublon = await creer(ctx.jetonSecretariat, {
      role: 'ELEVE',
      eleveId: eleve.id,
      telephone: '0196000223',
    });
    expect(doublon.status).toBe(409);

    const ailleurs = await creer(ctx.jetonSecretariat, {
      role: 'ELEVE',
      eleveId: eleveAilleurs.id,
      telephone: '0196000224',
    });
    expect(ailleurs.status).toBe(404);
  });

  it('relie un parent existant au lieu d’en créer un second', async () => {
    const enfant1 = await creerEleve(ctx.ecole.id);
    const enfant2 = await creerEleve(ctx.ecole.id);
    const parent = {
      role: 'PARENT',
      nom: 'Zinsou',
      prenoms: 'Mariette',
      telephone: '0196000333',
    };

    const premier = await creer(ctx.jetonSecretariat, {
      ...parent,
      enfants: [{ eleveId: enfant1.id, lien: 'MERE' }],
    });
    expect(premier.status).toBe(201);
    expect(premier.body.motDePasseTemporaire).toBeTruthy();

    const second = await creer(ctx.jetonSecretariat, {
      ...parent,
      enfants: [{ eleveId: enfant2.id, lien: 'MERE' }],
    });
    expect(second.status).toBe(200);
    expect(second.body.compteExistant).toBe(true);
    expect(second.body.motDePasseTemporaire).toBeNull();
    expect(second.body.compte.id).toBe(premier.body.compte.id);

    const liens = await prisma.lienParentEleve.findMany({
      where: { parentId: premier.body.compte.id },
    });
    expect(liens).toHaveLength(2);
    expect(
      (await prisma.utilisateur.findUnique({ where: { id: premier.body.compte.id } })).ecoleId,
    ).toBeNull();

    const parents = await request(app)
      .get('/api/utilisateurs?role=PARENT')
      .set(avecJeton(ctx.jetonAdmin));
    expect(parents.body.comptes.map((c) => c.id)).toContain(premier.body.compte.id);
  });

  it('désactive un compte, ce qui coupe immédiatement ses sessions', async () => {
    const enseignant = await creerCompte('ENSEIGNANT', { ecoleId: ctx.ecole.id });
    const { jeton } = await connecter(enseignant);

    const reponse = await request(app)
      .patch(`/api/utilisateurs/${enseignant.id}/statut`)
      .set(avecJeton(ctx.jetonAdmin))
      .send({ actif: false });
    expect(reponse.status).toBe(200);
    expect((await request(app).get('/api/auth/moi').set(avecJeton(jeton))).status).toBe(401);

    const soiMeme = await request(app)
      .patch(`/api/utilisateurs/${ctx.admin.id}/statut`)
      .set(avecJeton(ctx.jetonAdmin))
      .send({ actif: false });
    expect(soiMeme.status).toBe(400);
  });

  it('est interdit tant que l’établissement n’est pas vérifié', async () => {
    const ecole = await creerEcole({ statutVerification: 'EN_ATTENTE' });
    const { jeton } = await connecter(await creerCompte('ADMIN_ECOLE', { ecoleId: ecole.id }));
    const reponse = await creer(jeton, {
      role: 'ENSEIGNANT',
      nom: 'Test',
      prenoms: 'Test',
      telephone: '0196000444',
    });
    expect(reponse.status).toBe(403);
    expect(reponse.body.erreur.code).toBe('ECOLE_NON_VERIFIEE');
  });
});

describe('comptes nationaux', () => {
  it('seul le super-administrateur crée un compte ministère', async () => {
    const { jeton: jetonMinistere } = await connecter(await creerCompte('MINISTERE'));
    const refus = await request(app)
      .post('/api/admin/comptes')
      .set(avecJeton(jetonMinistere))
      .send({ role: 'MINISTERE', nom: 'Test', prenoms: 'Test', telephone: '0196000555' });
    expect(refus.status).toBe(403);

    const { jeton } = await connecter(await creerCompte('SUPER_ADMIN'));
    const ok = await request(app)
      .post('/api/admin/comptes')
      .set(avecJeton(jeton))
      .send({ role: 'MINISTERE', nom: 'Dégbé', prenoms: 'Pascal', telephone: '0196000555' });
    expect(ok.status).toBe(201);
    expect(ok.body.compte.role).toBe('MINISTERE');
  });
});
