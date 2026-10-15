// Contenu des bulletins et relevés : libellés, appréciations, mise en forme.
// Logique pure, partagée par la génération du PDF et la page de vérification.

/** Appréciation d'une moyenne sur 20 (barème usuel des bulletins). */
export function appreciation(moyenne) {
  if (moyenne === null || moyenne === undefined) return '';
  if (moyenne >= 16) return 'Très bien';
  if (moyenne >= 14) return 'Bien';
  if (moyenne >= 12) return 'Assez bien';
  if (moyenne >= 10) return 'Passable';
  if (moyenne >= 8) return 'Insuffisant';
  if (moyenne >= 5) return 'Faible';
  return 'Très faible';
}

/**
 * Distinction accordée d'après la moyenne générale. Seules les distinctions
 * positives sont automatiques ; les sanctions relèvent du conseil de classe.
 */
export function distinction(moyenne) {
  if (moyenne === null || moyenne === undefined) return null;
  if (moyenne >= 16) return 'Félicitations';
  if (moyenne >= 14) return 'Encouragements';
  if (moyenne >= 12) return 'Tableau d’honneur';
  return null;
}

/** 12.5 → « 12,50 » ; vide → « – » */
export const note = (n, decimales = 2) =>
  n === null || n === undefined ? '–' : Number(n).toFixed(decimales).replace('.', ',');

export const rang = (r, exAequo = false) =>
  r ? `${r}${r === 1 ? 'er' : 'e'}${exAequo ? ' ex æquo' : ''}` : '–';

export const ordinalPeriode = (numero) => (numero === 1 ? '1er' : `${numero}e`);

export const libellePeriode = (periode) =>
  periode
    ? `${ordinalPeriode(periode.numero)} ${periode.type === 'SEMESTRE' ? 'semestre' : 'trimestre'}`
    : 'Année complète';

export const libelleCourtPeriode = (periode) =>
  `${periode.type === 'SEMESTRE' ? 'S' : 'T'}${periode.numero}`;

export const titreDocument = (donnees) =>
  donnees.type === 'BULLETIN_PERIODE'
    ? `Bulletin de notes du ${libellePeriode(donnees.periode)}`
    : 'Relevé de notes annuel';

export const dateLongue = (date) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Porto-Novo',
  }).format(new Date(date));

export const LIBELLES_TYPES_ETABLISSEMENT = {
  CEG: 'Collège d’enseignement général',
  LYCEE: 'Lycée',
  LYCEE_TECHNIQUE: 'Lycée technique et professionnel',
  COMPLEXE_SCOLAIRE: 'Complexe scolaire',
};
