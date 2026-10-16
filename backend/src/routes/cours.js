// Cours en ligne et devoirs, côté établissement : /api/cours, /api/devoirs
import { Router } from 'express';
import { z } from 'zod';
import {
  donnerDevoir,
  fichierCours,
  fichierDevoir,
  listerCours,
  listerDevoirs,
  publierCours,
  retirerCours,
  retirerDevoir,
} from '../contexts/cours/serviceCours.js';
import {
  authentifier,
  exigerEcoleVerifiee,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import {
  apprecierCopie,
  copiesDuDevoir,
  fichierCopiePourEnseignant,
} from '../contexts/cours/serviceRendus.js';
import { recevoirSupport } from '../middlewares/televersement.js';
import { valider } from '../middlewares/valider.js';
import { envoyerDocument, schemaId } from './aide.js';

export const routeurCours = Router();
routeurCours.use(
  ['/enseignements/:id/cours', '/enseignements/:id/devoirs', '/cours', '/devoirs', '/copies'],
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole('ADMIN_ECOLE', 'SECRETARIAT', 'ENSEIGNANT'),
  exigerEcoleVerifiee,
);

const publication = exigerRole('ADMIN_ECOLE', 'ENSEIGNANT');
const texte = (max) => z.string().trim().min(1, 'Champ obligatoire').max(max);
const facultatif = (schema) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

export const schemaCours = z.object({
  enseignementId: z.uuid(),
  titre: texte(150),
  description: facultatif(z.string().trim().max(2000)),
  type: z.enum(['DOCUMENT', 'VIDEO', 'LIEN']),
  url: facultatif(z.url({ protocol: /^https$/, message: 'Lien https:// attendu' }).max(500)),
});

export const schemaDevoir = z.object({
  enseignementId: z.uuid(),
  titre: texte(150),
  consignes: texte(4000),
  pourLe: z.iso.date('Date invalide'),
});

routeurCours.get('/enseignements/:id/cours', valider({ params: schemaId }), async (req, res) => {
  res.json(await listerCours(req.db, { enseignementId: req.valide.params.id }));
});

routeurCours.post('/cours', publication, recevoirSupport(), async (req, res) => {
  const donnees = schemaCours.parse(req.body);
  res.status(201).json(await publierCours(req.db, req.utilisateur, donnees, req.file));
});

routeurCours.delete('/cours/:id', publication, valider({ params: schemaId }), async (req, res) => {
  res.json(await retirerCours(req.db, req.utilisateur, req.valide.params.id));
});

routeurCours.get('/cours/:id/fichier', valider({ params: schemaId }), async (req, res) => {
  envoyerDocument(res, await fichierCours(req.db, req.valide.params.id));
});

routeurCours.get('/enseignements/:id/devoirs', valider({ params: schemaId }), async (req, res) => {
  res.json(await listerDevoirs(req.db, { enseignementId: req.valide.params.id }));
});

routeurCours.post('/devoirs', publication, recevoirSupport(), async (req, res) => {
  const donnees = schemaDevoir.parse(req.body);
  res.status(201).json(await donnerDevoir(req.db, req.utilisateur, donnees, req.file));
});

routeurCours.delete(
  '/devoirs/:id',
  publication,
  valider({ params: schemaId }),
  async (req, res) => {
    res.json(await retirerDevoir(req.db, req.utilisateur, req.valide.params.id));
  },
);

routeurCours.get('/devoirs/:id/fichier', valider({ params: schemaId }), async (req, res) => {
  envoyerDocument(res, await fichierDevoir(req.db, req.valide.params.id));
});

// --- Copies rendues par les élèves --------------------------------------------------

routeurCours.get(
  '/devoirs/:id/copies',
  publication,
  valider({ params: schemaId }),
  async (req, res) => {
    res.json(await copiesDuDevoir(req.db, req.utilisateur, req.valide.params.id));
  },
);

routeurCours.patch(
  '/copies/:id',
  publication,
  valider({
    params: schemaId,
    body: z.object({ appreciation: z.string().trim().max(500).optional() }),
  }),
  async (req, res) => {
    res.json(
      await apprecierCopie(
        req.db,
        req.utilisateur,
        req.valide.params.id,
        req.valide.body.appreciation,
      ),
    );
  },
);

routeurCours.get(
  '/copies/fichiers/:id',
  publication,
  valider({ params: schemaId }),
  async (req, res) => {
    envoyerDocument(
      res,
      await fichierCopiePourEnseignant(req.db, req.utilisateur, req.valide.params.id),
    );
  },
);
