// Génère toutes les icônes de l'application à partir des SVG sources de branding/.
// Usage : npm run icones
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const dossierBranding = join(racine, 'branding');
const dossierPublic = join(racine, 'public');

/** Rend un SVG en PNG carré de la taille demandée. */
async function rendrePng(fichierSvg, taille) {
  const svg = await readFile(join(dossierBranding, fichierSvg));
  return sharp(svg, { density: Math.max(72, (72 * taille) / 512) * 4 })
    .resize(taille, taille)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Construit un fichier .ico contenant des images PNG (format accepté par tous les navigateurs). */
function construireIco(images) {
  const entete = Buffer.alloc(6);
  entete.writeUInt16LE(0, 0); // réservé
  entete.writeUInt16LE(1, 2); // type : icône
  entete.writeUInt16LE(images.length, 4);

  let decalage = 6 + 16 * images.length;
  const repertoire = images.map(({ taille, donnees }) => {
    const entree = Buffer.alloc(16);
    entree.writeUInt8(taille >= 256 ? 0 : taille, 0);
    entree.writeUInt8(taille >= 256 ? 0 : taille, 1);
    entree.writeUInt16LE(1, 4); // plans de couleur
    entree.writeUInt16LE(32, 6); // bits par pixel
    entree.writeUInt32LE(donnees.length, 8);
    entree.writeUInt32LE(decalage, 12);
    decalage += donnees.length;
    return entree;
  });

  return Buffer.concat([entete, ...repertoire, ...images.map((i) => i.donnees)]);
}

await mkdir(dossierPublic, { recursive: true });

const sorties = [
  ['icone.svg', 192, 'pwa-192x192.png'],
  ['icone.svg', 512, 'pwa-512x512.png'],
  ['icone-pleine.svg', 512, 'maskable-512x512.png'],
  ['icone-pleine.svg', 180, 'apple-touch-icon.png'],
];
for (const [source, taille, cible] of sorties) {
  await writeFile(join(dossierPublic, cible), await rendrePng(source, taille));
  console.log(`✔ ${cible}`);
}

const imagesIco = [];
for (const taille of [16, 32, 48]) {
  imagesIco.push({ taille, donnees: await rendrePng('icone.svg', taille) });
}
await writeFile(join(dossierPublic, 'favicon.ico'), construireIco(imagesIco));
console.log('✔ favicon.ico');

await copyFile(join(dossierBranding, 'icone.svg'), join(dossierPublic, 'favicon.svg'));
console.log('✔ favicon.svg');
