// Authentification : connexion, sessions (rotation du jeton de rafraîchissement),
// déconnexion, changement de mot de passe.
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/env.js';
import { ErreurApi } from '../../middlewares/erreurs.js';
import { analyserIdentifiant } from '../../utils/identifiants.js';
import { HACHE_FACTICE, hacherMotDePasse, verifierMotDePasse } from '../../utils/motDePasse.js';
import {
  dureeEnMs,
  empreinteJeton,
  genererJetonRafraichissement,
  signerJetonAcces,
} from '../../utils/jetons.js';

/** Rôles rattachés à un établissement */
export const ROLES_ECOLE = ['ADMIN_ECOLE', 'SECRETARIAT', 'ENSEIGNANT', 'ELEVE'];

// Deux onglets qui rafraîchissent en même temps présentent le même jeton :
// en dessous de ce délai, ce n'est pas traité comme un vol de jeton.
const DELAI_GRACE_ROTATION_MS = 10_000;

const SELECTION_UTILISATEUR = {
  id: true,
  role: true,
  ecoleId: true,
  nom: true,
  prenoms: true,
  email: true,
  telephone: true,
  actif: true,
  doitChangerMotDePasse: true,
  motDePasseHash: true,
  ecole: { select: { id: true, nom: true, statutVerification: true, actif: true } },
};

/** Données de profil renvoyées au client (jamais le hachage du mot de passe). */
export function profil(utilisateur) {
  return {
    id: utilisateur.id,
    role: utilisateur.role,
    nom: utilisateur.nom,
    prenoms: utilisateur.prenoms,
    email: utilisateur.email,
    telephone: utilisateur.telephone,
    doitChangerMotDePasse: utilisateur.doitChangerMotDePasse,
    ecole: utilisateur.ecole
      ? {
          id: utilisateur.ecole.id,
          nom: utilisateur.ecole.nom,
          statutVerification: utilisateur.ecole.statutVerification,
        }
      : null,
  };
}

/**
 * Vérifie qu'un compte peut ouvrir une session.
 * Le responsable (ADMIN_ECOLE) d'un établissement non vérifié peut se connecter
 * pour suivre son dossier ; les autres comptes de l'établissement, non.
 */
function verifierAccesCompte(utilisateur) {
  if (!utilisateur.actif) {
    throw new ErreurApi(
      403,
      'COMPTE_DESACTIVE',
      'Ce compte est désactivé. Contactez votre établissement.',
    );
  }
  if (!ROLES_ECOLE.includes(utilisateur.role)) return;

  const { ecole } = utilisateur;
  if (!ecole?.actif) {
    throw new ErreurApi(403, 'ECOLE_INACTIVE', 'Cet établissement n’a plus accès à la plateforme.');
  }
  if (ecole.statutVerification !== 'VERIFIEE' && utilisateur.role !== 'ADMIN_ECOLE') {
    throw new ErreurApi(
      403,
      'ECOLE_NON_VERIFIEE',
      'Votre établissement n’est pas encore vérifié. Réessayez après sa validation.',
    );
  }
}

async function ouvrirSession(utilisateur, { adresseIp, agentUtilisateur }, client = prisma) {
  const jetonRafraichissement = genererJetonRafraichissement();
  const session = await client.jetonRafraichissement.create({
    data: {
      utilisateurId: utilisateur.id,
      empreinte: empreinteJeton(jetonRafraichissement),
      expireLe: new Date(Date.now() + dureeEnMs(config.JWT_REFRESH_EXPIRATION)),
      adresseIp: adresseIp ?? null,
      agentUtilisateur: agentUtilisateur?.slice(0, 255) ?? null,
    },
  });
  return { session, jetonRafraichissement, jetonAcces: signerJetonAcces(utilisateur) };
}

const identifiantsInvalides = () =>
  new ErreurApi(401, 'IDENTIFIANTS_INVALIDES', 'Identifiant ou mot de passe incorrect');

export async function connexion({ identifiant, motDePasse }, meta) {
  const critere = analyserIdentifiant(identifiant);
  const utilisateur = !critere
    ? null
    : critere.identifiantEleve
      ? // Un élève se connecte avec l'identifiant EduRelevé de sa fiche
        await prisma.utilisateur.findFirst({
          where: { role: 'ELEVE', eleve: { identifiant: critere.identifiantEleve } },
          select: SELECTION_UTILISATEUR,
        })
      : await prisma.utilisateur.findUnique({ where: critere, select: SELECTION_UTILISATEUR });

  // Même temps de calcul que le compte existe ou non
  const motDePasseValide = await verifierMotDePasse(
    motDePasse,
    utilisateur?.motDePasseHash ?? HACHE_FACTICE,
  );
  if (!utilisateur || !motDePasseValide) throw identifiantsInvalides();

  verifierAccesCompte(utilisateur);

  const { jetonAcces, jetonRafraichissement } = await ouvrirSession(utilisateur, meta);
  await prisma.utilisateur.update({
    where: { id: utilisateur.id },
    data: { derniereConnexionLe: new Date() },
  });
  return { jetonAcces, jetonRafraichissement, utilisateur: profil(utilisateur) };
}

