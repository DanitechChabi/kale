// Éligibilité EduMail : uniquement à partir des données que l'établissement a validées.
//
// - L'élève doit avoir une fiche reliée à son compte, dans un établissement vérifié et
//   actif : sinon il n'est pas éligible (aucune demande possible).
// - Sans inscription « INSCRIT » dans l'année scolaire courante, les données sont
//   insuffisantes : la demande est « à vérifier » par l'établissement, jamais refusée
//   ni approuvée automatiquement.
// - Le consentement du représentant légal suit la politique configurée
//   (EDUMAIL_CONSENTEMENT) ; aucun âge n'est fixé par défaut.
import { config } from '../../config/env.js';

export const STATUTS_OUVERTS = [
  'A_VERIFIER',
  'EN_ATTENTE_CONSENTEMENT',
  'EN_ATTENTE_DECISION',
  'APPROUVE',
  'EN_COURS',
  'ERREUR',
  'ACTIF',
  'SUSPENDU',
];
export const STATUTS_EN_ATTENTE = ['A_VERIFIER', 'EN_ATTENTE_CONSENTEMENT', 'EN_ATTENTE_DECISION'];

/** Âge révolu à une date donnée. */
export function age(dateNaissance, le = new Date()) {
  const n = new Date(dateNaissance);
  let a = le.getUTCFullYear() - n.getUTCFullYear();
  const anniversairePasse =
    le.getUTCMonth() > n.getUTCMonth() ||
    (le.getUTCMonth() === n.getUTCMonth() && le.getUTCDate() >= n.getUTCDate());
  if (!anniversairePasse) a -= 1;
  return a;
}

/** Le consentement du représentant légal est-il requis pour cet élève ? */
export function consentementRequis(eleve, politique = config) {
  if (politique.EDUMAIL_CONSENTEMENT === 'jamais') return false;
  if (politique.EDUMAIL_CONSENTEMENT === 'avant_age') {
    return age(eleve.dateNaissance) < politique.EDUMAIL_AGE_CONSENTEMENT;
  }
  return true;
}

/** Un consentement valable : non retiré, et vérifié s'il repose sur une attestation écrite. */
export const consentementValable = (c) =>
  !c.retireLe && (c.mode === 'ESPACE_PARENT' || Boolean(c.valideLe));

/**
 * Situation scolaire d'un élève (client isolé de son établissement).
 * Ne renvoie que ce qui est utile à la décision.
 */
export async function situationEleve(db, eleveId) {
  const eleve = await db.eleve.findUnique({
    where: { id: eleveId },
    select: {
      id: true,
      nom: true,
      prenoms: true,
      dateNaissance: true,
      utilisateurId: true,
      ecole: { select: { statutVerification: true, actif: true } },
      inscriptions: {
        where: { anneeScolaire: { estCourante: true } },
        select: {
          statut: true,
          classe: { select: { nom: true } },
          anneeScolaire: { select: { libelle: true } },
        },
        take: 1,
      },
    },
  });
  if (!eleve) return { statut: 'NON_ELIGIBLE', motif: 'FICHE_INTROUVABLE' };
  const inscription = eleve.inscriptions[0] ?? null;
  const base = {
    eleve,
    inscription: inscription && {
      statut: inscription.statut,
      classe: inscription.classe.nom,
      anneeScolaire: inscription.anneeScolaire.libelle,
    },
  };
  if (!eleve.utilisateurId) return { ...base, statut: 'NON_ELIGIBLE', motif: 'SANS_COMPTE' };
  if (eleve.ecole.statutVerification !== 'VERIFIEE' || !eleve.ecole.actif) {
    return { ...base, statut: 'NON_ELIGIBLE', motif: 'ECOLE_NON_VERIFIEE' };
  }
  if (!inscription || inscription.statut !== 'INSCRIT') {
    return { ...base, statut: 'A_VERIFIER', motif: 'INSCRIPTION_A_VERIFIER' };
  }
  return { ...base, statut: 'ELIGIBLE', motif: null };
}

/** Statut d'attente d'un dossier, d'après la situation scolaire et le consentement. */
export function statutAttente(situation, { requis, obtenu }) {
  if (situation.statut !== 'ELIGIBLE') return 'A_VERIFIER';
  if (requis && !obtenu) return 'EN_ATTENTE_CONSENTEMENT';
  return 'EN_ATTENTE_DECISION';
}
