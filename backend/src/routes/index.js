// Point d'entrée de toutes les routes de l'API, montées sous /api.
import { Router } from 'express';
import { routeurAdmin } from './admin.js';
import { creerRouteurAuth } from './auth.js';
import { creerRouteurInscriptionEcole } from './inscriptionEcole.js';
import { routeurMonEcole } from './monEcole.js';
import { routeurReferentiel } from './referentiel.js';
import { routeurSante } from './sante.js';
import { routeurUtilisateurs } from './utilisateurs.js';
import { routeurVerification } from './verification.js';

export function creerRouteurApi(options = {}) {
  const routeur = Router();
  routeur.use('/sante', routeurSante);
  routeur.use('/referentiel', routeurReferentiel);
  routeur.use('/auth', creerRouteurAuth(options.auth));
  routeur.use('/inscription-ecole', creerRouteurInscriptionEcole(options.inscription));
  routeur.use('/mon-ecole', routeurMonEcole);
  routeur.use('/verification', routeurVerification);
  routeur.use('/utilisateurs', routeurUtilisateurs);
  routeur.use('/admin', routeurAdmin);
  return routeur;
}
