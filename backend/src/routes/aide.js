// Petits utilitaires partagés par les routes.
import { z } from 'zod';
import { formaterNumero } from '../utils/numeroDocument.js';

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

/**
 * Envoie le PDF figé d'un document archivé. Son nom porte le numéro du document ;
 * `telechargement` force l'enregistrement plutôt que l'affichage.
 */
export function envoyerPdfArchive(res, { document, contenu }, { telechargement = false } = {}) {
  const nom = `${document.type === 'BULLETIN_PERIODE' ? 'bulletin' : 'releve'}-${formaterNumero(document.numero)}.pdf`;
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': contenu.length,
    'Content-Disposition': `${telechargement ? 'attachment' : 'inline'}; filename="${nom}"`,
    'Cache-Control': 'private, no-store',
    'X-Empreinte-Sha256': document.empreinteSha256,
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  res.send(contenu);
}
