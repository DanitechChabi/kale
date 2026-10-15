// Calcul des moyennes et des rangs (logique pure, sans base de données).
//
// Moyenne d'une matière sur une période (formule APC usuelle au Bénin) :
//   (moyenne des interrogations + devoir 1 + devoir 2 + …) / nombre d'éléments
// La moyenne des interrogations compte pour un seul élément ; chaque devoir et
// chaque composition compte pour un élément. Toutes les notes sont ramenées sur 20.
//
// Moyenne générale : Σ(moyenne × coefficient) / Σ(coefficients), sur les matières
// obligatoires et, dans un groupe d'options (LV2…), la seule matière suivie.
// Matière facultative : seuls les points au-dessus de 10 s'ajoutent (× coefficient),
// sans augmenter le total des coefficients — comme les épreuves facultatives du bac.

/** Arrondi au centième, au plus proche (0,005 → 0,01). */
export const arrondir = (n) =>
  n === null || n === undefined ? null : Math.round((n + Number.EPSILON) * 100) / 100;

const moyenne = (valeurs) =>
  valeurs.length ? valeurs.reduce((s, v) => s + v, 0) / valeurs.length : null;

export const surVingt = (valeur, bareme) => (Number(valeur) * 20) / Number(bareme);

/**
 * Moyenne d'un élève dans une matière.
 * `notes` : [{ type: 'INTERROGATION'|'DEVOIR'|'COMPOSITION', valeur, bareme, absent }]
 */
export function moyenneMatiere(notes) {
  const comptees = notes.filter((n) => !n.absent && n.valeur !== null && n.valeur !== undefined);
  const interrogations = comptees
    .filter((n) => n.type === 'INTERROGATION')
    .map((n) => surVingt(n.valeur, n.bareme));
  const autres = comptees
    .filter((n) => n.type !== 'INTERROGATION')
    .map((n) => surVingt(n.valeur, n.bareme));
  const elements = [...(interrogations.length ? [moyenne(interrogations)] : []), ...autres];
  return {
    moyenne: arrondir(moyenne(elements)),
    moyenneInterrogations: arrondir(moyenne(interrogations)),
    nombreNotes: comptees.length,
  };
}

/**
 * Moyenne générale.
 * `matieres` : [{ enseignementId, coefficient, moyenne, estFacultative, groupeOption, suivie }]
 * `suivie` : l'élève suit cette matière (choix d'option ou matière facultative choisie).
 */
export function moyenneGenerale(matieres) {
  let points = 0;
  let coefficients = 0;
  let bonus = 0;
  const retenues = [];

  // Dans un groupe d'options, une seule matière : celle choisie, sinon celle qui a des notes
  const parGroupe = new Map();
  for (const m of matieres.filter((x) => x.groupeOption && !x.estFacultative)) {
    const actuelle = parGroupe.get(m.groupeOption);
    const meilleure =
      !actuelle ||
      (m.suivie && !actuelle.suivie) ||
      (m.suivie === actuelle.suivie && actuelle.moyenne === null && m.moyenne !== null);
    if (meilleure) parGroupe.set(m.groupeOption, m);
  }

  for (const m of matieres) {
    if (m.moyenne === null || m.moyenne === undefined) continue;
    if (m.estFacultative) {
      if (m.suivie === false) continue;
      const surplus = Math.max(0, m.moyenne - 10) * m.coefficient;
      bonus += surplus;
      retenues.push(m.enseignementId);
      continue;
    }
    if (m.groupeOption && parGroupe.get(m.groupeOption) !== m) continue;
    points += m.moyenne * m.coefficient;
    coefficients += m.coefficient;
    retenues.push(m.enseignementId);
  }

  return {
    moyenne: coefficients ? arrondir(Math.min(20, (points + bonus) / coefficients)) : null,
    totalPoints: arrondir(points + bonus),
    totalCoefficients: coefficients,
    bonusFacultatif: arrondir(bonus),
    enseignementsRetenus: retenues,
  };
}

/**
 * Rangs avec ex æquo : deux moyennes égales (au centième) ont le même rang,
 * le suivant est décalé (1, 2, 2, 4). Les moyennes absentes ne sont pas classées.
 * `elements` : [{ id, moyenne }] → Map(id → { rang, exAequo })
 */
export function classer(elements) {
  const classes = elements
    .filter((e) => e.moyenne !== null && e.moyenne !== undefined)
    .sort((a, b) => b.moyenne - a.moyenne);
  const rangs = new Map();
  classes.forEach((e, i) => {
    const precedent = classes[i - 1];
    const rang =
      precedent && arrondir(precedent.moyenne) === arrondir(e.moyenne)
        ? rangs.get(precedent.id).rang
        : i + 1;
    rangs.set(e.id, { rang, exAequo: false });
  });
  const parRang = new Map();
  for (const { rang } of rangs.values()) parRang.set(rang, (parRang.get(rang) ?? 0) + 1);
  for (const valeur of rangs.values()) valeur.exAequo = parRang.get(valeur.rang) > 1;
  return rangs;
}

/** Statistiques d'une série de moyennes (classe, matière). */
export function statistiques(valeurs) {
  const v = valeurs.filter((x) => x !== null && x !== undefined);
  if (!v.length) return { moyenne: null, min: null, max: null, tauxReussite: null, effectif: 0 };
  return {
    moyenne: arrondir(moyenne(v)),
    min: arrondir(Math.min(...v)),
    max: arrondir(Math.max(...v)),
    tauxReussite: arrondir((v.filter((x) => x >= 10).length / v.length) * 100),
    effectif: v.length,
  };
}

/** Moyenne annuelle : moyenne des périodes disponibles. */
export const moyenneAnnuelle = (moyennesPeriodes) =>
  arrondir(moyenne(moyennesPeriodes.filter((m) => m !== null)));
