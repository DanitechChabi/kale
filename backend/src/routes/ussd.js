// Passerelle USSD de l'opérateur et simulateur : /api/ussd
import { timingSafeEqual } from 'node:crypto';
import express, { Router } from 'express';
import { z } from 'zod';
import { config } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { repondreUssd } from '../contexts/ussd/serviceUssd.js';
import { ErreurApi } from '../middlewares/erreurs.js';
import {
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import { valider } from '../middlewares/valider.js';
import { normaliserTelephone, schemaTelephone } from '../utils/identifiants.js';

const egal = (a, b) => {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && timingSafeEqual(x, y);
};

export function creerRouteurUssd() {
  const routeur = Router();

  // Appels de la passerelle (formulaire « sessionId, phoneNumber, text »), secret partagé
  routeur.post('/', express.urlencoded({ extended: false, limit: '10kb' }), async (req, res) => {
    if (!config.USSD_SECRET)
      throw new ErreurApi(404, 'INTROUVABLE', 'Passerelle USSD non configurée');
    if (!egal(req.get('x-ussd-secret') ?? req.query.cle, config.USSD_SECRET)) {
      throw new ErreurApi(401, 'NON_AUTHENTIFIE', 'Passerelle non reconnue');
    }
    const telephone = normaliserTelephone(String(req.body.phoneNumber ?? ''));
    const reponse = telephone
      ? await repondreUssd({ telephone, texte: String(req.body.text ?? '').slice(0, 200) })
      : 'END Numéro non reconnu.';
    res.type('text/plain').send(reponse);
  });

  // Simulateur : un parent essaie le service avec son propre numéro ; l'administrateur
  // de la plateforme peut essayer n'importe quel numéro
  routeur.post(
    '/simulation',
    authentifier,
    exigerMotDePasseDefinitif,
    exigerRole('PARENT', 'SUPER_ADMIN'),
    valider({
      body: z.object({
        texte: z
          .string()
          .max(200)
          .regex(/^[0-9*]*$/, 'Touches 0 à 9 et * uniquement'),
        telephone: schemaTelephone.optional(),
      }),
    }),
    async (req, res) => {
      let telephone = req.valide.body.telephone;
      if (req.utilisateur.role === 'PARENT' || !telephone) {
        const compte = await prisma.utilisateur.findUnique({
          where: { id: req.utilisateur.id },
          select: { telephone: true },
        });
        telephone = compte.telephone;
      }
      if (!telephone) throw new ErreurApi(400, 'TELEPHONE_REQUIS', 'Aucun numéro de téléphone');
      res.json({
        telephone,
        reponse: await repondreUssd({ telephone, texte: req.valide.body.texte }),
      });
    },
  );

  return routeur;
}
