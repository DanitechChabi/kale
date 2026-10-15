// Dépôt public d'un dossier d'inscription d'établissement : POST /api/inscription-ecole
import { Router } from 'express';
import { config } from '../config/env.js';
import {
  inscrireEcole,
  lireDonneesMultipart,
  schemaInscriptionEcole,
} from '../contexts/inscription/serviceInscriptionEcole.js';
import { limiterInscription } from '../middlewares/limites.js';
import { recevoirPiecesInscription } from '../middlewares/televersement.js';

export function creerRouteurInscriptionEcole({ limite = config.LIMITE_INSCRIPTION } = {}) {
  const routeur = Router();
  routeur.post('/', limiterInscription(limite), recevoirPiecesInscription(), async (req, res) => {
    const donnees = schemaInscriptionEcole.parse(lireDonneesMultipart(req.body));
    const ecole = await inscrireEcole(donnees, req.files, { adresseIp: req.ip });
    res.status(201).json({
      ecole,
      message:
        'Dossier déposé. Vous pouvez vous connecter pour suivre sa vérification ; les autres comptes de l’établissement seront ouverts après validation.',
    });
  });
  return routeur;
}
