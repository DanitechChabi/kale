// Journal et réglages des notifications SMS de l'établissement : /api/notifications
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config/env.js';
import {
  moisPrecedent,
  recapitulatifEtablissement,
} from '../contexts/notifications/recapitulatif.js';
import { journalNotifications, relancer } from '../contexts/notifications/serviceNotifications.js';
import {
  authentifier,
  exigerEcoleVerifiee,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import { valider } from '../middlewares/valider.js';
import { schemaId } from './aide.js';

export const routeurNotifications = Router();
routeurNotifications.use(
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole('ADMIN_ECOLE', 'SECRETARIAT'),
  exigerEcoleVerifiee,
);

const STATUTS = ['EN_ATTENTE', 'ENVOI', 'ENVOYEE', 'ECHEC'];

routeurNotifications.get(
  '/',
  valider({
    query: z.object({
      statut: z.enum(STATUTS).optional(),
      page: z.coerce.number().int().min(1).default(1),
    }),
  }),
  async (req, res) => {
    res.json(await journalNotifications(req.db, req.valide.query));
  },
);

const selectionReglages = { smsAbsences: true, smsBulletins: true, smsRecapNotes: true };

routeurNotifications.get('/reglages', async (req, res) => {
  const reglages = await req.db.ecole.findFirst({ select: selectionReglages });
  // Le fournisseur « journal » enregistre sans envoyer : l'interface le signale
  res.json({
    reglages,
    fournisseur: config.SMS_FOURNISSEUR,
    codeUssd: config.USSD_CODE ?? null,
    moisRecapitulatif: moisPrecedent(),
  });
});

routeurNotifications.patch(
  '/reglages',
  exigerRole('ADMIN_ECOLE'),
  valider({
    body: z
      .object({ smsAbsences: z.boolean(), smsBulletins: z.boolean(), smsRecapNotes: z.boolean() })
      .partial()
      .refine((v) => Object.keys(v).length, 'Aucun réglage transmis'),
  }),
  async (req, res) => {
    const reglages = await req.db.ecole.update({
      where: { id: req.utilisateur.ecoleId },
      data: req.valide.body,
      select: selectionReglages,
    });
    res.json({ reglages });
  },
);

// Envoi manuel du récapitulatif d'un mois (déjà envoyé : aucun doublon)
routeurNotifications.post(
  '/recapitulatif',
  exigerRole('ADMIN_ECOLE'),
  valider({
    body: z.object({
      mois: z
        .string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mois attendu : AAAA-MM')
        .refine((m) => m <= new Date().toISOString().slice(0, 7), 'Mois à venir')
        .default(moisPrecedent),
    }),
  }),
  async (req, res) => {
    const resultat = await recapitulatifEtablissement(req.db, req.valide.body.mois);
    res.json({ mois: req.valide.body.mois, ...resultat });
  },
);

routeurNotifications.post(
  '/:id/relance',
  exigerRole('ADMIN_ECOLE'),
  valider({ params: schemaId }),
  async (req, res) => {
    res.json(await relancer(req.db, req.valide.params.id));
  },
);
