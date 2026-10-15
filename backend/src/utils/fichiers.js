// Stockage des fichiers déposés (pièces justificatives, plus tard les PDF archivés).
// Le type réel est déterminé par la signature binaire du fichier, jamais par
// l'extension ni par le type annoncé par le navigateur.
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { config } from '../config/env.js';

const TYPES_ACCEPTES = [
  { typeMime: 'application/pdf', extension: 'pdf', signature: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  {
    typeMime: 'image/png',
    extension: 'png',
    signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { typeMime: 'image/jpeg', extension: 'jpg', signature: [0xff, 0xd8, 0xff] },
];

/** Identifie un PDF, PNG ou JPEG d'après ses premiers octets ; null sinon. */
export function detecterTypeFichier(contenu) {
  return (
    TYPES_ACCEPTES.find(({ signature }) => signature.every((octet, i) => contenu[i] === octet)) ??
    null
  );
}

export const empreinteSha256 = (contenu) => createHash('sha256').update(contenu).digest('hex');

const racineStockage = () => resolve(config.DOSSIER_STOCKAGE);

/** Chemin absolu d'un fichier stocké, en refusant toute sortie du dossier de stockage. */
export function cheminAbsolu(cheminRelatif) {
  const racine = racineStockage();
  const chemin = resolve(racine, normalize(cheminRelatif));
  if (!chemin.startsWith(racine + sep)) throw new Error('Chemin de fichier invalide');
  return chemin;
}

/** Écrit un fichier sous `sousDossier` et renvoie son chemin relatif au stockage. */
export async function enregistrerFichier(sousDossier, contenu, extension) {
  const cheminRelatif = join(sousDossier, `${randomUUID()}.${extension}`);
  const chemin = cheminAbsolu(cheminRelatif);
  await mkdir(dirname(chemin), { recursive: true });
  await writeFile(chemin, contenu, { flag: 'wx' });
  return cheminRelatif;
}

export const lireFichier = (cheminRelatif) => readFile(cheminAbsolu(cheminRelatif));

/** Supprime des fichiers (utilisé pour annuler un dépôt qui a échoué). */
export async function supprimerFichiers(cheminsRelatifs) {
  await Promise.all(cheminsRelatifs.map((c) => rm(cheminAbsolu(c), { force: true })));
}
