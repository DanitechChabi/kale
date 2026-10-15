import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { creerApp } from '../../src/app.js';
import jwt from 'jsonwebtoken';
import {
  app,
  avecJeton,
  connecter,
  creerCompte,
  creerEcole,
  MOT_DE_PASSE,
  prisma,
} from './aide.js';

const cookieSession = (cookies) => cookies?.find((c) => c.startsWith('edureleve_session='));

describe('connexion', () => {
  it('connecte par e-mail et par téléphone (formats locaux acceptés)', async () => {
    const ecole = await creerEcole();
    const compte = await creerCompte('ENSEIGNANT', { ecoleId: ecole.id });

    const parEmail = await connecter(compte);
    expect(parEmail.reponse.status).toBe(200);
    expect(parEmail.jeton).toBeTruthy();
    expect(parEmail.reponse.body.utilisateur).toMatchObject({
      role: 'ENSEIGNANT',
      ecole: { id: ecole.id },
    });
    expect(parEmail.reponse.body.utilisateur.motDePasseHash).toBeUndefined();

    const cookie = cookieSession(parEmail.cookie);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    expect(cookie).toMatch(/SameSite=Strict/);

    const local = compte.telephone
      .replace('+229', '')
      .replace(/(\d{2})/g, '$1 ')
      .trim();
    const parTelephone = await request(app)
      .post('/api/auth/connexion')
      .send({ identifiant: local, motDePasse: MOT_DE_PASSE });
    expect(parTelephone.status).toBe(200);
  });

  it('renvoie le même message pour un compte inconnu et un mauvais mot de passe', async () => {
    const compte = await creerCompte('MINISTERE');
    const mauvais = await connecter(compte, 'Faux2026xx');
    const inconnu = await request(app)
      .post('/api/auth/connexion')
      .send({ identifiant: 'personne@test.bj', motDePasse: 'Faux2026xx' });
    expect(mauvais.reponse.status).toBe(401);
    expect(inconnu.status).toBe(401);
    expect(mauvais.reponse.body).toEqual(inconnu.body);
  });

  it('refuse un compte désactivé', async () => {
    const compte = await creerCompte('MINISTERE', { actif: false });
    const { reponse } = await connecter(compte);
    expect(reponse.status).toBe(403);
    expect(reponse.body.erreur.code).toBe('COMPTE_DESACTIVE');
  });

  it('n’ouvre que le compte du responsable tant que l’école n’est pas vérifiée', async () => {
    const ecole = await creerEcole({ statutVerification: 'EN_ATTENTE' });
    const responsable = await creerCompte('ADMIN_ECOLE', { ecoleId: ecole.id });
    const enseignant = await creerCompte('ENSEIGNANT', { ecoleId: ecole.id });

    expect((await connecter(responsable)).reponse.status).toBe(200);
    const refus = await connecter(enseignant);
    expect(refus.reponse.status).toBe(403);
    expect(refus.reponse.body.erreur.code).toBe('ECOLE_NON_VERIFIEE');
  });

  it('limite les tentatives répétées', async () => {
    const appLimitee = creerApp({ auth: { limiteConnexion: 2 } });
    const essai = () =>
      request(appLimitee)
        .post('/api/auth/connexion')
        .send({ identifiant: 'x@test.bj', motDePasse: 'Faux2026xx' });
    await essai();
    await essai();
    const bloque = await essai();
    expect(bloque.status).toBe(429);
    expect(bloque.body.erreur.code).toBe('TROP_DE_TENTATIVES');
  });
});

describe('jeton d’accès', () => {
  it('donne accès au profil et refuse un jeton absent, altéré ou expiré', async () => {
    const compte = await creerCompte('MINISTERE');
    const { jeton } = await connecter(compte);

    const moi = await request(app).get('/api/auth/moi').set(avecJeton(jeton));
    expect(moi.status).toBe(200);
    expect(moi.body.utilisateur.id).toBe(compte.id);

    expect((await request(app).get('/api/auth/moi')).body.erreur.code).toBe('NON_AUTHENTIFIE');
    const altere = await request(app)
      .get('/api/auth/moi')
      .set(avecJeton(`${jeton}x`));
    expect(altere.body.erreur.code).toBe('JETON_INVALIDE');

    const jetonExpire = jwt.sign(
      { role: compte.role, exp: Math.floor(Date.now() / 1000) - 10 },
      process.env.JWT_ACCESS_SECRET,
      { subject: compte.id, issuer: 'edureleve', audience: 'edureleve-api' },
    );
    const expire = await request(app).get('/api/auth/moi').set(avecJeton(jetonExpire));
    expect(expire.body.erreur.code).toBe('JETON_EXPIRE');
  });

  it('coupe l’accès dès la désactivation du compte', async () => {
    const compte = await creerCompte('MINISTERE');
    const { jeton } = await connecter(compte);
    await prisma.utilisateur.update({ where: { id: compte.id }, data: { actif: false } });
    const reponse = await request(app).get('/api/auth/moi').set(avecJeton(jeton));
    expect(reponse.status).toBe(401);
  });
});

