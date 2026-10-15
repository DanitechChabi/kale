import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Les tests sur base réelle se lancent à part : npm run test:db
    exclude: ['tests/db/**', 'node_modules/**'],
    // Variables d'environnement minimales pour que la config Zod passe en test
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://edureleve:edureleve@localhost:5433/edureleve_test?schema=public',
      JWT_ACCESS_SECRET: 'secret-acces-de-test-suffisamment-long-0123456789',
      JWT_REFRESH_SECRET: 'secret-rafraichissement-de-test-assez-long-012345',
    },
  },
});
