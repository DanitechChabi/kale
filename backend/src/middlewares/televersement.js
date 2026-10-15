// Réception des fichiers envoyés en multipart/form-data (en mémoire, taille bornée).
// Le contenu est ensuite contrôlé par signature (utils/fichiers.js) avant écriture.
import multer from 'multer';
import { config } from '../config/env.js';
import { TYPES_PIECES } from '../contexts/ecole/pieces.js';

const televerseur = () =>
  multer({
    storage: multer.memoryStorage(),
    defParamCharset: 'utf8',
    limits: {
      fileSize: config.TAILLE_MAX_DOCUMENT_MO * 1024 * 1024,
      files: 8,
      fields: 10,
      fieldSize: 64 * 1024,
    },
  });

/** Un champ de fichier par type de pièce (3 fichiers « AUTRE » au plus). */
export const recevoirPiecesInscription = () =>
  televerseur().fields(
    TYPES_PIECES.map((type) => ({ name: type, maxCount: type === 'AUTRE' ? 3 : 1 })),
  );

/** Un seul fichier, champ « fichier ». */
export const recevoirFichierUnique = () => televerseur().single('fichier');
