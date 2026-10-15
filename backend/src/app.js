// Construction de l'application Express (séparée du démarrage du serveur pour les tests).
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import { creerRouteurApi } from './routes/index.js';
import { creerRouteurPageVerification } from './routes/pageVerification.js';
import { gestionnaireErreurs, routeIntrouvable } from './middlewares/erreurs.js';

// `options` permet aux tests d'ajuster certains réglages (limites de requêtes…).
export function creerApp(options = {}) {
  const app = express();

  app.disable('x-powered-by');
  // Nécessaire derrière un proxy (Render, Nginx…) pour récupérer la vraie IP du client
  app.set('trust proxy', 1);

  app.use(helmet());
  // API publique (vérification, duplicata) : ouverte à toutes les origines, sans cookie
  app.use('/api/public', cors({ origin: '*', credentials: false }));
  app.use(
    cors({
      origin: config.originesCors,
      credentials: true, // le jeton de rafraîchissement circulera dans un cookie httpOnly
    }),
  );
  // Petite limite : l'API échange du JSON, les fichiers passeront par des routes dédiées
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  if (!config.estTest) app.use(morgan(config.estProduction ? 'combined' : 'dev'));

  app.use('/api', creerRouteurApi(options));
  // Page de vérification légère (lien du QR code imprimé sur chaque document)
  app.use('/verifier', creerRouteurPageVerification(options.verification));

  if (config.DOSSIER_FRONTEND) servirSite(app, resolve(config.DOSSIER_FRONTEND));

  app.use(routeIntrouvable);
  app.use(gestionnaireErreurs);

  return app;
}

/**
 * Sert le site compilé depuis la même adresse que l'API (déploiement en un seul
 * service) : le cookie de session reste « SameSite=Strict » et aucune requête
 * n'est inter-domaines.
 */
function servirSite(app, dossier) {
  const index = join(dossier, 'index.html');
  if (!existsSync(index))
    throw new Error(`Site introuvable : ${index} (lancer « npm run build » dans frontend)`);

  app.use(
    express.static(dossier, {
      index: false,
      setHeaders(res, chemin) {
        // Fichiers versionnés (nom avec empreinte) : cache long ; le reste : toujours revalidé
        res.set(
          'Cache-Control',
          chemin.includes(`${join('assets', '')}`)
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
        );
      },
    }),
  );
  // Toute autre adresse affichée par le navigateur renvoie l'application (routage côté client)
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.set('Cache-Control', 'no-cache').sendFile(index);
  });
}
