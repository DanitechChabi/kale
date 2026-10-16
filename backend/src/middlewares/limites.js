// Limitation du nombre de requêtes sur les routes sensibles (anti force brute).
import { rateLimit } from 'express-rate-limit';

function limiteur({ fenetreMs, max, message }) {
  return rateLimit({
    windowMs: fenetreMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({ erreur: { code: 'TROP_DE_TENTATIVES', message } }),
  });
}

export const limiterConnexion = (max) =>
  limiteur({
    fenetreMs: 15 * 60 * 1000,
    max,
    message: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.',
  });

export const limiterInscription = (max) =>
  limiteur({
    fenetreMs: 60 * 60 * 1000,
    max,
    message: 'Trop de dossiers déposés depuis cette connexion. Réessayez plus tard.',
  });

export const limiterVerification = (max) =>
  limiteur({
    fenetreMs: 60 * 1000,
    max,
    message: 'Trop de vérifications depuis cette connexion. Réessayez dans une minute.',
  });

export const limiterDuplicata = (max) =>
  limiteur({
    fenetreMs: 60 * 60 * 1000,
    max,
    message: 'Trop de demandes déposées depuis cette connexion. Réessayez plus tard.',
  });

export const limiterSuivi = (max) =>
  limiteur({
    fenetreMs: 15 * 60 * 1000,
    max,
    message: 'Trop de consultations du suivi. Réessayez dans quelques minutes.',
  });

export const limiterActivation = (max) =>
  limiteur({
    fenetreMs: 60 * 60 * 1000,
    max,
    message: 'Trop de tentatives d’activation depuis cette connexion. Réessayez plus tard.',
  });
