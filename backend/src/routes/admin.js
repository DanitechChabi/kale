// Administration de la plateforme : /api/admin/* (SUPER_ADMIN)
import { Router } from 'express';
import { z } from 'zod';
import { creerCompteNational } from '../contexts/utilisateurs/serviceUtilisateurs.js';
import {
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import { valider } from '../middlewares/valider.js';
import { schemaEmail, schemaTelephone } from '../utils/identifiants.js';
import { auteur } from './aide.js';

export const routeurAdmin = Router();
routeurAdmin.use(authentifier, exigerMotDePasseDefinitif, exigerRole('SUPER_ADMIN'));

const schemaCompteNational = z
  .object({
    role: z.enum(['MINISTERE', 'SUPER_ADMIN']),
    nom: z.string().trim().min(2).max(100),
    prenoms: z.string().trim().min(2).max(150),
    email: schemaEmail.optional(),
    telephone: schemaTelephone.optional(),
  })
  .refine((d) => d.email || d.telephone, {
    message: 'Indiquez un téléphone ou un e-mail',
    path: ['telephone'],
  });

routeurAdmin.post('/comptes', valider({ body: schemaCompteNational }), async (req, res) => {
  res.status(201).json(await creerCompteNational(auteur(req), req.valide.body));
});
