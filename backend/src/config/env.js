// Chargement et validation des variables d'environnement avec Zod.
// L'application refuse de démarrer si la configuration est invalide.
import { z } from 'zod';

const schemaEnv = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL est obligatoire'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET doit faire au moins 32 caractères'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET doit faire au moins 32 caractères'),
    JWT_ACCESS_EXPIRATION: z.string().default('15m'),
    JWT_REFRESH_EXPIRATION: z.string().default('7d'),
    CORS_ORIGINES: z.string().default('http://localhost:5173'),
    URL_PUBLIQUE_FRONTEND: z.url().default('http://localhost:5173'),
    DOSSIER_STOCKAGE: z.string().default('./stockage'),
  })
  .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
    message: 'Les secrets JWT d’accès et de rafraîchissement doivent être différents',
    path: ['JWT_REFRESH_SECRET'],
  });

const resultat = schemaEnv.safeParse(process.env);

if (!resultat.success) {
  console.error('❌ Configuration invalide :');
  for (const probleme of resultat.error.issues) {
    console.error(`   - ${probleme.path.join('.')} : ${probleme.message}`);
  }
  process.exit(1);
}

const brut = resultat.data;

export const config = Object.freeze({
  ...brut,
  estProduction: brut.NODE_ENV === 'production',
  estTest: brut.NODE_ENV === 'test',
  // Liste des origines autorisées pour le CORS
  originesCors: brut.CORS_ORIGINES.split(',')
    .map((origine) => origine.trim())
    .filter(Boolean),
});
