// Crée les fichiers de configuration locaux (.env) à partir des modèles
// (.env.example), s'ils n'existent pas encore. Fonctionne sous Windows, macOS
// et Linux ; ne remplace jamais un .env existant.
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

for (const dossier of ['.', 'backend', 'frontend']) {
  const modele = join(dossier, '.env.example');
  const cible = join(dossier, '.env');
  if (!existsSync(modele)) continue;
  if (existsSync(cible)) {
    console.log(`• ${cible} existe déjà : conservé`);
  } else {
    copyFileSync(modele, cible);
    console.log(`✔ ${cible} créé à partir de ${modele}`);
  }
}
