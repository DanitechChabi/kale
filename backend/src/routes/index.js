// Point d'entrée de toutes les routes de l'API, montées sous /api.
import { Router } from 'express';
import { routeurAdmin } from './admin.js';
import { creerRouteurAuth } from './auth.js';
import { routeurImport } from './import.js';
import { creerRouteurInscriptionEcole } from './inscriptionEcole.js';
import { routeurMonEcole } from './monEcole.js';
import { routeurNotes } from './notes.js';
import { routeurReferentiel } from './referentiel.js';
import { routeurSante } from './sante.js';
import { routeurScolarite } from './scolarite.js';
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
  routeur.use('/import', routeurImport);
  routeur.use('/', routeurNotes);
  // Préfixes variés (/classes, /eleves, /annees…), protégés dans le routeur lui-même
  routeur.use('/', routeurScolarite);
  return routeur;
}
