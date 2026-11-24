// Démarrage en production (Render ou tout hébergeur) :
// 1. applique les migrations en attente ;
// 2. charge ou met à jour le référentiel national et le catalogue EduCourses (idempotent) ;
// 3. crée le premier SUPER_ADMIN si aucun n'existe et que les variables
//    SUPER_ADMIN_* sont renseignées (aucun accès console n'est nécessaire) ;
// 4. lance le serveur ;
// 5. recharge les données de démonstration si CHARGER_DEMO est activé et que la base
//    est vide (reprise après perte de la base Render) : lancé APRÈS le démarrage du
//    serveur pour ne pas retarder la sonde de santé ; idempotent (ne fait rien si les
//    écoles de démonstration existent déjà).
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

// Rechargement de la démonstration, en arrière-plan (ne bloque pas la sonde de santé).
// Puis réparation du compte élève si un chargement précédent s'est interrompu.
if (['1', 'true', 'oui'].includes((process.env.CHARGER_DEMO ?? '').toLowerCase())) {
  const clientDemo = new PrismaClient();
  (async () => {
    const { chargerDemo } = await import('../prisma/demo.js');
    const r = await chargerDemo(clientDemo, { journal: (m) => console.log(`[démo] ${m}`) });
    console.log(r ? '✔ Données de démonstration rechargées.' : '✔ Démonstration déjà présente.');
    const { reparerEleveDemo } = await import('../prisma/reparer-demo-eleve.js');
    await reparerEleveDemo(clientDemo, { journal: (m) => console.log(`[démo] ${m}`) });
  })()
    .catch((e) => console.error('✖ Rechargement de la démonstration :', e.message))
    .finally(() => clientDemo.$disconnect());
}

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
