// =============================================================================
// Référentiel pédagogique par défaut : séries, matières et programmes.
//
// Sert à proposer automatiquement les matières (et coefficients) d'une classe
// à sa création. L'établissement peut ensuite ajuster ; le ministère peut
// corriger ce référentiel depuis la plateforme.
//
// IMPORTANT : aucune grille officielle complète n'est publiée en ligne. Chaque
// ligne porte donc sa source et estVerifie = false tant qu'elle n'a pas été
// confirmée sur un texte officiel (arrêté, circulaire du MESTFP).
// =============================================================================

const SRC_SERIES = 'Office du Baccalauréat du Bénin — liste des séries';
const SRC_COEF_1ER_CYCLE =
  'Communiqué du ministre des Enseignements secondaires (févr. 2020), applicable 2021-2022 : maths 3, EPS 1, autres 2 — rapporté par la presse';
const SRC_BAC_2003 =
  'Office du Bac — épreuves du baccalauréat, arrêté interministériel n° 016-2003 (modifié depuis)';
const SRC_PRESSE_BAC = 'Coefficients du bac relevés sur des sites d’orientation (non officiels)';
const A_CONFIRMER = 'À confirmer par le ministère (aucune source publique trouvée)';

/** Séries du second cycle */
export const series = [
  { code: 'A1', libelle: 'Lettres - Langues', ordre: 'GENERAL' },
  { code: 'A2', libelle: 'Lettres - Sciences humaines', ordre: 'GENERAL' },
  { code: 'B', libelle: 'Lettres - Sciences sociales', ordre: 'GENERAL' },
  { code: 'C', libelle: 'Mathématiques - Sciences physiques', ordre: 'GENERAL' },
  { code: 'D', libelle: 'Biologie - Géologie', ordre: 'GENERAL' },
  { code: 'E', libelle: 'Mathématiques et Techniques', ordre: 'TECHNIQUE' },
  { code: 'F1', libelle: 'Construction mécanique', ordre: 'TECHNIQUE' },
  { code: 'F2', libelle: 'Électronique', ordre: 'TECHNIQUE' },
  { code: 'F3', libelle: 'Électrotechnique', ordre: 'TECHNIQUE' },
  { code: 'F4', libelle: 'Génie civil', ordre: 'TECHNIQUE' },
  { code: 'G1', libelle: 'Techniques administratives', ordre: 'TECHNIQUE' },
  { code: 'G2', libelle: 'Techniques quantitatives de gestion', ordre: 'TECHNIQUE' },
  { code: 'G3', libelle: 'Techniques commerciales', ordre: 'TECHNIQUE' },
  { code: 'EA', libelle: 'Eau et Assainissement', ordre: 'TECHNIQUE' },
].map((s) => ({ ...s, source: SRC_SERIES }));

/** Catalogue national des disciplines (ordre = ordre d'affichage sur le bulletin) */
export const matieres = [
  ['FR', 'Français', 'Français'],
  ['ANG', 'Anglais', 'Anglais'],
  ['LV2-ALL', 'Allemand (LV2)', 'Allemand'],
  ['LV2-ESP', 'Espagnol (LV2)', 'Espagnol'],
  ['PHILO', 'Philosophie', 'Philo'],
  ['HG', 'Histoire-Géographie', 'Hist-Géo'],
  ['ECO', 'Économie', 'Économie'],
  ['MATH', 'Mathématiques', 'Maths'],
  ['PCT', 'Physique-Chimie et Technologie', 'PCT'],
  ['SVT', 'Sciences de la Vie et de la Terre', 'SVT'],
  ['EPS', 'Éducation Physique et Sportive', 'EPS'],
  // Enseignements de spécialité des séries techniques (intitulés génériques à
  // remplacer par les disciplines exactes de chaque lycée technique)
  ['SPE-E', 'Enseignements technologiques (série E)', 'Techno E'],
  ['SPE-F1', 'Construction mécanique', 'Constr. méca.'],
  ['SPE-F2', 'Électronique', 'Électronique'],
  ['SPE-F3', 'Électrotechnique', 'Électrotech.'],
  ['SPE-F4', 'Génie civil', 'Génie civil'],
  ['SPE-G1', 'Techniques administratives', 'Tech. admin.'],
  ['SPE-G2', 'Techniques quantitatives de gestion', 'TQG'],
  ['SPE-G3', 'Techniques commerciales', 'Tech. com.'],
  ['SPE-EA', 'Eau et Assainissement', 'Eau & assain.'],
  ['COMPTA', 'Comptabilité', 'Compta'],
  ['DROIT', 'Droit', 'Droit'],
].map(([code, nom, nomCourt], i) => ({ code, nom, nomCourt, ordreAffichage: (i + 1) * 10 }));

// -----------------------------------------------------------------------------
// Construction des programmes
// -----------------------------------------------------------------------------

/** Ligne de programme : [code matière, coefficient, options] */
function ligne(niveau, serie, [matiere, coefficient, options = {}], source) {
  return {
    niveau,
    serie, // code de série ou null au premier cycle
    matiere,
    coefficient,
    groupeOption: options.groupeOption ?? null,
    estVerifie: false,
    source: options.source ?? source,
  };
}

