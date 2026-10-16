// Suivi de l'élève connecté : /api/moi
import { Router } from 'express';
import { z } from 'zod';
import {
  fichierCours,
  fichierDevoir,
  listerCours,
  listerDevoirs,
  marquerDevoir,
} from '../contexts/cours/serviceCours.js';
import { emploiDuTempsClasse } from '../contexts/emploiDuTemps/serviceEmploiDuTemps.js';
import { classeActuelle, suiviEleve } from '../contexts/suivi/serviceSuivi.js';
import { fichierRendu, pagesRendu, rendreCopie } from '../contexts/cours/serviceRendus.js';
import { recevoirCopie } from '../middlewares/televersement.js';
import { valider } from '../middlewares/valider.js';
import { envoyerDocument, schemaId } from './aide.js';
import { ErreurApi } from '../middlewares/erreurs.js';
import {
  authentifier,
  exigerEcoleVerifiee,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';

export const routeurEleve = Router();
routeurEleve.use(authentifier, exigerMotDePasseDefinitif, exigerRole('ELEVE'), exigerEcoleVerifiee);

async function eleveConnecte(req) {
  const eleve = await req.db.eleve.findFirst({
    where: { utilisateurId: req.utilisateur.id },
    select: { id: true },
  });
  if (!eleve) throw new ErreurApi(404, 'INTROUVABLE', 'Fiche élève introuvable');
  return { eleveId: eleve.id, classeId: await classeActuelle(req.db, eleve.id) };
}

routeurEleve.get('/suivi', async (req, res) => {
  const eleve = await req.db.eleve.findFirst({
    where: { utilisateurId: req.utilisateur.id },
    select: { id: true },
  });
  if (!eleve) throw new ErreurApi(404, 'INTROUVABLE', 'Fiche élève introuvable');
  res.json(await suiviEleve(req.db, eleve.id));
});

routeurEleve.get('/emploi-du-temps', async (req, res) => {
  const { classeId } = await eleveConnecte(req);
  res.json(await emploiDuTempsClasse(req.db, classeId));
});

routeurEleve.get('/cours', async (req, res) => {
  const { classeId } = await eleveConnecte(req);
  res.json(await listerCours(req.db, { classeId }));
});

routeurEleve.get('/cours/:id/fichier', valider({ params: schemaId }), async (req, res) => {
  const { classeId } = await eleveConnecte(req);
  envoyerDocument(res, await fichierCours(req.db, req.valide.params.id, { classeId }));
});

routeurEleve.get('/devoirs', async (req, res) => {
  const { eleveId, classeId } = await eleveConnecte(req);
  res.json(await listerDevoirs(req.db, { classeId, eleveId }));
});

routeurEleve.get('/devoirs/:id/fichier', valider({ params: schemaId }), async (req, res) => {
  const { classeId } = await eleveConnecte(req);
  envoyerDocument(res, await fichierDevoir(req.db, req.valide.params.id, { classeId }));
});

// Rejouable : l'état final est envoyé (fait ou non)
routeurEleve.put(
  '/devoirs/:id/fait',
  valider({ params: schemaId, body: z.object({ fait: z.boolean() }) }),
  async (req, res) => {
    const { eleveId, classeId } = await eleveConnecte(req);
    res.json(
      await marquerDevoir(req.db, {
        eleveId,
        classeId,
        devoirId: req.valide.params.id,
        fait: req.valide.body.fait,
      }),
    );
  },
);

// Copie rendue (photos ou PDF) : un nouvel envoi remplace le précédent
routeurEleve.put(
  '/devoirs/:id/copie',
  valider({ params: schemaId }),
  recevoirCopie(),
  async (req, res) => {
    const { eleveId, classeId } = await eleveConnecte(req);
    const commentaire = z
      .string()
      .trim()
      .max(500)
      .optional()
      .parse(req.body?.commentaire || undefined);
    res.json(
      await rendreCopie(req.db, {
        eleveId,
        classeId,
        devoirId: req.valide.params.id,
        commentaire,
        fichiers: req.files,
      }),
    );
  },
);

routeurEleve.get('/devoirs/:id/copie', valider({ params: schemaId }), async (req, res) => {
  const { eleveId } = await eleveConnecte(req);
  const rendu = await pagesRendu(req.db, { devoirId: req.valide.params.id, eleveId });
  res.json({
    pages: (rendu?.fichiers ?? []).map((f) => ({
      id: f.id,
      nom: f.nomFichier,
      typeMime: f.typeMime,
    })),
  });
});

routeurEleve.get('/copies/fichiers/:id', valider({ params: schemaId }), async (req, res) => {
  const { eleveId } = await eleveConnecte(req);
  envoyerDocument(res, await fichierRendu(req.db, req.valide.params.id, { eleveId }));
});
