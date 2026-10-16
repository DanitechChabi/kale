// Tableau de bord du ministère : indicateurs, formats et classes de la carte.

const entier = new Intl.NumberFormat('fr-FR');
const decimal = (d) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Valeur lisible, ou « — » si l'indicateur n'est pas disponible. */
export function formater(valeur, unite = '') {
  if (valeur === null || valeur === undefined) return '—';
  const texte = Number.isInteger(valeur) ? entier.format(valeur) : decimal(1).format(valeur);
  return unite ? `${texte}${unite === '%' ? ' %' : ` ${unite}`}` : texte;
}

export const formaterMoyenne = (v) => (v === null || v === undefined ? '—' : decimal(2).format(v));

/** « 30 h » ou « 2,5 j » selon la durée. */
export function formaterDelai(heures) {
  if (heures === null || heures === undefined) return '—';
  return heures < 48
    ? `${decimal(heures < 10 ? 1 : 0).format(heures)} h`
    : `${decimal(1).format(heures / 24)} j`;
}

/** Indicateurs proposés sur la carte (plus foncé = plus élevé). */
export const INDICATEURS_CARTE = [
  {
    cle: 'effectif',
    libelle: 'Élèves',
    lire: (z) => z.effectif || null,
    // Bornes de la légende arrondies : un effectif est entier
    afficher: (v) => formater(v === null ? v : Math.round(v)),
  },
  {
    cle: 'tauxReussite',
    libelle: 'Réussite',
    lire: (z) => z.tauxReussite,
    afficher: (v) => formater(v, '%'),
  },
  {
    cle: 'moyenneGenerale',
    libelle: 'Moyenne',
    lire: (z) => z.moyenneGenerale,
    afficher: formaterMoyenne,
  },
  {
    cle: 'tauxAbsence',
    libelle: 'Absences',
    lire: (z) => z.tauxAbsence,
    afficher: (v) => formater(v, '%'),
  },
  {
    cle: 'delaiDuplicata',
    libelle: 'Délai duplicata',
    lire: (z) => z.duplicatas.delaiMoyenHeures,
    afficher: formaterDelai,
  },
];

// Rampe séquentielle (une teinte, du clair au foncé) : jetons marque-100 → marque-800
export const RAMPE = ['#d4ecdd', '#b4dcc4', '#34b36f', '#0b7a3f', '#0a4a2a'];
export const SANS_DONNEE = '#eef1ef';

/**
 * Cinq classes d'égale amplitude entre le minimum et le maximum observés.
 * Renvoie les bornes et la fonction qui donne la couleur d'une valeur.
 */
export function classes(valeurs) {
  const presentes = valeurs.filter((v) => v !== null && v !== undefined);
  if (!presentes.length) return { bornes: [], couleur: () => SANS_DONNEE };
  const min = Math.min(...presentes);
  const max = Math.max(...presentes);
  const pas = (max - min) / RAMPE.length;
  const bornes = RAMPE.map((_, i) => [
    min + i * pas,
    i === RAMPE.length - 1 ? max : min + (i + 1) * pas,
  ]);
  const couleur = (v) => {
    if (v === null || v === undefined) return SANS_DONNEE;
    if (max === min) return RAMPE[RAMPE.length - 1];
    return RAMPE[Math.min(RAMPE.length - 1, Math.floor((v - min) / pas))];
  };
  return { bornes: max === min ? [[min, max]] : bornes, couleur, uniques: max === min };
}

export const LIBELLES_PERIODES = (cle) => {
  if (cle === 'ANNUEL') return 'Année';
  const [type, numero] = cle.split('-');
  return `${type === 'SEMESTRE' ? 'Semestre' : 'Trimestre'} ${numero}`;
};

export const LIBELLES_NIVEAUX_COURTS = {
  SIXIEME: '6e',
  CINQUIEME: '5e',
  QUATRIEME: '4e',
  TROISIEME: '3e',
  SECONDE: '2nde',
  PREMIERE: '1re',
  TERMINALE: 'Tle',
};
