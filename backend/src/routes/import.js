// Import de listes d'élèves : /api/import/eleves/*
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  analyserFichier,
  genererModele,
  importerEleves,
  LIGNES_MAX,
  schemaLigneImport,
} from '../contexts/import/serviceImport.js';
import {
  authentifier,
  exigerEcoleVerifiee,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import { ErreurApi } from '../middlewares/erreurs.js';
import { valider } from '../middlewares/valider.js';
import { auteur } from './aide.js';

export const routeurImport = Router();
routeurImport.use(
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole('ADMIN_ECOLE', 'SECRETARIAT'),
  exigerEcoleVerifiee,
);

const recevoirListe = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('fichier');

routeurImport.get('/eleves/modele', async (req, res) => {
  const contenu = await genererModele(req.db);
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': 'attachment; filename="modele-liste-eleves.xlsx"',
  });
  res.send(Buffer.from(contenu));
});

routeurImport.post('/eleves/analyse', recevoirListe, async (req, res) => {
  if (!req.file) throw new ErreurApi(400, 'FICHIER_MANQUANT', 'Joignez la liste des élèves');
  res.json(await analyserFichier(req.db, req.file.buffer));
});

routeurImport.post(
  '/eleves',
  valider({
    body: z.object({
      lignes: z.array(schemaLigneImport).min(1, 'Aucun élève à importer').max(LIGNES_MAX),
      classeId: z.uuid().nullish(),
    }),
  }),
  async (req, res) => {
    res.status(201).json(await importerEleves(req.db, auteur(req), req.valide.body));
  },
);
