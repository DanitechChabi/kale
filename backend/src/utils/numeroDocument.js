// Numéros publics des documents : relevés archivés et demandes de duplicata.
//
// Relevé : « B26-7K3M-Q9P2X » — B (bulletin de période) ou R (relevé annuel),
// année de fin de l'année scolaire, 8 caractères aléatoires de l'alphabet Crockford
// (40 bits : impossible à deviner) et un caractère de contrôle qui détecte toute
// faute de frappe sur un caractère. Imprimé sur le PDF et encodé dans le QR code.
// Duplicata : « D26-4HX9-K2M7Q », même construction.
import { randomInt } from 'node:crypto';
import { caractereControle } from './identifiantEleve.js';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const FORMAT = /^[BRD][0-9]{2}[0-9A-HJKMNP-TV-Z]{9}$/;

/** Nouveau numéro : préfixe (B, R ou D) + année sur deux chiffres + aléa + contrôle. */
export function genererNumero(prefixe, annee) {
  const corps =
    prefixe +
    String(annee % 100).padStart(2, '0') +
    Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return corps + caractereControle(corps);
}

/** Saisie tolérante (minuscules, tirets, espaces, O→0, I/L→1) ; null si invalide. */
export function normaliserNumero(saisie) {
  if (typeof saisie !== 'string') return null;
  const brut = saisie.toUpperCase().replace(/[\s.·-]/g, '');
  // Le préfixe est une lettre : seules les positions suivantes sont corrigées
  const valeur = brut[0] + brut.slice(1).replace(/O/g, '0').replace(/[IL]/g, '1');
  if (!FORMAT.test(valeur)) return null;
  return caractereControle(valeur.slice(0, -1)) === valeur.at(-1) ? valeur : null;
}

export const formaterNumero = (numero) =>
  `${numero.slice(0, 3)}-${numero.slice(3, 7)}-${numero.slice(7)}`;
