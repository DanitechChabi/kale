// Normalisation des valeurs d'une liste d'élèves telle que les établissements
// la tiennent réellement : en-têtes variés, lignes de titre, nom et prénoms dans
// une seule colonne, dates dans tous les formats, sexe en toutes lettres…
import { normaliserTelephone } from '../../utils/identifiants.js';

/** « Date de naissance » → « datedenaissance » */
export const simplifier = (texte) =>
  String(texte ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// En-têtes reconnus pour chaque champ (forme simplifiée)
const SYNONYMES = {
  nomComplet: [
    'nometprenoms',
    'nomsetprenoms',
    'nomprenoms',
    'nomsprenoms',
    'nomcomplet',
    'eleve',
    'eleves',
    'identite',
  ],
  nom: ['nom', 'noms', 'nomdeleleve', 'nomdefamille', 'patronyme', 'lastname'],
  prenoms: ['prenom', 'prenoms', 'firstname'],
  sexe: ['sexe', 'genre', 'sex', 's', 'gf', 'mf'],
  dateNaissance: [
    'datedenaissance',
    'datenaissance',
    'nele',
    'nee',
    'neele',
    'neeele',
    'ddn',
    'naissance',
    'datenais',
    'birthdate',
  ],
  lieuNaissance: ['lieudenaissance', 'lieunaissance', 'lieu', 'a', 'nea', 'lieunais'],
  matricule: ['matricule', 'mat', 'numeromatricule', 'nmatricule', 'nummatricule'],
  npi: ['npi', 'numeropersonneldidentification'],
  classe: ['classe', 'classes', 'salle'],
  nomContactParent: [
    'nomduparent',
    'nomparent',
    'parent',
    'parents',
    'tuteur',
    'nomdututeur',
    'parenttuteur',
    'nomduparentoututeur',
  ],
  telephoneContactParent: [
    'telephoneduparent',
    'telephoneparent',
    'telparent',
    'contactparent',
    'contactduparent',
    'telephone',
    'tel',
    'contact',
    'telephonedututeur',
    'numeroparent',
  ],
};

const INDEX_SYNONYMES = new Map(
  Object.entries(SYNONYMES).flatMap(([champ, liste]) => liste.map((s) => [s, champ])),
);

export const champPourEntete = (entete) => INDEX_SYNONYMES.get(simplifier(entete)) ?? null;

/**
 * Repère la ligne d'en-têtes parmi les 15 premières lignes (les fichiers ont
 * souvent un titre, le nom de l'établissement, l'année…).
 */
export function detecterEntetes(lignes) {
  let meilleure = { index: -1, colonnes: [] };
  lignes.slice(0, 15).forEach((cellules, index) => {
    const colonnes = cellules.map((entete, position) => ({
      position,
      entete: String(entete ?? '').trim(),
      champ: champPourEntete(entete),
    }));
    const reconnues = colonnes.filter((c) => c.champ);
    if (reconnues.length > meilleure.colonnes.filter((c) => c.champ).length)
      meilleure = { index, colonnes };
  });
  // Un même champ n'est retenu qu'une fois (première colonne)
  const vus = new Set();
  for (const colonne of meilleure.colonnes) {
    if (!colonne.champ) continue;
    if (vus.has(colonne.champ)) colonne.champ = null;
    else vus.add(colonne.champ);
  }
  return meilleure;
}

const capitaliser = (texte) =>
  texte
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, sep, lettre) => sep + lettre.toUpperCase());

