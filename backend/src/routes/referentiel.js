// Référentiels publics (utilisés notamment par le formulaire d'inscription).
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { NIVEAUX } from '../contexts/scolarite/libelles.js';
import { lireProgramme } from '../contexts/scolarite/serviceClasses.js';
import { valider } from '../middlewares/valider.js';

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

routeurReferentiel.get('/series', async (_req, res) => {
  const series = await prisma.serie.findMany({ where: { actif: true }, orderBy: { code: 'asc' } });
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ series });
});

/** Matières et coefficients par défaut d'un niveau (et d'une série). */
routeurReferentiel.get(
  '/programme',
  valider({ query: z.object({ niveau: z.enum(NIVEAUX), serieId: z.uuid().optional() }) }),
  async (req, res) => {
    const lignes = await lireProgramme(prisma, req.valide.query.niveau, req.valide.query.serieId);
    res.json({
      programme: lignes.map((l) => ({
        matiere: { code: l.matiereReference.code, nom: l.matiereReference.nom },
        coefficient: l.coefficient,
        groupeOption: l.groupeOption,
        estFacultative: l.estFacultative,
        estVerifie: l.estVerifie,
      })),
    });
  },
);
