// Instance unique du client Prisma, partagée par toute l'application.
import { PrismaClient } from '@prisma/client';
import { config } from './env.js';

export const prisma = new PrismaClient({
  log: config.estProduction ? ['error'] : ['warn', 'error'],
});
