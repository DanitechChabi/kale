// Notes : évaluations, saisie, résultats, contrôle et clôture des périodes.
import { Router } from 'express';
import { z } from 'zod';
import {
  cloturerPeriode,
  controlerPeriode,
  creerEvaluation,
  enregistrerNotes,
  feuilleNotes,
  historiqueNote,
  listerEvaluations,
  mesEnseignements,
  modifierEvaluation,
  resultatsClassePublics,
  supprimerEvaluation,
} from '../contexts/notes/serviceNotes.js';
import {
  authentifier,
  exigerEcoleVerifiee,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import { valider } from '../middlewares/valider.js';
import { auteur, schemaId } from './aide.js';

export const routeurNotes = Router();
routeurNotes.use(
  [
    '/mes-enseignements',
    '/evaluations',
    '/notes',
    '/resultats',
    '/periodes/:id/controle',
    '/periodes/:id/cloture',
    '/enseignements/:id/evaluations',
  ],
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole('ADMIN_ECOLE', 'SECRETARIAT', 'ENSEIGNANT'),
  exigerEcoleVerifiee,
);

const saisie = exigerRole('ADMIN_ECOLE', 'ENSEIGNANT');
const direction = exigerRole('ADMIN_ECOLE');
const TYPES = ['INTERROGATION', 'DEVOIR', 'COMPOSITION'];
const bareme = z.coerce.number().positive().max(100);

routeurNotes.get('/mes-enseignements', saisie, async (req, res) => {
  res.json(await mesEnseignements(req.db, req.utilisateur));
});

routeurNotes.get(
  '/enseignements/:id/evaluations',
  valider({ params: schemaId, query: z.object({ periodeId: z.uuid() }) }),
  async (req, res) => {
    res.json(
      await listerEvaluations(
        req.db,
        req.utilisateur,
        req.valide.params.id,
        req.valide.query.periodeId,
      ),
    );
  },
);

routeurNotes.post(
  '/evaluations',
  saisie,
  valider({
    body: z.object({
      // Fourni par le client pour une évaluation créée hors connexion (idempotence)
      id: z.uuid().optional(),
      enseignementId: z.uuid(),
      periodeId: z.uuid(),
      type: z.enum(TYPES),
      libelle: z.string().trim().max(100).optional(),
      date: z.coerce.date(),
      bareme: bareme.default(20),
    }),
  }),
  async (req, res) => {
    res
      .status(201)
      .json({ evaluation: await creerEvaluation(req.db, req.utilisateur, req.valide.body) });
  },
);

routeurNotes.patch(
  '/evaluations/:id',
  saisie,
  valider({
    params: schemaId,
    body: z.object({
      libelle: z.string().trim().min(1).max(100).optional(),
      date: z.coerce.date().optional(),
      type: z.enum(TYPES).optional(),
      bareme: bareme.optional(),
    }),
  }),
  async (req, res) => {
    res.json({
      evaluation: await modifierEvaluation(
        req.db,
        req.utilisateur,
        req.valide.params.id,
        req.valide.body,
      ),
    });
  },
);

routeurNotes.delete('/evaluations/:id', saisie, valider({ params: schemaId }), async (req, res) => {
  await supprimerEvaluation(req.db, req.utilisateur, req.valide.params.id);
  res.status(204).end();
});

routeurNotes.get('/evaluations/:id/notes', valider({ params: schemaId }), async (req, res) => {
  res.json(await feuilleNotes(req.db, req.utilisateur, req.valide.params.id));
});

const schemaSaisie = z.object({
  eleveId: z.uuid(),
  valeur: z
    .number()
    .min(0, 'Une note ne peut pas être négative')
    .refine(
      (v) =>
        Number.isInteger(Math.round(v * 100)) && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6,
      {
        message: 'Deux décimales au plus',
      },
    )
    .nullable(),
  absent: z.boolean().default(false),
});

routeurNotes.put(
  '/evaluations/:id/notes',
  saisie,
  valider({ params: schemaId, body: z.object({ notes: z.array(schemaSaisie).max(200) }) }),
  async (req, res) => {
    res.json(
      await enregistrerNotes(
        req.db,
        req.utilisateur,
        req.valide.params.id,
        req.valide.body.notes,
        auteur(req),
      ),
    );
  },
);

routeurNotes.get(
  '/notes/:id/historique',
  saisie,
  valider({ params: schemaId }),
  async (req, res) => {
    res.json({ historique: await historiqueNote(req.db, req.utilisateur, req.valide.params.id) });
  },
);

routeurNotes.get(
  '/resultats',
  valider({ query: z.object({ classeId: z.uuid(), periodeId: z.uuid() }) }),
  async (req, res) => {
    res.json(
      await resultatsClassePublics(req.db, req.valide.query.classeId, req.valide.query.periodeId),
    );
  },
);

routeurNotes.get(
  '/periodes/:id/controle',
  direction,
  valider({ params: schemaId }),
  async (req, res) => {
    res.json(await controlerPeriode(req.db, req.valide.params.id));
  },
);

routeurNotes.post(
  '/periodes/:id/cloture',
  direction,
  valider({
    params: schemaId,
    body: z.object({
      forcer: z.boolean().default(false),
      motif: z.string().trim().min(5).max(500).optional(),
    }),
  }),
  async (req, res) => {
    res.json({
      periode: await cloturerPeriode(
        req.db,
        req.utilisateur,
        req.valide.params.id,
        req.valide.body,
        auteur(req),
      ),
    });
  },
);
