// Bulletins et relevés archivés de l'établissement, et documents de l'élève connecté.
import { Router } from 'express';
import { z } from 'zod';
import {
  contenuDocument,
  corrigerDocument,
  detailDocument,
  documentsEleve,
  etatClasse,
  genererClasse,
} from '../contexts/releves/serviceReleves.js';
import { ErreurApi } from '../middlewares/erreurs.js';
import {
  authentifier,
  exigerEcoleVerifiee,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import { valider } from '../middlewares/valider.js';
import { envoyerPdfArchive, schemaId } from './aide.js';

export const routeurReleves = Router();
routeurReleves.use(authentifier, exigerMotDePasseDefinitif, exigerEcoleVerifiee);

const secretariat = exigerRole('ADMIN_ECOLE', 'SECRETARIAT');
const selection = z.object({ classeId: z.uuid(), periodeId: z.uuid().optional() });

// --- Élève connecté ------------------------------------------------------------------

async function eleveConnecte(req) {
  const eleve = await req.db.eleve.findFirst({
    where: { utilisateurId: req.utilisateur.id },
    select: { id: true },
  });
  if (!eleve) throw new ErreurApi(404, 'INTROUVABLE', 'Fiche élève introuvable');
  return eleve;
}

routeurReleves.get('/mes-documents', exigerRole('ELEVE'), async (req, res) => {
  const eleve = await eleveConnecte(req);
  res.json(await documentsEleve(req.db, eleve.id));
});

routeurReleves.get(
  '/mes-documents/:id/pdf',
  exigerRole('ELEVE'),
  valider({ params: schemaId }),
  async (req, res) => {
    const eleve = await eleveConnecte(req);
    envoyerPdfArchive(
      res,
      await contenuDocument(req.db, req.valide.params.id, { eleveId: eleve.id }),
    );
  },
);

// --- Établissement ---------------------------------------------------------------------

routeurReleves.get('/classe', secretariat, valider({ query: selection }), async (req, res) => {
  res.json(await etatClasse(req.db, req.valide.query.classeId, req.valide.query.periodeId));
});

routeurReleves.post('/generation', secretariat, valider({ body: selection }), async (req, res) => {
  res.status(201).json(await genererClasse(req.db, req.utilisateur, req.valide.body));
});

routeurReleves.get('/eleve/:id', secretariat, valider({ params: schemaId }), async (req, res) => {
  res.json(await documentsEleve(req.db, req.valide.params.id));
});

routeurReleves.get('/:id', secretariat, valider({ params: schemaId }), async (req, res) => {
  res.json(await detailDocument(req.db, req.valide.params.id));
});

routeurReleves.get('/:id/pdf', secretariat, valider({ params: schemaId }), async (req, res) => {
  envoyerPdfArchive(res, await contenuDocument(req.db, req.valide.params.id));
});

// La correction est une décision du chef d'établissement
routeurReleves.post(
  '/:id/correction',
  exigerRole('ADMIN_ECOLE'),
  valider({
    params: schemaId,
    body: z.object({ motif: z.string().trim().min(5, 'Motif obligatoire').max(500) }),
  }),
  async (req, res) => {
    res
      .status(201)
      .json(
        await corrigerDocument(
          req.db,
          req.utilisateur,
          req.valide.params.id,
          req.valide.body.motif,
        ),
      );
  },
);