const sessionInvalide = () =>
  new ErreurApi(401, 'SESSION_INVALIDE', 'Session expirée. Veuillez vous reconnecter.');

/** Révoque toutes les sessions actives d'un utilisateur (sauf, éventuellement, une). */
export function revoquerSessions(utilisateurId, { saufEmpreinte } = {}) {
  return prisma.jetonRafraichissement.updateMany({
    where: {
      utilisateurId,
      revoqueLe: null,
      ...(saufEmpreinte && { empreinte: { not: saufEmpreinte } }),
    },
    data: { revoqueLe: new Date() },
  });
}

/**
 * Échange un jeton de rafraîchissement contre une nouvelle paire de jetons.
 * Le jeton présenté est révoqué (rotation). Si un jeton déjà révoqué est
 * réutilisé, on suppose un vol : toutes les sessions du compte sont fermées.
 */
export async function rafraichir(jetonRafraichissement, meta) {
  if (!jetonRafraichissement) throw sessionInvalide();
  const empreinte = empreinteJeton(jetonRafraichissement);
  const session = await prisma.jetonRafraichissement.findUnique({ where: { empreinte } });
  if (!session) throw sessionInvalide();

  if (session.revoqueLe) {
    const recent = Date.now() - session.revoqueLe.getTime() < DELAI_GRACE_ROTATION_MS;
    if (!(recent && session.remplaceParId)) await revoquerSessions(session.utilisateurId);
    throw sessionInvalide();
  }
  if (session.expireLe <= new Date()) throw sessionInvalide();

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: session.utilisateurId },
    select: SELECTION_UTILISATEUR,
  });
  if (!utilisateur) throw sessionInvalide();
  try {
    verifierAccesCompte(utilisateur);
  } catch (erreur) {
    await revoquerSessions(utilisateur.id);
    throw erreur;
  }

  return prisma.$transaction(async (tx) => {
    // Révocation atomique : si une autre requête vient de faire la rotation, on s'arrête
    const { count } = await tx.jetonRafraichissement.updateMany({
      where: { id: session.id, revoqueLe: null },
      data: { revoqueLe: new Date() },
    });
    if (count === 0) throw sessionInvalide();

    const nouvelle = await ouvrirSession(utilisateur, meta, tx);
    await tx.jetonRafraichissement.update({
      where: { id: session.id },
      data: { remplaceParId: nouvelle.session.id },
    });
    return {
      jetonAcces: nouvelle.jetonAcces,
      jetonRafraichissement: nouvelle.jetonRafraichissement,
      utilisateur: profil(utilisateur),
    };
  });
}

export async function deconnexion(jetonRafraichissement) {
  if (!jetonRafraichissement) return;
  await prisma.jetonRafraichissement.updateMany({
    where: { empreinte: empreinteJeton(jetonRafraichissement), revoqueLe: null },
    data: { revoqueLe: new Date() },
  });
}

export async function moi(utilisateurId) {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: utilisateurId },
    select: SELECTION_UTILISATEUR,
  });
  if (!utilisateur) throw sessionInvalide();
  return profil(utilisateur);
}

/** Changement de mot de passe : ferme toutes les autres sessions du compte. */
export async function changerMotDePasse(utilisateurId, { ancien, nouveau }, jetonCourant) {
  const utilisateur = await prisma.utilisateur.findUnique({ where: { id: utilisateurId } });
  if (!utilisateur || !(await verifierMotDePasse(ancien, utilisateur.motDePasseHash))) {
    throw new ErreurApi(400, 'MOT_DE_PASSE_INCORRECT', 'Le mot de passe actuel est incorrect');
  }
  if (ancien === nouveau) {
    throw new ErreurApi(
      400,
      'MOT_DE_PASSE_IDENTIQUE',
      'Le nouveau mot de passe doit être différent',
    );
  }
  await prisma.utilisateur.update({
    where: { id: utilisateurId },
    data: { motDePasseHash: await hacherMotDePasse(nouveau), doitChangerMotDePasse: false },
  });
  await revoquerSessions(utilisateurId, {
    saufEmpreinte: jetonCourant ? empreinteJeton(jetonCourant) : undefined,
  });
}
