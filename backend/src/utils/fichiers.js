// Stockage des fichiers : pièces justificatives et PDF archivés (sur disque ou en base).
// Le type réel est déterminé par la signature binaire du fichier, jamais par
// l'extension ni par le type annoncé par le navigateur.
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { config } from '../config/env.js';
import { prisma } from '../config/prisma.js';

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

const TYPES_PAR_EXTENSION = Object.fromEntries(
  TYPES_ACCEPTES.map(({ extension, typeMime }) => [extension, typeMime]),
);

// --- Pilote « disque » ----------------------------------------------------------

const racineStockage = () => resolve(config.DOSSIER_STOCKAGE);

/** Chemin absolu d'un fichier stocké, en refusant toute sortie du dossier de stockage. */
export function cheminAbsolu(cheminRelatif) {
  const racine = racineStockage();
  const chemin = resolve(racine, normalize(cheminRelatif));
  if (!chemin.startsWith(racine + sep)) throw new Error('Chemin de fichier invalide');
  return chemin;
}

const disque = {
  async ecrire(cle, contenu) {
    const chemin = cheminAbsolu(cle);
    await mkdir(dirname(chemin), { recursive: true });
    await writeFile(chemin, contenu, { flag: 'wx' }); // jamais d'écrasement
  },
  lire: (cle) => readFile(cheminAbsolu(cle)),
  supprimer: (cle) => rm(cheminAbsolu(cle), { force: true }),
};

// --- Pilote « base » (PostgreSQL) ----------------------------------------------
// Table technique sans ecole_id, accessible seulement ici et par clé : le client
// global est utilisé volontairement (la clé vient toujours d'un enregistrement isolé).

const base = {
  async ecrire(cle, contenu, extension) {
    await prisma.fichierStocke.create({
      data: {
        cle,
        contenu,
        typeMime: TYPES_PAR_EXTENSION[extension] ?? 'application/octet-stream',
        tailleOctets: contenu.length,
        empreinteSha256: empreinteSha256(contenu),
      },
    });
  },
  async lire(cle) {
    const fichier = await prisma.fichierStocke.findUnique({ where: { cle } });
    if (!fichier)
      throw Object.assign(new Error(`Fichier introuvable : ${cle}`), { code: 'ENOENT' });
    return Buffer.from(fichier.contenu);
  },
  supprimer: (cle) => prisma.fichierStocke.deleteMany({ where: { cle } }),
};

const pilote = () => (config.STOCKAGE === 'base' ? base : disque);

/**
 * Enregistre un fichier sous `sousDossier` et renvoie sa clé (chemin relatif).
 * `nom` permet un nom stable (PDF archivés) ; par défaut un identifiant aléatoire.
 */
export async function enregistrerFichier(sousDossier, contenu, extension, { nom } = {}) {
  const cle = join(sousDossier, `${nom ?? randomUUID()}.${extension}`)
    .split(sep)
    .join('/');
  if (cle.includes('..')) throw new Error('Chemin de fichier invalide');
  await pilote().ecrire(cle, contenu, extension);
  return cle;
}

export const lireFichier = (cle) => pilote().lire(cle);

/** Supprime des fichiers (utilisé pour annuler un dépôt qui a échoué). */
export async function supprimerFichiers(cles) {
  await Promise.all(cles.map((c) => pilote().supprimer(c)));
}
