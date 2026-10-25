// EduMail : libellés partagés par les pages élève, parent, établissement et nationales.

/** Pastilles de statut d'un dossier (table pour <Badge>). */
export const STATUTS_EDUMAIL = {
  A_VERIFIER: ['À vérifier', 'ambre'],
  EN_ATTENTE_CONSENTEMENT: ['Consentement attendu', 'ambre'],
  EN_ATTENTE_DECISION: ['Décision attendue', 'bleu'],
  APPROUVE: ['Approuvé', 'bleu'],
  EN_COURS: ['Création en cours', 'bleu'],
  ERREUR: ['Erreur de création', 'rouge'],
  ACTIF: ['Actif', 'vert'],
  SUSPENDU: ['Suspendu', 'gris'],
  REFUSE: ['Refusé', 'rouge'],
  CLOTURE: ['Clôturé', 'gris'],
};

/** Explication donnée à l'élève pour chaque étape. */
export const EXPLICATIONS_STATUT = {
  A_VERIFIER:
    'Votre établissement doit d’abord vérifier votre inscription de cette année. Aucune action n’est nécessaire de votre part.',
  EN_ATTENTE_CONSENTEMENT:
    'Votre parent ou représentant légal doit donner son accord, depuis son espace parent ou par une attestation écrite remise au secrétariat.',
  EN_ATTENTE_DECISION: 'Votre dossier est complet. La direction de l’établissement va l’examiner.',
  APPROUVE:
    'Votre demande est approuvée. La boîte sera créée dès que le service de messagerie de l’établissement sera disponible.',
  EN_COURS: 'Votre boîte est en cours de création.',
  ERREUR:
    'La création de votre boîte n’a pas abouti. L’établissement a été informé et relancera la création.',
  ACTIF: 'Votre compte EduMail est ouvert.',
  SUSPENDU: 'Votre compte est suspendu par l’établissement.',
  REFUSE: 'Votre demande a été refusée par l’établissement.',
  CLOTURE: 'Votre compte a été clôturé. Adressez-vous à la direction pour toute question.',
};

export const LIBELLES_EVENEMENT = {
  DEMANDE: 'Demande de l’élève',
  REEVALUATION: 'Mise à jour automatique du dossier',
  CONSENTEMENT_DONNE: 'Consentement donné par le parent',
  CONSENTEMENT_RETIRE: 'Consentement retiré',
  ATTESTATION_DEPOSEE: 'Attestation écrite déposée',
  ATTESTATION_VALIDEE: 'Attestation écrite vérifiée',
  APPROBATION: 'Demande approuvée',
  APPROBATION_PAR_DELEGATION: 'Demande approuvée (secrétariat, sur délégation)',
  REFUS: 'Demande refusée',
  REFUS_PAR_DELEGATION: 'Demande refusée (secrétariat, sur délégation)',
  CREATION_NON_ACTIVEE: 'Création impossible : service non configuré',
  CREATION_DEMARREE: 'Création démarrée',
  CREATION_REUSSIE: 'Boîte créée',
  CREATION_REPRISE: 'Boîte retrouvée chez le fournisseur et reprise',
  CREATION_ECHOUEE: 'Échec de la création',
  CREATION_INTERROMPUE: 'Création interrompue',
  SUSPENSION: 'Compte suspendu',
  REACTIVATION: 'Compte réactivé',
  CLOTURE: 'Compte clôturé',
  REINITIALISATION: 'Accès réinitialisé',
  REINITIALISATION_REFUSEE: 'Réinitialisation refusée (mot de passe incorrect)',
  SIGNALEMENT: 'Signalement de l’élève',
  A_REEXAMINER: 'Compte à réexaminer',
  REEXAMEN_TERMINE: 'Réexamen terminé',
};

export const LIBELLES_REEXAMEN = {
  CONSENTEMENT_RETIRE: 'Consentement retiré',
  PLUS_INSCRIT: 'Élève non inscrit cette année',
};

export const CATEGORIES_SIGNALEMENT = {
  IDENTITE: 'Erreur sur mon identité',
  INSCRIPTION: 'Erreur sur mon inscription',
  AUTRE: 'Autre problème',
};

export const STATUTS_SIGNALEMENT = {
  OUVERT: ['Ouvert', 'ambre'],
  TRAITE: ['Traité', 'vert'],
  REJETE: ['Rejeté', 'gris'],
};

export const LIENS_REPRESENTANT = [
  { valeur: 'MERE', libelle: 'Mère' },
  { valeur: 'PERE', libelle: 'Père' },
  { valeur: 'TUTEUR', libelle: 'Tuteur ou tutrice' },
  { valeur: 'AUTRE', libelle: 'Autre représentant légal' },
];

/** Phrase décrivant la politique de consentement configurée. */
export function politiqueConsentement({ politique, age }) {
  if (politique === 'jamais') return 'Le consentement du représentant légal n’est pas demandé.';
  if (politique === 'avant_age')
    return `Le consentement du représentant légal est demandé pour les élèves de moins de ${age} ans.`;
  return 'Le consentement du représentant légal est demandé pour chaque élève.';
}
