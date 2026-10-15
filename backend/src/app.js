// Construction de l'application Express (séparée du démarrage du serveur pour les tests).
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import { creerRouteurApi } from './routes/index.js';
import { gestionnaireErreurs, routeIntrouvable } from './middlewares/erreurs.js';

// `options` permet aux tests d'ajuster certains réglages (limites de requêtes…).
export function creerApp(options = {}) {
  const app = express();

  app.disable('x-powered-by');
  // Nécessaire derrière un proxy (Render, Nginx…) pour récupérer la vraie IP du client
  app.set('trust proxy', 1);

  app.use(helmet());
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

  app.use(routeIntrouvable);
  app.use(gestionnaireErreurs);

  return app;
}
