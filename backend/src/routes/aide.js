// Petits utilitaires partagés par les routes.
import { z } from 'zod';

export const schemaId = z.object({ id: z.uuid('Identifiant invalide') });

/** Auteur d'une action, pour le journal d'audit. */
export const auteur = (req) => ({ ...req.utilisateur, adresseIp: req.ip });

/** Envoie un document stocké, affiché dans le navigateur (jamais exécuté). */
export function envoyerDocument(res, { document, contenu }) {
  res.set({
    'Content-Type': document.typeMime,
    'Content-Length': contenu.length,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(document.nomFichier)}`,
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy':
      "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  });
  res.send(contenu);
}
