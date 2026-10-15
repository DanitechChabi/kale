import { appelApi } from './api.js';

export const LIBELLES_PIECES = {
  AUTORISATION_CREATION_OUVERTURE: 'Arrêté d’autorisation de création et d’ouverture',
  AUTORISATION_DIRIGER: 'Autorisation de diriger du chef d’établissement',
  ACTE_NOMINATION_CHEF: 'Acte de nomination du chef d’établissement',
  PIECE_IDENTITE_RESPONSABLE: 'Pièce d’identité du responsable du compte',
  LETTRE_MANDAT: 'Lettre désignant le responsable du compte',
  AUTRE: 'Autre document',
};

/** Pièces obligatoires selon le statut de l'établissement (identique à l'API). */
export const piecesObligatoires = (statut) =>
  statut === 'PUBLIC'
    ? ['ACTE_NOMINATION_CHEF', 'PIECE_IDENTITE_RESPONSABLE']
    : ['AUTORISATION_CREATION_OUVERTURE', 'AUTORISATION_DIRIGER', 'PIECE_IDENTITE_RESPONSABLE'];

export const TYPES_ACCEPTES = 'application/pdf,image/jpeg,image/png';
export const TAILLE_MAX_OCTETS = 5 * 1024 * 1024;

/** Contrôle côté navigateur avant l'envoi (le serveur revérifie le contenu). */
export function controlerFichier(fichier) {
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(fichier.type)) {
    return 'Format accepté : PDF, JPEG ou PNG';
  }
  if (fichier.size > TAILLE_MAX_OCTETS) return 'Fichier trop volumineux (5 Mo au maximum)';
  return null;
}

/** Ouvre un document protégé dans un nouvel onglet (le jeton ne peut pas passer dans un lien). */
export async function ouvrirDocument(chemin) {
  const fenetre = window.open('', '_blank');
  const contenu = await appelApi(chemin, { format: 'blob' });
  const url = URL.createObjectURL(contenu);
  if (fenetre) fenetre.location.href = url;
  else window.location.assign(url);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
