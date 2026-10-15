// Vérification des établissements : /api/verification/* (SUPER_ADMIN, MINISTERE)
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { lireContenuDocument } from '../contexts/ecole/serviceDossier.js';
import {
  deciderEcole,
  detailEcole,
  examinerDocument,
  listerEcoles,
} from '../contexts/verification/serviceVerification.js';
import {
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import { valider } from '../middlewares/valider.js';
import { auteur, envoyerDocument, schemaId } from './aide.js';

export const routeurVerification = Router();
routeurVerification.use(
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole('SUPER_ADMIN', 'MINISTERE'),
);

const STATUTS = ['EN_ATTENTE', 'EN_EXAMEN', 'VERIFIEE', 'REJETEE', 'SUSPENDUE'];

const schemaListe = z.object({
  statut: z.enum(STATUTS).optional(),
  recherche: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  parPage: z.coerce.number().int().min(1).max(100).default(20),
});

routeurVerification.get('/ecoles', valider({ query: schemaListe }), async (req, res) => {
  res.json(await listerEcoles(req.valide.query));
});

routeurVerification.get('/ecoles/:id', valider({ params: schemaId }), async (req, res) => {
  res.json(await detailEcole(req.valide.params.id));
});

const schemaDecision = z.object({
  statut: z.enum(['EN_EXAMEN', 'VERIFIEE', 'REJETEE', 'SUSPENDUE']),
  motif: z.string().trim().min(5, 'Motif trop court').max(500).optional(),
});

routeurVerification.post(
  '/ecoles/:id/decision',
  valider({ params: schemaId, body: schemaDecision }),
  async (req, res) => {
    res.json({ ecole: await deciderEcole(req.valide.params.id, req.valide.body, auteur(req)) });
  },
);

const schemaExamen = z
  .object({
    statut: z.enum(['ACCEPTE', 'REFUSE']),
    commentaire: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.statut !== 'REFUSE' || (d.commentaire?.length ?? 0) >= 5, {
    message: 'Expliquez pourquoi le document est refusé',
    path: ['commentaire'],
  });

routeurVerification.patch(
  '/documents/:id',
  valider({ params: schemaId, body: schemaExamen }),
  async (req, res) => {
    res.json({
      document: await examinerDocument(req.valide.params.id, req.valide.body, auteur(req)),
    });
  },
);

routeurVerification.get(
  '/documents/:id/fichier',
  valider({ params: schemaId }),
  async (req, res) => {
    envoyerDocument(res, await lireContenuDocument(prisma, req.valide.params.id));
  },
);
