// Suivi de l'élève connecté : /api/moi
import { Router } from 'express';
import { suiviEleve } from '../contexts/suivi/serviceSuivi.js';
import { ErreurApi } from '../middlewares/erreurs.js';
import {
  authentifier,
  exigerEcoleVerifiee,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';

export const routeurEleve = Router();
routeurEleve.use(authentifier, exigerMotDePasseDefinitif, exigerRole('ELEVE'), exigerEcoleVerifiee);

routeurEleve.get('/suivi', async (req, res) => {
  const eleve = await req.db.eleve.findFirst({
    where: { utilisateurId: req.utilisateur.id },
    select: { id: true },
  });
  if (!eleve) throw new ErreurApi(404, 'INTROUVABLE', 'Fiche élève introuvable');
  res.json(await suiviEleve(req.db, eleve.id));
});
