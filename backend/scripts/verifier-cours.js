// Contrôle des fichiers de leçon EduCourses.
// Usage : node scripts/verifier-cours.js [dossier…]   (par défaut : tous les cours)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { analyserLecon, indicesFichier } from '../src/contexts/educourses/format.js';

const racine = resolve(import.meta.dirname, '../prisma/donnees/educourses/cours');
const dossiers = process.argv.slice(2).length
  ? process.argv.slice(2).map((d) => resolve(racine, d))
  : readdirSync(racine)
      .map((d) => join(racine, d))
      .filter((d) => statSync(d).isDirectory());

let erreurs = 0;
let lecons = 0;
let mots = 0;
for (const dossier of dossiers) {
  for (const nom of readdirSync(dossier)
    .filter((f) => f.endsWith('.md'))
    .sort()) {
    try {
      indicesFichier(nom);
      const lecon = analyserLecon(readFileSync(join(dossier, nom), 'utf8'));
      lecons++;
      mots += lecon.cours.split(/\s+/).length;
    } catch (erreur) {
      erreurs++;
      console.error(`✗ ${dossier.split('/').at(-1)}/${nom} : ${erreur.message}`);
    }
  }
}
console.log(`${lecons} leçon(s) valide(s), ${erreurs} erreur(s), ${mots} mots de cours`);
process.exit(erreurs ? 1 : 0);
