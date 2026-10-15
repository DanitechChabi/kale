// Prépare la base de test : la recrée à vide et y applique toutes les migrations.
// Utilisé par « npm run test:db ». Refuse toute base dont le nom ne finit pas
// par « _test » : la base de développement n'est jamais touchée.
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const url = new URL(
  process.env.TEST_DATABASE_URL ??
    'postgresql://edureleve:edureleve@localhost:5432/edureleve_test?schema=public',
);
const nomBase = url.pathname.slice(1);

if (!/^[a-z0-9_]+_test$/.test(nomBase)) {
  console.error(`❌ Base « ${nomBase} » refusée : son nom doit se terminer par « _test ».`);
  process.exit(1);
}

// Connexion à la base d'administration « postgres » pour recréer la base de test
const urlAdmin = new URL(url);
urlAdmin.pathname = '/postgres';
const admin = new PrismaClient({ datasourceUrl: urlAdmin.toString() });
try {
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${nomBase}" WITH (FORCE)`);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${nomBase}"`);
} finally {
  await admin.$disconnect();
}

execSync('npx prisma migrate deploy', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url.toString() },
});
