// Hachage des mots de passe avec scrypt (module crypto natif de Node.js) :
// lent par construction, sel aléatoire, comparaison en temps constant.
import { randomBytes, randomInt, scrypt as scryptRappel, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';

const scrypt = promisify(scryptRappel);
const PARAMETRES = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const LONGUEUR_CLE = 64;

/** Règle de mot de passe : 8 caractères minimum, au moins une lettre et un chiffre. */
export const schemaMotDePasse = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(128, 'Le mot de passe est trop long')
  .regex(/\p{L}/u, 'Le mot de passe doit contenir au moins une lettre')
  .regex(/\d/, 'Le mot de passe doit contenir au moins un chiffre');

export async function hacherMotDePasse(motDePasse) {
  const sel = randomBytes(16);
  const cle = await scrypt(motDePasse.normalize('NFC'), sel, LONGUEUR_CLE, PARAMETRES);
  const { N, r, p } = PARAMETRES;
  return `scrypt$${N}$${r}$${p}$${sel.toString('base64')}$${cle.toString('base64')}`;
}

export async function verifierMotDePasse(motDePasse, hache) {
  const morceaux = typeof hache === 'string' ? hache.split('$') : [];
  if (morceaux.length !== 6 || morceaux[0] !== 'scrypt') return false;
  const [, N, r, p, selB64, cleB64] = morceaux;
  const attendue = Buffer.from(cleB64, 'base64');
  const calculee = await scrypt(
    motDePasse.normalize('NFC'),
    Buffer.from(selB64, 'base64'),
    attendue.length,
    {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: PARAMETRES.maxmem,
    },
  );
  return timingSafeEqual(attendue, calculee);
}

// Empreinte factice : permet de passer le même temps de calcul quand le compte
// n'existe pas (on ne révèle pas l'existence d'un identifiant par le temps de réponse).
export const HACHE_FACTICE =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(LONGUEUR_CLE).toString('base64');

// Alphabet sans caractères ambigus (0/O, 1/l/I) : le mot de passe est souvent dicté ou recopié
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Mot de passe temporaire lisible, remis à l'utilisateur, à changer à la première connexion. */
export function genererMotDePasseTemporaire(longueur = 10) {
  let resultat = '';
  while (!/\d/.test(resultat) || !/[a-zA-Z]/.test(resultat)) {
    resultat = Array.from({ length: longueur }, () => ALPHABET[randomInt(ALPHABET.length)]).join(
      '',
    );
  }
  return resultat;
}
