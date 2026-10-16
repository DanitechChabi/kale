// Emplois du temps : /api/emplois-du-temps, /api/creneaux
import { Router } from 'express';
import { z } from 'zod';
import {
  creerCreneau,
  emploiDuTempsClasse,
  emploiDuTempsEnseignant,
  modifierCreneau,
  supprimerCreneau,
} from '../contexts/emploiDuTemps/serviceEmploiDuTemps.js';
import {
  authentifier,
  exigerEcoleVerifiee,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import { valider } from '../middlewares/valider.js';
import { schemaId } from './aide.js';

export const routeurEmploiDuTemps = Router();
routeurEmploiDuTemps.use(
  ['/emplois-du-temps', '/creneaux'],
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole('ADMIN_ECOLE', 'SECRETARIAT', 'ENSEIGNANT'),
  exigerEcoleVerifiee,
);

const planification = exigerRole('ADMIN_ECOLE', 'SECRETARIAT');
const heure = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide (HH:MM)');
const parDate = z.object({ date: z.iso.date().optional() });

routeurEmploiDuTemps.get(
  '/emplois-du-temps/classes/:id',
  valider({ params: schemaId, query: parDate }),
  async (req, res) => {
    res.json(await emploiDuTempsClasse(req.db, req.valide.params.id, req.valide.query.date));
  },
);

routeurEmploiDuTemps.get(
  '/emplois-du-temps/moi',
  exigerRole('ENSEIGNANT'),
  valider({ query: parDate }),
  async (req, res) => {
    res.json(await emploiDuTempsEnseignant(req.db, req.utilisateur.id, req.valide.query.date));
  },
);

const champs = {
  enseignementId: z.uuid(),
  jour: z.coerce.number().int().min(1).max(6),
  heureDebut: heure,
  heureFin: heure,
  salle: z.string().trim().max(50).nullable().optional(),
};

routeurEmploiDuTemps.post(
  '/creneaux',
  planification,
  valider({ body: z.object(champs) }),
  async (req, res) => {
    res.status(201).json(await creerCreneau(req.db, req.valide.body));
  },
);

routeurEmploiDuTemps.patch(
  '/creneaux/:id',
  planification,
  valider({ params: schemaId, body: z.object(champs).partial() }),
  async (req, res) => {
    res.json(await modifierCreneau(req.db, req.valide.params.id, req.valide.body));
  },
);

routeurEmploiDuTemps.delete(
  '/creneaux/:id',
  planification,
  valider({ params: schemaId }),
  async (req, res) => {
    res.json(await supprimerCreneau(req.db, req.valide.params.id));
  },
);
