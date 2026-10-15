// Référentiels publics (utilisés notamment par le formulaire d'inscription).
import { Router } from 'express';
import { prisma } from '../config/prisma.js';

export const routeurReferentiel = Router();

routeurReferentiel.get('/departements', async (_req, res) => {
  const departements = await prisma.departement.findMany({
    orderBy: { nom: 'asc' },
    select: {
      id: true,
      code: true,
      nom: true,
      communes: { select: { id: true, nom: true }, orderBy: { nom: 'asc' } },
    },
  });
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({ departements });
});
