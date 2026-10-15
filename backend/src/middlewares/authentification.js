// Middlewares d'authentification, de rôle et d'isolation par établissement.
import { prisma } from '../config/prisma.js';
import { prismaPourEcole } from '../db/isolation.js';
import { verifierJetonAcces } from '../utils/jetons.js';
import { ErreurApi } from './erreurs.js';

/**
 * Vérifie le jeton d'accès (en-tête « Authorization: Bearer … ») et recharge
 * le compte : une désactivation prend effet immédiatement, sans attendre
 * l'expiration du jeton.
 *
 * Expose :
 * - req.utilisateur : { id, role, ecoleId, doitChangerMotDePasse, ecole }
 * - req.db : client Prisma isolé sur l'établissement pour les comptes d'école,
 *   client standard pour les comptes nationaux et les parents.
 */
export async function authentifier(req, _res, next) {
  const entete = req.get('authorization') ?? '';
  const [schema, jeton] = entete.split(' ');
  if (schema !== 'Bearer' || !jeton) {
    throw new ErreurApi(401, 'NON_AUTHENTIFIE', 'Authentification requise');
  }

  let charge;
  try {
    charge = verifierJetonAcces(jeton);
  } catch (erreur) {
    throw erreur.name === 'TokenExpiredError'
      ? new ErreurApi(401, 'JETON_EXPIRE', 'Session expirée')
      : new ErreurApi(401, 'JETON_INVALIDE', 'Jeton d’accès invalide');
  }

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: charge.sub },
    select: {
      id: true,
      role: true,
      ecoleId: true,
      actif: true,
      doitChangerMotDePasse: true,
      ecole: { select: { statutVerification: true, actif: true } },
    },
  });
  if (!utilisateur || !utilisateur.actif) {
    throw new ErreurApi(401, 'COMPTE_DESACTIVE', 'Ce compte n’est plus actif');
  }
  if (utilisateur.ecoleId && !utilisateur.ecole?.actif) {
    throw new ErreurApi(403, 'ECOLE_INACTIVE', 'Cet établissement n’a plus accès à la plateforme');
  }

  req.utilisateur = utilisateur;
  req.db = utilisateur.ecoleId ? prismaPourEcole(utilisateur.ecoleId) : prisma;
  next();
}

/** Autorise uniquement les rôles listés. */
export function exigerRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.utilisateur?.role)) {
      throw new ErreurApi(403, 'ACCES_REFUSE', 'Vous n’avez pas les droits pour cette action');
    }
    next();
  };
}

/** Bloque les comptes d'un établissement tant que celui-ci n'est pas vérifié. */
export function exigerEcoleVerifiee(req, _res, next) {
  const { ecoleId, ecole } = req.utilisateur;
  if (ecoleId && ecole?.statutVerification !== 'VERIFIEE') {
    throw new ErreurApi(
      403,
      'ECOLE_NON_VERIFIEE',
      'Fonction disponible après la vérification de votre établissement',
    );
  }
  next();
}

/** Oblige à remplacer un mot de passe temporaire avant tout autre usage. */
export function exigerMotDePasseDefinitif(req, _res, next) {
  if (req.utilisateur.doitChangerMotDePasse) {
    throw new ErreurApi(
      403,
      'MOT_DE_PASSE_A_CHANGER',
      'Vous devez d’abord choisir un nouveau mot de passe',
    );
  }
  next();
}
