// Traitement des demandes de duplicata par l'établissement : /api/duplicatas
import { Router } from 'express';
import { z } from 'zod';
import {
  delivrer,
  detailDemande,
  listerDemandes,
  prendreEnCharge,
  rejeter,
} from '../contexts/duplicata/serviceDuplicata.js';
import {
  authentifier,
  exigerEcoleVerifiee,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import { valider } from '../middlewares/valider.js';
import { schemaId } from './aide.js';

export const routeurDuplicata = Router();
routeurDuplicata.use(
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole('ADMIN_ECOLE', 'SECRETARIAT'),
  exigerEcoleVerifiee,
);

const STATUTS = ['EN_ATTENTE', 'EN_COURS', 'REJETEE', 'DELIVREE'];

routeurDuplicata.get(
  '/',
  valider({ query: z.object({ statut: z.enum(STATUTS).optional() }) }),
  async (req, res) => {
    res.json(await listerDemandes(req.db, req.valide.query));
  },
);

routeurDuplicata.get('/:id', valider({ params: schemaId }), async (req, res) => {
  res.json(await detailDemande(req.db, req.valide.params.id));
});

routeurDuplicata.post('/:id/prise-en-charge', valider({ params: schemaId }), async (req, res) => {
  res.json(await prendreEnCharge(req.db, req.utilisateur, req.valide.params.id));
});

routeurDuplicata.post(
  '/:id/delivrance',
  valider({ params: schemaId, body: z.object({ releveId: z.uuid() }) }),
  async (req, res) => {
    res.json(
      await delivrer(req.db, req.utilisateur, req.valide.params.id, req.valide.body.releveId),
    );
  },
);

routeurDuplicata.post(
  '/:id/rejet',
  valider({
    params: schemaId,
    body: z.object({ motif: z.string().trim().min(5, 'Motif obligatoire').max(500) }),
  }),
  async (req, res) => {
    res.json(await rejeter(req.db, req.utilisateur, req.valide.params.id, req.valide.body.motif));
  },
);
