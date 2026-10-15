// Jetons de session.
// - Jeton d'accès : JWT court (15 min), envoyé dans l'en-tête Authorization.
// - Jeton de rafraîchissement : valeur aléatoire opaque, stockée dans un cookie
//   httpOnly ; la base ne conserve que son empreinte HMAC.
import { createHmac, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

const EMETTEUR = 'edureleve';
const AUDIENCE = 'edureleve-api';

export function signerJetonAcces(utilisateur) {
  return jwt.sign(
    { role: utilisateur.role, ecoleId: utilisateur.ecoleId ?? null },
    config.JWT_ACCESS_SECRET,
    {
      subject: utilisateur.id,
      expiresIn: config.JWT_ACCESS_EXPIRATION,
      issuer: EMETTEUR,
      audience: AUDIENCE,
      algorithm: 'HS256',
    },
  );
}

/** Vérifie un jeton d'accès ; lève une erreur jsonwebtoken s'il est invalide ou expiré. */
export function verifierJetonAcces(jeton) {
  return jwt.verify(jeton, config.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: EMETTEUR,
    audience: AUDIENCE,
  });
}

export const genererJetonRafraichissement = () => randomBytes(48).toString('base64url');

export const empreinteJeton = (jeton) =>
  createHmac('sha256', config.JWT_REFRESH_SECRET).update(jeton).digest('hex');

const UNITES = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** Convertit une durée « 15m », « 7d »… en millisecondes. */
export function dureeEnMs(duree) {
  const correspondance = /^(\d+)\s*([smhd])$/.exec(String(duree).trim());
  if (!correspondance) throw new Error(`Durée invalide : ${duree}`);
  return Number(correspondance[1]) * UNITES[correspondance[2]];
}

// Lien de téléchargement d'un duplicata délivré : JWT de 15 minutes, d'audience
// distincte (il ne peut jamais servir de jeton d'accès à l'API).
const AUDIENCE_DUPLICATA = 'edureleve-duplicata';

export const signerJetonDuplicata = (demandeId) =>
  jwt.sign({}, config.JWT_ACCESS_SECRET, {
    subject: demandeId,
    expiresIn: '15m',
    issuer: EMETTEUR,
    audience: AUDIENCE_DUPLICATA,
    algorithm: 'HS256',
  });

/** Identifiant de la demande, ou null si le jeton est invalide ou expiré. */
export function verifierJetonDuplicata(jeton) {
  try {
    return jwt.verify(jeton, config.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: EMETTEUR,
      audience: AUDIENCE_DUPLICATA,
    }).sub;
  } catch {
    return null;
  }
}
