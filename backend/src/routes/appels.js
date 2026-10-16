// Appel en classe et absences : /api/appels, /api/absences
import { Router } from 'express';
import { z } from 'zod';
import {
  enregistrerAppel,
  feuilleAppel,
  justifier,
  listerAbsences,
} from '../contexts/presences/serviceAppels.js';
import {
  authentifier,
  exigerEcoleVerifiee,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import { valider } from '../middlewares/valider.js';
import { schemaId } from './aide.js';

export const routeurAppels = Router();
routeurAppels.use(
  ['/appels', '/absences'],
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole('ADMIN_ECOLE', 'SECRETARIAT', 'ENSEIGNANT'),
  exigerEcoleVerifiee,
);

const date = z.iso.date('Date invalide (AAAA-MM-JJ)');
const heure = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide (HH:MM)');
const selection = z.object({ classeId: z.uuid(), date, heureDebut: heure });

routeurAppels.get('/appels', valider({ query: selection }), async (req, res) => {
  res.json(await feuilleAppel(req.db, req.utilisateur, req.valide.query));
});

// Feuille complète renvoyée : rejouable sans effet de bord (idempotente)
routeurAppels.put(
  '/appels',
  valider({
    body: selection.extend({
      enseignementId: z.uuid().optional(),
      creneauId: z.uuid().optional(),
      presences: z
        .array(
          z.object({
            eleveId: z.uuid(),
            statut: z.enum(['PRESENT', 'ABSENT', 'RETARD']),
            minutesRetard: z.coerce.number().int().min(1).max(240).optional(),
          }),
        )
        .max(200),
    }),
  }),
  async (req, res) => {
    res.json(await enregistrerAppel(req.db, req.utilisateur, req.valide.body));
  },
);

routeurAppels.get(
  '/absences',
  exigerRole('ADMIN_ECOLE', 'SECRETARIAT'),
  valider({
    query: z.object({
      classeId: z.uuid().optional(),
      du: date.optional(),
      au: date.optional(),
      nonJustifiees: z
        .enum(['true', 'false'])
        .optional()
        .transform((v) => v === 'true'),
    }),
  }),
  async (req, res) => {
    res.json(await listerAbsences(req.db, req.valide.query));
  },
);

routeurAppels.post(
  '/absences/:id/justification',
  exigerRole('ADMIN_ECOLE', 'SECRETARIAT'),
  valider({
    params: schemaId,
    body: z.object({ motif: z.string().trim().min(3, 'Motif obligatoire').max(255) }),
  }),
  async (req, res) => {
    res.json(await justifier(req.db, req.utilisateur, req.valide.params.id, req.valide.body));
  },
);
