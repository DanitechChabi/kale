// Crée le premier compte SUPER_ADMIN de la plateforme (à lancer une seule fois).
// Usage : npm run creer-super-admin -- --nom DOSSOU --prenoms "Afi" --telephone 0197000000 [--email a@b.bj]
// Le mot de passe temporaire est affiché une seule fois et devra être changé à la connexion.
import { parseArgs } from 'node:util';
import { prisma } from '../src/config/prisma.js';
import { schemaEmail, schemaTelephone } from '../src/utils/identifiants.js';
import { genererMotDePasseTemporaire, hacherMotDePasse } from '../src/utils/motDePasse.js';

const { values } = parseArgs({
  options: {
    nom: { type: 'string' },
    prenoms: { type: 'string' },
    telephone: { type: 'string' },
    email: { type: 'string' },
  },
});

if (!values.nom || !values.prenoms || (!values.telephone && !values.email)) {
  console.error('Usage : --nom NOM --prenoms PRÉNOMS --telephone NUMÉRO [--email ADRESSE]');
  process.exit(1);
}

const telephone = values.telephone ? schemaTelephone.parse(values.telephone) : null;
const email = values.email ? schemaEmail.parse(values.email) : null;
const motDePasse = genererMotDePasseTemporaire(12);

try {
  const compte = await prisma.utilisateur.create({
    data: {
      role: 'SUPER_ADMIN',
      nom: values.nom.toUpperCase(),
      prenoms: values.prenoms,
      telephone,
      email,
      motDePasseHash: await hacherMotDePasse(motDePasse),
    },
  });
  console.log(`✔ Compte SUPER_ADMIN créé (${compte.telephone ?? compte.email}).`);
  console.log(`  Mot de passe temporaire : ${motDePasse}`);
  console.log('  Il devra être changé à la première connexion.');
} finally {
  await prisma.$disconnect();
}
