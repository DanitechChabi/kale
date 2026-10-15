// Comptes de l'établissement : /api/utilisateurs/* (ADMIN_ECOLE, SECRETARIAT)
import { Router } from 'express';
import { z } from 'zod';
import {
  changerStatutCompte,
  creerCompteEcole,
  listerComptes,
  reinitialiserMotDePasse,
} from '../contexts/utilisateurs/serviceUtilisateurs.js';
import {
  authentifier,
  exigerEcoleVerifiee,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import { valider } from '../middlewares/valider.js';
import { schemaEmail, schemaTelephone } from '../utils/identifiants.js';
import { auteur, schemaId } from './aide.js';

export const routeurUtilisateurs = Router();
routeurUtilisateurs.use(
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole('ADMIN_ECOLE', 'SECRETARIAT'),
  exigerEcoleVerifiee,
);

const schemaCreation = z
  .object({
    role: z.enum(['ADMIN_ECOLE', 'SECRETARIAT', 'ENSEIGNANT', 'ELEVE', 'PARENT']),
    nom: z.string().trim().min(2).max(100).optional(),
    prenoms: z.string().trim().min(2).max(150).optional(),
    email: schemaEmail.optional(),
    telephone: schemaTelephone.optional(),
    eleveId: z.uuid().optional(),
    enfants: z
      .array(z.object({ eleveId: z.uuid(), lien: z.enum(['PERE', 'MERE', 'TUTEUR', 'AUTRE']) }))
      .max(20)
      .optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.email && !d.telephone) {
      ctx.addIssue({
        code: 'custom',
        path: ['telephone'],
        message: 'Indiquez un téléphone ou un e-mail',
      });
    }
    if (d.role === 'ELEVE' && !d.eleveId) {
      ctx.addIssue({
        code: 'custom',
        path: ['eleveId'],
        message: 'Choisissez la fiche de l’élève',
      });
    }
    if (d.role !== 'ELEVE' && (!d.nom || !d.prenoms)) {
      ctx.addIssue({ code: 'custom', path: ['nom'], message: 'Nom et prénoms obligatoires' });
    }
  });

routeurUtilisateurs.post('/', valider({ body: schemaCreation }), async (req, res) => {
  const resultat = await creerCompteEcole(req.db, auteur(req), req.valide.body);
  res.status(resultat.compteExistant ? 200 : 201).json(resultat);
});

const schemaListe = z.object({
  role: z.enum(['ADMIN_ECOLE', 'SECRETARIAT', 'ENSEIGNANT', 'ELEVE', 'PARENT']).optional(),
});

routeurUtilisateurs.get('/', valider({ query: schemaListe }), async (req, res) => {
  res.json({ comptes: await listerComptes(req.db, req.utilisateur.ecoleId, req.valide.query) });
});

routeurUtilisateurs.patch(
  '/:id/statut',
  valider({ params: schemaId, body: z.object({ actif: z.boolean() }) }),
  async (req, res) => {
    const compte = await changerStatutCompte(
      req.db,
      auteur(req),
      req.valide.params.id,
      req.valide.body.actif,
    );
    res.json({ compte });
  },
);

routeurUtilisateurs.post(
  '/:id/reinitialiser-mot-de-passe',
  valider({ params: schemaId }),
  async (req, res) => {
    res.json(await reinitialiserMotDePasse(req.db, auteur(req), req.valide.params.id));
  },
);
