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
    // Sur Render, l'adresse publique du service est fournie par RENDER_EXTERNAL_URL
    CORS_ORIGINES: z.string().default(process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:5173'),
    URL_PUBLIQUE_FRONTEND: z
      .url()
      .default(process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:5173'),
    // Dossier du site compilé (frontend/dist) : s'il est défini, l'API sert aussi le site
    DOSSIER_FRONTEND: z.string().optional(),
    // Stockage des fichiers (pièces, PDF archivés) : « disque » (DOSSIER_STOCKAGE) ou
    // « base » (PostgreSQL), indispensable sur un hébergement sans disque durable
    STOCKAGE: z
      .enum(['disque', 'base'])
      .default(process.env.NODE_ENV === 'production' ? 'base' : 'disque'),
    DOSSIER_STOCKAGE: z.string().default('./stockage'),
    // Cookie du jeton de rafraîchissement
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),
    // Pièces justificatives : taille maximale par fichier (Mo)
    TAILLE_MAX_DOCUMENT_MO: z.coerce.number().positive().default(5),
    // Supports de cours et pièces jointes des devoirs : taille maximale (Mo)
    TAILLE_MAX_COURS_MO: z.coerce.number().positive().default(15),
    // Tentatives de connexion autorisées par adresse IP et par quart d'heure
    LIMITE_CONNEXION: z.coerce.number().int().positive().default(10),
    // Dossiers d'inscription autorisés par adresse IP et par heure
    LIMITE_INSCRIPTION: z.coerce.number().int().positive().default(5),
    // Fournisseur d'envoi des SMS (voir contexts/notifications/fournisseursSms.js) :
    // « journal » enregistre les messages sans les envoyer, en attendant un contrat opérateur
    SMS_FOURNISSEUR: z.enum(['journal']).default('journal'),
    // Passerelle USSD de l'opérateur : secret partagé (sans lui, la passerelle est fermée)
    USSD_SECRET: z.string().min(16).optional(),
    // Code à composer, affiché aux parents (ex. « *123*45# ») une fois attribué
    USSD_CODE: z.string().max(20).optional(),
    // Activations de compte parent par adresse IP et par heure
    LIMITE_ACTIVATION: z.coerce.number().int().positive().default(10),
    // Vérifications publiques de documents par adresse IP et par minute
    LIMITE_VERIFICATION: z.coerce.number().int().positive().default(60),
    // Demandes de duplicata par adresse IP et par heure
    LIMITE_DUPLICATA: z.coerce.number().int().positive().default(5),
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
  // Cookie sécurisé (HTTPS) par défaut en production
  cookieSecurise: brut.COOKIE_SECURE ?? brut.NODE_ENV === 'production',
  // Liste des origines autorisées pour le CORS
  originesCors: brut.CORS_ORIGINES.split(',')
    .map((origine) => origine.trim())
    .filter(Boolean),
});
