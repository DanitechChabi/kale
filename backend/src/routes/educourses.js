// EduCourses : /api/educourses
// - catalogue et plans des programmes : publics (page de présentation) ;
// - leçons, quiz et avancement : tout compte connecté (élève, parent, personnel) ;
// - profils : l'élève a le sien automatiquement, le parent gère ceux de ses enfants.
import { Router } from 'express';
import { z } from 'zod';
import {
  catalogue,
  corrigerQuiz,
  creerProfil,
  lireLecon,
  marquerTerminee,
  mesProfils,
  modifierProfil,
  NIVEAUX,
  planProgramme,
  profilDuCompte,
  supprimerProfil,
  tableauProfil,
} from '../contexts/educourses/serviceEduCourses.js';
import {
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import { valider } from '../middlewares/valider.js';
import { schemaId } from './aide.js';

export const routeurEduCourses = Router();

const schemaProfilParam = z.object({ profilId: z.uuid() });
const schemaRequeteProfil = z.object({ profil: z.uuid().optional() });
const prenom = z.string().trim().min(1, 'Champ obligatoire').max(100);
const serie = z
  .string()
  .trim()
  .toUpperCase()
  .max(5)
  .optional()
  .transform((s) => s || undefined);

const schemaNouveauProfil = z.union([
  z.object({ eleveId: z.uuid(), prenom: prenom.optional() }),
  z.object({ prenom, niveau: z.enum(NIVEAUX), serie }),
]);
const schemaMajProfil = z.object({
  prenom: prenom.optional(),
  niveau: z.enum(NIVEAUX).optional(),
  serie,
});

// --- Public ------------------------------------------------------------------------------

routeurEduCourses.get('/catalogue', async (_req, res) => {
  res.json(await catalogue());
});

routeurEduCourses.get('/programmes/:id', valider({ params: schemaId }), async (req, res) => {
  res.json(await planProgramme(req.valide.params.id));
});

// --- Comptes connectés ------------------------------------------------------------------

const connecte = [authentifier, exigerMotDePasseDefinitif];
const parent = [...connecte, exigerRole('PARENT')];

routeurEduCourses.get('/profils', connecte, async (req, res) => {
  res.json(await mesProfils(req.utilisateur));
});

routeurEduCourses.post(
  '/profils',
  parent,
  valider({ body: schemaNouveauProfil }),
  async (req, res) => {
    res.status(201).json(await creerProfil(req.utilisateur, req.valide.body));
  },
);

routeurEduCourses.patch(
  '/profils/:profilId',
  parent,
  valider({ params: schemaProfilParam, body: schemaMajProfil }),
  async (req, res) => {
    res.json(await modifierProfil(req.utilisateur, req.valide.params.profilId, req.valide.body));
  },
);

routeurEduCourses.delete(
  '/profils/:profilId',
  parent,
  valider({ params: schemaProfilParam }),
  async (req, res) => {
    res.json(await supprimerProfil(req.utilisateur, req.valide.params.profilId));
  },
);

routeurEduCourses.get(
  '/profils/:profilId',
  connecte,
  valider({ params: schemaProfilParam }),
  async (req, res) => {
    res.json(await tableauProfil(req.utilisateur, req.valide.params.profilId));
  },
);

routeurEduCourses.get(
  '/profils/:profilId/programmes/:id',
  connecte,
  valider({ params: schemaProfilParam.extend({ id: z.uuid() }) }),
  async (req, res) => {
    const profil = await profilDuCompte(req.utilisateur, req.valide.params.profilId);
    res.json(
      await planProgramme(req.valide.params.id, { profil, titulaireId: req.utilisateur.id }),
    );
  },
);

routeurEduCourses.get(
  '/lecons/:id',
  connecte,
  valider({ params: schemaId, query: schemaRequeteProfil }),
  async (req, res) => {
    res.json(await lireLecon(req.utilisateur, req.valide.params.id, req.valide.query.profil));
  },
);

routeurEduCourses.post(
  '/lecons/:id/quiz',
  connecte,
  valider({
    params: schemaId,
    body: z.object({
      profilId: z.uuid().optional(),
      reponses: z.array(z.number().int().min(0).max(9)).min(1).max(30),
    }),
  }),
  async (req, res) => {
    res.json(await corrigerQuiz(req.utilisateur, req.valide.params.id, req.valide.body));
  },
);

routeurEduCourses.put(
  '/lecons/:id/terminee',
  connecte,
  valider({
    params: schemaId,
    body: z.object({ profilId: z.uuid(), terminee: z.boolean() }),
  }),
  async (req, res) => {
    res.json(await marquerTerminee(req.utilisateur, req.valide.params.id, req.valide.body));
  },
);