// --- Premier cycle (6e à 3e) : pas de série --------------------------------
const tronc1erCycle = [
  ['FR', 2],
  ['ANG', 2],
  ['MATH', 3],
  ['PCT', 2],
  ['SVT', 2],
  ['HG', 2],
  ['EPS', 1],
];
// Deuxième langue vivante au choix à partir de la 4e
const lv2 = [
  ['LV2-ALL', 2, { groupeOption: 'LV2', source: A_CONFIRMER }],
  ['LV2-ESP', 2, { groupeOption: 'LV2', source: A_CONFIRMER }],
];

const premierCycle = [
  ...['SIXIEME', 'CINQUIEME'].flatMap((niveau) =>
    tronc1erCycle.map((l) => ligne(niveau, null, l, SRC_COEF_1ER_CYCLE)),
  ),
  ...['QUATRIEME', 'TROISIEME'].flatMap((niveau) =>
    [...tronc1erCycle, ...lv2].map((l) => ligne(niveau, null, l, SRC_COEF_1ER_CYCLE)),
  ),
];

// --- Second cycle général ----------------------------------------------------
// Coefficients alignés sur ceux du baccalauréat. La philosophie n'est proposée
// qu'en terminale (à confirmer pour la première).
const lv2Lycee = [
  ['LV2-ALL', 2, { groupeOption: 'LV2' }],
  ['LV2-ESP', 2, { groupeOption: 'LV2' }],
];
const generales = {
  A1: {
    source: SRC_BAC_2003,
    lignes: [
      ['FR', 5],
      ['PHILO', 4],
      ['HG', 3],
      ['ANG', 3],
      ...lv2Lycee,
      ['MATH', 2],
      ['SVT', 2],
      ['EPS', 1],
    ],
  },
  A2: {
    source: SRC_BAC_2003,
    lignes: [
      ['FR', 4],
      ['PHILO', 3],
      ['HG', 5],
      ['ANG', 3],
      ...lv2Lycee,
      ['MATH', 2],
      ['SVT', 2],
      ['EPS', 1],
    ],
  },
  B: {
    source: SRC_PRESSE_BAC,
    lignes: [
      ['FR', 4],
      ['PHILO', 3],
      ['HG', 4],
      ['ECO', 4],
      ['MATH', 2],
      ['ANG', 2],
      ['EPS', 1],
    ],
  },
  C: {
    source: SRC_PRESSE_BAC,
    lignes: [
      ['MATH', 6],
      ['PCT', 5],
      ['SVT', 2],
      ['FR', 3],
      ['PHILO', 2],
      ['ANG', 2],
      ['HG', 2],
      ['EPS', 1],
    ],
  },
  D: {
    source:
      'gouv.bj (exemple de calcul : SVT 5, Maths 4, PCT 4) ; autres matières : ' + SRC_PRESSE_BAC,
    lignes: [
      ['SVT', 5],
      ['MATH', 4],
      ['PCT', 4],
      ['FR', 3],
      ['PHILO', 2],
      ['ANG', 2],
      ['HG', 2],
      ['EPS', 1],
    ],
  },
};

// --- Second cycle technique --------------------------------------------------
// Tronc commun + une spécialité générique : chaque lycée technique remplace
// la spécialité par ses disciplines exactes. Coefficients indicatifs.
const tronc = (maths, extra = []) => [
  ['FR', 2],
  ['ANG', 2],
  ['PHILO', 2],
  ['MATH', maths],
  ...extra,
  ['EPS', 1],
];
const techniques = {
  E: tronc(5, [
    ['PCT', 4],
    ['SPE-E', 5],
  ]),
  F1: tronc(4, [
    ['PCT', 3],
    ['SPE-F1', 6],
  ]),
  F2: tronc(4, [
    ['PCT', 3],
    ['SPE-F2', 6],
  ]),
  F3: tronc(4, [
    ['PCT', 3],
    ['SPE-F3', 6],
  ]),
  F4: tronc(4, [
    ['PCT', 3],
    ['SPE-F4', 6],
  ]),
  G1: tronc(2, [
    ['ECO', 3],
    ['DROIT', 3],
    ['SPE-G1', 6],
  ]),
  G2: tronc(3, [
    ['ECO', 3],
    ['COMPTA', 5],
    ['SPE-G2', 5],
  ]),
  G3: tronc(2, [
    ['ECO', 3],
    ['DROIT', 2],
    ['COMPTA', 3],
    ['SPE-G3', 6],
  ]),
  EA: tronc(4, [
    ['PCT', 4],
    ['SVT', 2],
    ['SPE-EA', 6],
  ]),
};

const niveauxLycee = ['SECONDE', 'PREMIERE', 'TERMINALE'];
const sansPhiloAvantTerminale = (niveau) => (l) => niveau === 'TERMINALE' || l[0] !== 'PHILO';

const secondCycle = [
  ...Object.entries(generales).flatMap(([serie, { source, lignes }]) =>
    niveauxLycee.flatMap((niveau) =>
      lignes
        .filter(sansPhiloAvantTerminale(niveau))
        .map((l) =>
          ligne(
            niveau,
            serie,
            l,
            niveau === 'TERMINALE'
              ? source
              : `${source} (appliqué par analogie à la ${niveau.toLowerCase()})`,
          ),
        ),
    ),
  ),
  ...Object.entries(techniques).flatMap(([serie, lignes]) =>
    niveauxLycee.flatMap((niveau) =>
      lignes
        .filter(sansPhiloAvantTerminale(niveau))
        .map((l) => ligne(niveau, serie, l, A_CONFIRMER)),
    ),
  ),
];

/** Programme par défaut de chaque niveau / série */
export const programmes = [...premierCycle, ...secondCycle];
