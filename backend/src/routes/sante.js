// Routes de santé : utilisées pour vérifier que l'API (et la base) répondent.
import { Router } from 'express';
import { prisma } from '../config/prisma.js';

export const routeurSante = Router();

/** Vérification simple : l'API est démarrée. */
routeurSante.get('/', (_req, res) => {
  res.json({ statut: 'ok', service: 'edureleve-api', horodatage: new Date().toISOString() });
});

/** Vérification de la connexion à PostgreSQL. */
routeurSante.get('/base', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ statut: 'ok', base: 'connectée' });
  } catch {
    res.status(503).json({ statut: 'erreur', base: 'injoignable' });
  }
});