const nettoyer = (valeur) =>
  String(valeur ?? '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * « DOSSOU Afi Mireille » → { nom: 'DOSSOU', prenoms: 'Afi Mireille' }.
 * Les mots en capitales en tête forment le nom ; à défaut, le premier mot.
 */
export function separerNomPrenoms(texte) {
  const mots = nettoyer(texte).split(' ').filter(Boolean);
  if (!mots.length) return { nom: '', prenoms: '' };
  let fin = 0;
  while (fin < mots.length - 1 && /\p{L}/u.test(mots[fin]) && mots[fin] === mots[fin].toUpperCase())
    fin++;
  if (fin === 0) fin = 1;
  return {
    nom: mots.slice(0, fin).join(' ').toUpperCase(),
    prenoms: capitaliser(mots.slice(fin).join(' ')),
  };
}

export function normaliserSexe(valeur) {
  const v = simplifier(valeur);
  if (['m', 'masculin', 'masc', 'g', 'garcon', 'h', 'homme', '1', 'male'].includes(v)) return 'M';
  if (['f', 'feminin', 'fem', 'fille', 'femme', '2', 'female'].includes(v)) return 'F';
  return null;
}

const MOIS = {
  janvier: 1,
  janv: 1,
  jan: 1,
  fevrier: 2,
  fevr: 2,
  fev: 2,
  mars: 3,
  mar: 3,
  avril: 4,
  avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  juil: 7,
  aout: 8,
  septembre: 9,
  sept: 9,
  sep: 9,
  octobre: 10,
  oct: 10,
  novembre: 11,
  nov: 11,
  decembre: 12,
  dec: 12,
};

const dateValide = (annee, mois, jour) => {
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  return date.getUTCFullYear() === annee &&
    date.getUTCMonth() === mois - 1 &&
    date.getUTCDate() === jour
    ? date
    : null;
};

/** Année sur deux chiffres : « 11 » → 2011, « 98 » → 1998. */
const anneeComplete = (a) =>
  a >= 100 ? a : a + (a <= new Date().getFullYear() % 100 ? 2000 : 1900);

/**
 * Convertit une date de naissance : objet Date (Excel), numéro de série Excel,
 * « 12/03/2011 », « 12-03-11 », « 2011-03-12 », « 12 mars 2011 ».
 */
export function normaliserDate(valeur) {
  if (valeur instanceof Date && !Number.isNaN(valeur.getTime())) {
    return dateValide(valeur.getUTCFullYear(), valeur.getUTCMonth() + 1, valeur.getUTCDate());
  }
  if (typeof valeur === 'number' && valeur > 1000 && valeur < 80000) {
    // Numéro de série Excel (jours depuis le 30/12/1899)
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(valeur) * 86_400_000);
    return dateValide(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const texte = nettoyer(valeur).toLowerCase();
  let m = /^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{2}|\d{4})$/.exec(texte);
  if (m) return dateValide(anneeComplete(Number(m[3])), Number(m[2]), Number(m[1]));
  m = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(texte);
  if (m) return dateValide(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})(?:er)?\s+([a-zéû.]+)\s+(\d{2}|\d{4})$/.exec(texte);
  if (m) {
    const mois = MOIS[simplifier(m[2])];
    if (mois) return dateValide(anneeComplete(Number(m[3])), mois, Number(m[1]));
  }
  return null;
}

/** Valeur d'une cellule exceljs (formules, liens, texte enrichi) ramenée à une valeur simple. */
export function valeurCellule(valeur) {
  if (valeur === null || valeur === undefined) return '';
  if (valeur instanceof Date || typeof valeur !== 'object') return valeur;
  if ('result' in valeur) return valeurCellule(valeur.result);
  if ('text' in valeur) return valeur.text;
  if ('richText' in valeur) return valeur.richText.map((r) => r.text).join('');
  return String(valeur);
}

/**
 * Transforme une ligne brute (champ → valeur) en fiche élève normalisée,
 * avec erreurs bloquantes et avertissements.
 */
export function normaliserLigne(brute, { aujourdHui = new Date() } = {}) {
  const erreurs = [];
  const avertissements = [];
  let nom = nettoyer(brute.nom);
  let prenoms = nettoyer(brute.prenoms);
  if (brute.nomComplet && (!nom || !prenoms))
    ({ nom, prenoms } = separerNomPrenoms(brute.nomComplet));

  const donnees = {
    nom: nom.toUpperCase(),
    prenoms: capitaliser(prenoms),
    sexe: normaliserSexe(brute.sexe),
    dateNaissance: normaliserDate(brute.dateNaissance),
    lieuNaissance: nettoyer(brute.lieuNaissance)
      ? capitaliser(nettoyer(brute.lieuNaissance))
      : null,
    matricule: nettoyer(brute.matricule) || null,
    npi: nettoyer(brute.npi).replace(/\s/g, '') || null,
    classe: nettoyer(brute.classe) || null,
    nomContactParent: nettoyer(brute.nomContactParent) || null,
    telephoneContactParent: null,
  };

  if (donnees.nom.length < 2) erreurs.push('Nom manquant');
  if (donnees.prenoms.length < 2) erreurs.push('Prénoms manquants');
  if (!donnees.sexe)
    erreurs.push(brute.sexe ? `Sexe non reconnu : « ${brute.sexe} »` : 'Sexe manquant');
  if (!donnees.dateNaissance) {
    erreurs.push(
      brute.dateNaissance
        ? `Date de naissance non reconnue : « ${brute.dateNaissance} »`
        : 'Date de naissance manquante',
    );
  } else {
    const age = (aujourdHui - donnees.dateNaissance) / (365.25 * 86_400_000);
    if (age < 8 || age > 30)
      avertissements.push(`Âge inhabituel (${Math.floor(age)} ans) : vérifiez la date`);
  }
  if (brute.telephoneContactParent) {
    donnees.telephoneContactParent = normaliserTelephone(String(brute.telephoneContactParent));
    if (!donnees.telephoneContactParent)
      avertissements.push(`Téléphone du parent ignoré : « ${brute.telephoneContactParent} »`);
  }
  if (donnees.npi && !/^\d{6,20}$/.test(donnees.npi)) {
    avertissements.push('NPI ignoré (format inattendu)');
    donnees.npi = null;
  }
  return { donnees, erreurs, avertissements };
}

/** Clé d'identification d'un élève sans matricule : nom + prénoms + date de naissance. */
export const cleIdentite = ({ nom, prenoms, dateNaissance }) =>
  `${simplifier(nom)}|${simplifier(prenoms)}|${dateNaissance ? dateNaissance.toISOString().slice(0, 10) : ''}`;
