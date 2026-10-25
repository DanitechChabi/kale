import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

// Tests d'intégration sur une vraie base PostgreSQL (règles garanties par la base).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.js'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://edureleve:edureleve@localhost:5433/edureleve_test?schema=public',
      JWT_ACCESS_SECRET: 'secret-acces-de-test-suffisamment-long-0123456789',
      JWT_REFRESH_SECRET: 'secret-rafraichissement-de-test-assez-long-012345',
      // Stockage en base, comme en production
      STOCKAGE: 'base',
      DOSSIER_STOCKAGE: join(tmpdir(), 'edureleve-tests'),
      LIMITE_VERIFICATION: '10000',
      LIMITE_DUPLICATA: '10000',
      LIMITE_ACTIVATION: '10000',
      LIMITE_CONNEXION: '10000',
      LIMITE_INSCRIPTION: '10000',
      // EduMail : fournisseur simulé et domaine réservé aux tests (RFC 2606)
      EDUMAIL_FOURNISSEUR: 'simulation',
      EDUMAIL_DOMAINE: 'edumail.test',
      LIMITE_EDUMAIL: '10000',
    },
  },
});
