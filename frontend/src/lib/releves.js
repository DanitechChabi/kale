// Bulletins, relevés archivés et duplicata : libellés et utilitaires d'affichage.
import { ouvrirDocument } from './documents.js';

export const LIBELLES_TYPES_DOCUMENT = {
  BULLETIN_PERIODE: 'Bulletin de période',
  RELEVE_ANNUEL: 'Relevé annuel',
};

export const STATUTS_DEMANDE = {
  EN_ATTENTE: ['À traiter', 'ambre'],
  EN_COURS: ['En cours', 'bleu'],
  DELIVREE: ['Délivrée', 'vert'],
  REJETEE: ['Rejetée', 'rouge'],
};

const ordinal = (n) => (n === 1 ? '1er' : `${n}e`);

/** « Bulletin du 1er trimestre » / « Relevé annuel » */
export function titreDocument({ type, periode }) {
  if (type !== 'BULLETIN_PERIODE' || !periode) return LIBELLES_TYPES_DOCUMENT[type];
  return `Bulletin du ${ordinal(periode.numero)} ${periode.type === 'SEMESTRE' ? 'semestre' : 'trimestre'}`;
}

/** Période déclarée dans une demande de duplicata (numéro seul) */
export const libellePeriodeDemande = (type, numero) =>
  type === 'BULLETIN_PERIODE' ? `${ordinal(numero)} trimestre ou semestre` : 'Année complète';

/** Adresse publique de vérification (page légère servie par l'API). */
export const lienVerification = (numeroAffiche) => `/verifier/${numeroAffiche}`;

/** Ouvre le PDF archivé (jeton d'accès en mémoire : pas de lien direct). */
export const ouvrirPdf = (chemin) => ouvrirDocument(chemin);

/** « B25-7K3M-Q9P2X » : numéro saisi tolérant (espaces, minuscules) → adresse de vérification */
export function adresseVerification(saisie) {
  const numero = saisie.trim().toUpperCase().replace(/\s+/g, '');
  return `/verifier?numero=${encodeURIComponent(numero)}`;
}
