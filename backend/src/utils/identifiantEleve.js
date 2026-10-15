// Identifiant EduRelevé d'un élève : 10 caractères de l'alphabet Crockford
// (chiffres et lettres sans I, L, O, U pour éviter les confusions), dont un
// caractère de contrôle (Luhn mod 32) qui détecte toute faute de frappe sur un
// caractère et toute inversion de deux caractères voisins.
// Affichage : « 7KQ4M-9X2PD ».
import { randomInt } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const N = ALPHABET.length; // 32
const LONGUEUR_CORPS = 9;

export function caractereControle(corps) {
  let somme = 0;
  let facteur = 2;
  for (let i = corps.length - 1; i >= 0; i--) {
    const produit = facteur * ALPHABET.indexOf(corps[i]);
    somme += Math.floor(produit / N) + (produit % N);
    facteur = facteur === 2 ? 1 : 2;
  }
  return ALPHABET[(N - (somme % N)) % N];
}

/** Nouvel identifiant aléatoire (au moins deux lettres : jamais confondu avec un téléphone). */
export function genererIdentifiantEleve() {
  let corps;
  do {
    corps = Array.from({ length: LONGUEUR_CORPS }, () => ALPHABET[randomInt(N)]).join('');
  } while ((corps.match(/[A-Z]/g) ?? []).length < 2);
  return corps + caractereControle(corps);
}

/**
 * Normalise une saisie (minuscules, tirets, espaces, O→0, I/L→1) ;
 * renvoie null si le format ou le caractère de contrôle est faux.
 */
export function normaliserIdentifiantEleve(saisie) {
  if (typeof saisie !== 'string') return null;
  const valeur = saisie
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (!/^[0-9A-HJKMNP-TV-Z]{10}$/.test(valeur)) return null;
  return caractereControle(valeur.slice(0, LONGUEUR_CORPS)) === valeur[LONGUEUR_CORPS]
    ? valeur
    : null;
}

export const formaterIdentifiantEleve = (identifiant) =>
  `${identifiant.slice(0, 5)}-${identifiant.slice(5)}`;

/** Génère un identifiant libre (vérifie l'unicité en base). */
export async function identifiantEleveLibre(client) {
  for (let essai = 0; essai < 5; essai++) {
    const identifiant = genererIdentifiantEleve();
    if (!(await client.eleve.findFirst({ where: { identifiant }, select: { id: true } })))
      return identifiant;
  }
  throw new Error('Impossible de générer un identifiant élève unique');
}
