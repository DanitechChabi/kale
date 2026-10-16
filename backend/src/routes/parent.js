// Espace parent : /api/parent (compte sans établissement, un ou plusieurs enfants).
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import {
  fichierCours,
  fichierDevoir,
  listerCours,
  listerDevoirs,
} from '../contexts/cours/serviceCours.js';
import { emploiDuTempsClasse } from '../contexts/emploiDuTemps/serviceEmploiDuTemps.js';
import { contenuDocument } from '../contexts/releves/serviceReleves.js';
import {
  accesEnfant,
  classeActuelle,
  mesEnfants,
  messagesParent,
  suiviEleve,
} from '../contexts/suivi/serviceSuivi.js';
import {
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import { valider } from '../middlewares/valider.js';
import { envoyerDocument, envoyerPdfArchive } from './aide.js';

export const routeurParent = Router();
routeurParent.use(authentifier, exigerMotDePasseDefinitif, exigerRole('PARENT'));

const schemaEnfant = z.object({ eleveId: z.uuid() });

routeurParent.get('/enfants', async (req, res) => {
  res.json(await mesEnfants(req.utilisateur.id));
});

routeurParent.get('/enfants/:eleveId', valider({ params: schemaEnfant }), async (req, res) => {
  const { db, lien } = await accesEnfant(req.utilisateur.id, req.valide.params.eleveId);
  res.json({ ...(await suiviEleve(db, req.valide.params.eleveId)), lien: lien.lien });
});

routeurParent.get(
  '/enfants/:eleveId/documents/:id/pdf',
  valider({ params: schemaEnfant.extend({ id: z.uuid() }) }),
  async (req, res) => {
    const { eleveId, id } = req.valide.params;
    const { db } = await accesEnfant(req.utilisateur.id, eleveId);
    envoyerPdfArchive(res, await contenuDocument(db, id, { eleveId }));
  },
);

routeurParent.get('/messages', async (req, res) => {
  // Client global : compte parent sans établissement (lecture de sa propre fiche)
  const parent = await prisma.utilisateur.findUnique({
    where: { id: req.utilisateur.id },
    select: { id: true, telephone: true },
  });
  res.json({ ...(await messagesParent(parent)), codeUssd: config.USSD_CODE ?? null });
});

/** Client isolé de l'école de l'enfant et sa classe actuelle. */
async function classeEnfant(req) {
  const { db } = await accesEnfant(req.utilisateur.id, req.valide.params.eleveId);
  return {
    db,
    eleveId: req.valide.params.eleveId,
    classeId: await classeActuelle(db, req.valide.params.eleveId),
  };
}
const avecDocument = schemaEnfant.extend({ id: z.uuid() });

routeurParent.get(
  '/enfants/:eleveId/emploi-du-temps',
  valider({ params: schemaEnfant }),
  async (req, res) => {
    const { db, classeId } = await classeEnfant(req);
    res.json(await emploiDuTempsClasse(db, classeId));
  },
);

routeurParent.get(
  '/enfants/:eleveId/cours',
  valider({ params: schemaEnfant }),
  async (req, res) => {
    const { db, classeId } = await classeEnfant(req);
    res.json(await listerCours(db, { classeId }));
  },
);

routeurParent.get(
  '/enfants/:eleveId/cours/:id/fichier',
  valider({ params: avecDocument }),
  async (req, res) => {
    const { db, classeId } = await classeEnfant(req);
    envoyerDocument(res, await fichierCours(db, req.valide.params.id, { classeId }));
  },
);

routeurParent.get(
  '/enfants/:eleveId/devoirs',
  valider({ params: schemaEnfant }),
  async (req, res) => {
    const { db, classeId, eleveId } = await classeEnfant(req);
    res.json(await listerDevoirs(db, { classeId, eleveId }));
  },
);

routeurParent.get(
  '/enfants/:eleveId/devoirs/:id/fichier',
  valider({ params: avecDocument }),
  async (req, res) => {
    const { db, classeId } = await classeEnfant(req);
    envoyerDocument(res, await fichierDevoir(db, req.valide.params.id, { classeId }));
  },
);
