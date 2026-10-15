// Gestion centralisée des erreurs : toutes les réponses d'erreur ont le même format
// { erreur: { code, message, details? } }.
import { ZodError } from 'zod';
import { config } from '../config/env.js';

/** Erreur métier avec un code HTTP explicite. */
export class ErreurApi extends Error {
  constructor(statut, code, message, details) {
    super(message);
    this.statut = statut;
    this.code = code;
    this.details = details;
  }
}

/** Route inconnue → 404. */
export function routeIntrouvable(req, _res, next) {
  next(
    new ErreurApi(404, 'ROUTE_INTROUVABLE', `Route introuvable : ${req.method} ${req.originalUrl}`),
  );
}

/** Middleware final de traitement des erreurs (4 arguments obligatoires pour Express). */
export function gestionnaireErreurs(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      erreur: {
        code: 'VALIDATION',
        message: 'Données invalides',
        details: err.issues.map((i) => ({ champ: i.path.join('.'), message: i.message })),
      },
    });
  }

  if (err instanceof ErreurApi) {
    return res.status(err.statut).json({
      erreur: { code: err.code, message: err.message, details: err.details },
    });
  }

  // Corps JSON mal formé envoyé par le client
  if (err.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ erreur: { code: 'JSON_INVALIDE', message: 'Corps de requête JSON invalide' } });
  }

  if (!config.estTest) console.error(err);
  return res.status(500).json({
    erreur: {
      code: 'ERREUR_INTERNE',
      message: config.estProduction ? 'Erreur interne du serveur' : err.message,
    },
  });
}
