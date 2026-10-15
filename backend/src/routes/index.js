// Point d'entrée de toutes les routes de l'API, montées sous /api.
import { Router } from 'express';
import { routeurSante } from './sante.js';

export const routeurApi = Router();

routeurApi.use('/sante', routeurSante);
// Phases suivantes : /auth, /ecoles, /eleves, /notes, /releves, /verifier, /ministere…
