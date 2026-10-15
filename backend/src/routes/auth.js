// Routes d'authentification : /api/auth/*
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config/env.js';
import {
  changerMotDePasse,
  connexion,
  deconnexion,
  moi,
  rafraichir,
} from '../contexts/auth/serviceAuth.js';
import { authentifier } from '../middlewares/authentification.js';
import { limiterConnexion } from '../middlewares/limites.js';
import { valider } from '../middlewares/valider.js';
import { dureeEnMs } from '../utils/jetons.js';
import { schemaMotDePasse } from '../utils/motDePasse.js';

export const NOM_COOKIE_SESSION = 'edureleve_session';

const optionsCookie = () => ({
  httpOnly: true,
  secure: config.cookieSecurise,
  sameSite: config.COOKIE_SAMESITE,
  path: '/api/auth',
});

function poserCookieSession(res, jeton) {
  res.cookie(NOM_COOKIE_SESSION, jeton, {
    ...optionsCookie(),
    maxAge: dureeEnMs(config.JWT_REFRESH_EXPIRATION),
  });
}

const meta = (req) => ({ adresseIp: req.ip, agentUtilisateur: req.get('user-agent') });

const schemaConnexion = z.object({
  identifiant: z
    .string()
    .trim()
    .min(3, 'Saisissez votre e-mail ou votre numéro de téléphone')
    .max(255),
  motDePasse: z.string().min(1, 'Saisissez votre mot de passe').max(128),
});

const schemaChangement = z.object({
  ancien: z.string().min(1, 'Saisissez votre mot de passe actuel').max(128),
  nouveau: schemaMotDePasse,
});

export function creerRouteurAuth({ limiteConnexion = config.LIMITE_CONNEXION } = {}) {
  const routeur = Router();

  routeur.post(
    '/connexion',
    limiterConnexion(limiteConnexion),
    valider({ body: schemaConnexion }),
    async (req, res) => {
      const { jetonAcces, jetonRafraichissement, utilisateur } = await connexion(
        req.valide.body,
        meta(req),
      );
      poserCookieSession(res, jetonRafraichissement);
      res.json({ jetonAcces, utilisateur });
    },
  );

  routeur.post('/rafraichir', async (req, res) => {
    try {
      const { jetonAcces, jetonRafraichissement, utilisateur } = await rafraichir(
        req.cookies?.[NOM_COOKIE_SESSION],
        meta(req),
      );
      poserCookieSession(res, jetonRafraichissement);
      res.json({ jetonAcces, utilisateur });
    } catch (erreur) {
      res.clearCookie(NOM_COOKIE_SESSION, optionsCookie());
      throw erreur;
    }
  });

  routeur.post('/deconnexion', async (req, res) => {
    await deconnexion(req.cookies?.[NOM_COOKIE_SESSION]);
    res.clearCookie(NOM_COOKIE_SESSION, optionsCookie());
    res.status(204).end();
  });

  routeur.get('/moi', authentifier, async (req, res) => {
    res.json({ utilisateur: await moi(req.utilisateur.id) });
  });

  routeur.post(
    '/changer-mot-de-passe',
    authentifier,
    valider({ body: schemaChangement }),
    async (req, res) => {
      await changerMotDePasse(
        req.utilisateur.id,
        req.valide.body,
        req.cookies?.[NOM_COOKIE_SESSION],
      );
      res.json({ utilisateur: await moi(req.utilisateur.id) });
    },
  );

  return routeur;
}
