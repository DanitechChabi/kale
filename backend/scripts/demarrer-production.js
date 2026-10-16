// Démarrage en production (Render ou tout hébergeur) :
// 1. applique les migrations en attente ;
// 2. charge ou met à jour le référentiel national et le catalogue EduCourses (idempotent) ;
// 3. crée le premier SUPER_ADMIN si aucun n'existe et que les variables
//    SUPER_ADMIN_* sont renseignées (aucun accès console n'est nécessaire) ;
// 4. lance le serveur.
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { chargerReferentielNational } from '../prisma/seed.js';
import { chargerEduCourses } from '../prisma/educourses.js';

execSync('npx prisma migrate deploy', { stdio: 'inherit' });

const prisma = new PrismaClient();
try {
  console.log(`✔ Référentiel : ${await chargerReferentielNational(prisma)}`);
  console.log(`✔ EduCourses : ${await chargerEduCourses(prisma)}`);
  await creerPremierSuperAdmin();
} finally {
  await prisma.$disconnect();
}

await import('../src/server.js');

async function creerPremierSuperAdmin() {
  if (await prisma.utilisateur.count({ where: { role: 'SUPER_ADMIN' } })) return;

  const { SUPER_ADMIN_TELEPHONE, SUPER_ADMIN_EMAIL, SUPER_ADMIN_MOT_DE_PASSE } = process.env;
  if (!(SUPER_ADMIN_TELEPHONE || SUPER_ADMIN_EMAIL) || !SUPER_ADMIN_MOT_DE_PASSE) {
    console.warn(
      '⚠ Aucun SUPER_ADMIN : renseignez SUPER_ADMIN_TELEPHONE et SUPER_ADMIN_MOT_DE_PASSE.',
    );
    return;
  }
  // Imports tardifs : la configuration (env.js) est validée à ce moment-là
  const { schemaEmail, schemaTelephone } = await import('../src/utils/identifiants.js');
  const { hacherMotDePasse, schemaMotDePasse } = await import('../src/utils/motDePasse.js');

  const motDePasse = schemaMotDePasse.safeParse(SUPER_ADMIN_MOT_DE_PASSE);
  if (!motDePasse.success) {
    console.error(
      '✖ SUPER_ADMIN_MOT_DE_PASSE : 8 caractères au moins, avec une lettre et un chiffre.',
    );
    return;
  }
  await prisma.utilisateur.create({
    data: {
      role: 'SUPER_ADMIN',
      nom: (process.env.SUPER_ADMIN_NOM ?? 'ADMINISTRATEUR').toUpperCase(),
      prenoms: process.env.SUPER_ADMIN_PRENOMS ?? 'Plateforme',
      telephone: SUPER_ADMIN_TELEPHONE ? schemaTelephone.parse(SUPER_ADMIN_TELEPHONE) : null,
      email: SUPER_ADMIN_EMAIL ? schemaEmail.parse(SUPER_ADMIN_EMAIL) : null,
      motDePasseHash: await hacherMotDePasse(motDePasse.data),
      doitChangerMotDePasse: false,
    },
  });
  console.log('✔ Premier compte SUPER_ADMIN créé.');
}