describe('rafraîchissement de session', () => {
  it('fait tourner le jeton de rafraîchissement', async () => {
    const compte = await creerCompte('MINISTERE');
    const { cookie } = await connecter(compte);

    const premier = await request(app).post('/api/auth/rafraichir').set('Cookie', cookie);
    expect(premier.status).toBe(200);
    expect(premier.body.jetonAcces).toBeTruthy();
    const nouveauCookie = cookieSession(premier.headers['set-cookie']);
    expect(nouveauCookie).toBeTruthy();
    expect(nouveauCookie).not.toBe(cookieSession(cookie));

    const suivant = await request(app).post('/api/auth/rafraichir').set('Cookie', nouveauCookie);
    expect(suivant.status).toBe(200);
  });

  it('ferme toutes les sessions si un ancien jeton est réutilisé (vol présumé)', async () => {
    const compte = await creerCompte('MINISTERE');
    const { cookie } = await connecter(compte);
    const rotation = await request(app).post('/api/auth/rafraichir').set('Cookie', cookie);
    const cookieValide = cookieSession(rotation.headers['set-cookie']);

    // Rejeu de l'ancien jeton au-delà du délai de grâce
    await prisma.jetonRafraichissement.updateMany({
      where: { utilisateurId: compte.id, revoqueLe: { not: null } },
      data: { revoqueLe: new Date(Date.now() - 60_000) },
    });
    const rejeu = await request(app).post('/api/auth/rafraichir').set('Cookie', cookie);
    expect(rejeu.status).toBe(401);

    // Le jeton légitime a lui aussi été révoqué
    const apres = await request(app).post('/api/auth/rafraichir').set('Cookie', cookieValide);
    expect(apres.status).toBe(401);
  });

  it('refuse un rafraîchissement sans cookie ou après déconnexion', async () => {
    expect((await request(app).post('/api/auth/rafraichir')).status).toBe(401);

    const compte = await creerCompte('MINISTERE');
    const { cookie } = await connecter(compte);
    const sortie = await request(app).post('/api/auth/deconnexion').set('Cookie', cookie);
    expect(sortie.status).toBe(204);
    expect((await request(app).post('/api/auth/rafraichir').set('Cookie', cookie)).status).toBe(
      401,
    );
  });
});

describe('mot de passe temporaire', () => {
  it('bloque les fonctions tant que le mot de passe n’est pas changé', async () => {
    const compte = await creerCompte('MINISTERE', { doitChangerMotDePasse: true });
    const { jeton } = await connecter(compte);

    const bloque = await request(app).get('/api/verification/ecoles').set(avecJeton(jeton));
    expect(bloque.status).toBe(403);
    expect(bloque.body.erreur.code).toBe('MOT_DE_PASSE_A_CHANGER');

    const faible = await request(app)
      .post('/api/auth/changer-mot-de-passe')
      .set(avecJeton(jeton))
      .send({ ancien: MOT_DE_PASSE, nouveau: 'faible' });
    expect(faible.status).toBe(400);

    const change = await request(app)
      .post('/api/auth/changer-mot-de-passe')
      .set(avecJeton(jeton))
      .send({ ancien: MOT_DE_PASSE, nouveau: 'Porto-Novo2027' });
    expect(change.status).toBe(200);
    expect(change.body.utilisateur.doitChangerMotDePasse).toBe(false);

    const ouvert = await request(app).get('/api/verification/ecoles').set(avecJeton(jeton));
    expect(ouvert.status).toBe(200);
    expect((await connecter(compte, 'Porto-Novo2027')).reponse.status).toBe(200);
  });
});
