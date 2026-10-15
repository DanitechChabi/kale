// Pièces justificatives exigées pour la vérification d'un établissement.
// Établissement public : acte de nomination du chef d'établissement.
// Établissement privé : arrêté d'autorisation de création et d'ouverture
// (décret n° 2007-279) et autorisation de diriger du chef d'établissement.
// Dans tous les cas : pièce d'identité du responsable du compte.

export const TYPES_PIECES = [
  'AUTORISATION_CREATION_OUVERTURE',
  'AUTORISATION_DIRIGER',
  'ACTE_NOMINATION_CHEF',
  'PIECE_IDENTITE_RESPONSABLE',
  'LETTRE_MANDAT',
  'AUTRE',
];

export const LIBELLES_PIECES = {
  AUTORISATION_CREATION_OUVERTURE: 'Arrêté d’autorisation de création et d’ouverture',
  AUTORISATION_DIRIGER: 'Autorisation de diriger du chef d’établissement',
  ACTE_NOMINATION_CHEF: 'Acte de nomination du chef d’établissement',
  PIECE_IDENTITE_RESPONSABLE: 'Pièce d’identité du responsable du compte',
  LETTRE_MANDAT: 'Lettre désignant le responsable du compte',
  AUTRE: 'Autre document',
};

export function piecesObligatoires(statut) {
  return statut === 'PUBLIC'
    ? ['ACTE_NOMINATION_CHEF', 'PIECE_IDENTITE_RESPONSABLE']
    : ['AUTORISATION_CREATION_OUVERTURE', 'AUTORISATION_DIRIGER', 'PIECE_IDENTITE_RESPONSABLE'];
}

/** Pièces obligatoires qui n'ont pas encore de document accepté. */
export function piecesNonAcceptees(statut, documents) {
  return piecesObligatoires(statut).filter(
    (type) => !documents.some((d) => d.type === type && d.statut === 'ACCEPTE'),
  );
}

/** Pièces obligatoires sans aucun document déposé (ou seulement refusés). */
export function piecesManquantes(statut, documents) {
  return piecesObligatoires(statut).filter(
    (type) => !documents.some((d) => d.type === type && d.statut !== 'REFUSE'),
  );
}
