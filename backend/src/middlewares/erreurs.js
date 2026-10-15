// Gestion centralisée des erreurs : toutes les réponses d'erreur ont le même format
// { erreur: { code, message, details? } }.
import { Prisma } from '@prisma/client';
import multer from 'multer';
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

  // Erreurs de base de données connues
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const reponse = traduireErreurPrisma(err);
    if (reponse) return res.status(reponse.statut).json({ erreur: reponse.erreur });
  }

  // Règle métier refusée par un trigger PostgreSQL (période clôturée, relevé immuable…)
  const regleBase = extraireRegleBase(err);
  if (regleBase) {
    return res.status(409).json({ erreur: { code: 'REGLE_METIER', message: regleBase } });
  }

  // Fichier refusé lors d'un envoi multipart
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Fichier trop volumineux'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? `Champ de fichier inattendu : ${err.field}`
          : 'Envoi de fichier invalide';
    return res.status(400).json({ erreur: { code: 'FICHIER_INVALIDE', message } });
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

/** Traduit les codes Prisma courants en réponses HTTP compréhensibles. */
function traduireErreurPrisma(err) {
  switch (err.code) {
    case 'P2002': {
      const champs = [].concat(err.meta?.target ?? []).join(', ');
      return {
        statut: 409,
        erreur: { code: 'CONFLIT', message: 'Cette valeur est déjà utilisée', details: { champs } },
      };
    }
    case 'P2003':
      return {
        statut: 400,
        erreur: { code: 'REFERENCE_INVALIDE', message: 'Référence inexistante' },
      };
    case 'P2004':
      return { statut: 400, erreur: { code: 'CONTRAINTE', message: 'Données incohérentes' } };
    case 'P2025':
      return { statut: 404, erreur: { code: 'INTROUVABLE', message: 'Élément introuvable' } };
    default:
      return null;
  }
}

/** Récupère le message d'une exception levée par un trigger EduRelevé. */
function extraireRegleBase(err) {
  const message = err?.message ?? '';
  if (!/Prisma/.test(err?.constructor?.name ?? '') && !err?.clientVersion) return null;
  const regle =
    /(Période clôturée[^\n"]*|[^\n"]*ni modifiés ni supprimés|[^\n"]*ne peut pas être rouverte|Note [^\n"]* supérieure au barème[^\n"]*)/.exec(
      message,
    );
  return regle ? regle[1].trim() : null;
}
