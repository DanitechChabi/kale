// Dossier de vérification de l'établissement, pour son responsable : /api/mon-ecole/*
import { Router } from 'express';
import { z } from 'zod';
import { TYPES_PIECES } from '../contexts/ecole/pieces.js';
import {
  ajouterDocument,
  lireContenuDocument,
  lireDossier,
  resoumettreDossier,
} from '../contexts/ecole/serviceDossier.js';
import {
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import { recevoirFichierUnique } from '../middlewares/televersement.js';
import { valider } from '../middlewares/valider.js';
import { auteur, envoyerDocument, schemaId } from './aide.js';

export const routeurMonEcole = Router();
routeurMonEcole.use(authentifier, exigerMotDePasseDefinitif, exigerRole('ADMIN_ECOLE'));

const contexte = (req) => ({
  ...auteur(req),
  ecoleId: req.utilisateur.ecoleId,
  utilisateurId: req.utilisateur.id,
});

routeurMonEcole.get('/dossier', async (req, res) => {
  res.json(await lireDossier(req.db, req.utilisateur.ecoleId));
});

const schemaNouveauDocument = z.object({
  type: z.enum(TYPES_PIECES),
  referenceActe: z.string().trim().max(100).optional(),
  dateActe: z.coerce.date().optional(),
});

routeurMonEcole.post(
  '/dossier/documents',
  recevoirFichierUnique(),
  valider({ body: schemaNouveauDocument }),
  async (req, res) => {
    const document = await ajouterDocument(req.db, contexte(req), req.valide.body, req.file);
    res.status(201).json({ document });
  },
);

routeurMonEcole.post('/dossier/soumettre', async (req, res) => {
  await resoumettreDossier(req.db, contexte(req));
  res.json(await lireDossier(req.db, req.utilisateur.ecoleId));
});

routeurMonEcole.get(
  '/dossier/documents/:id/fichier',
  valider({ params: schemaId }),
  async (req, res) => {
    envoyerDocument(res, await lireContenuDocument(req.db, req.valide.params.id));
  },
);
