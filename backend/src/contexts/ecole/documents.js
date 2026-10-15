// Contrôle et enregistrement d'une pièce justificative déposée.
import { basename } from 'node:path';
import { ErreurApi } from '../../middlewares/erreurs.js';
import { detecterTypeFichier, empreinteSha256, enregistrerFichier } from '../../utils/fichiers.js';

/** Vérifie le contenu réel du fichier (PDF, PNG ou JPEG uniquement). */
export function analyserPiece(type, fichier) {
  const format = detecterTypeFichier(fichier.buffer);
  if (!format) {
    throw new ErreurApi(
      400,
      'FICHIER_INVALIDE',
      'Seuls les fichiers PDF, JPEG et PNG sont acceptés',
      {
        piece: type,
        fichier: fichier.originalname,
      },
    );
  }
  return {
    type,
    contenu: fichier.buffer,
    format,
    nomFichier: basename(fichier.originalname || `document.${format.extension}`).slice(0, 255),
  };
}

/** Écrit la pièce sur disque et renvoie les champs à enregistrer en base. */
export async function stockerPiece(ecoleId, piece) {
  const cheminFichier = await enregistrerFichier(
    `documents-ecoles/${ecoleId}`,
    piece.contenu,
    piece.format.extension,
  );
  return {
    type: piece.type,
    nomFichier: piece.nomFichier,
    cheminFichier,
    typeMime: piece.format.typeMime,
    tailleOctets: piece.contenu.length,
    empreinteSha256: empreinteSha256(piece.contenu),
    referenceActe: piece.referenceActe ?? null,
    dateActe: piece.dateActe ?? null,
  };
}
