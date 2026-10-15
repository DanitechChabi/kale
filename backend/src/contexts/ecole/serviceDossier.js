// Dossier de vérification vu par le responsable de l'établissement.
// Toutes les requêtes passent par le client isolé (req.db).
import { ErreurApi } from '../../middlewares/erreurs.js';
import { lireFichier, supprimerFichiers } from '../../utils/fichiers.js';
import { journaliser } from '../audit/journal.js';
import { analyserPiece, stockerPiece } from './documents.js';
import { LIBELLES_PIECES, piecesManquantes, piecesObligatoires } from './pieces.js';

const STATUTS_MODIFIABLES = ['EN_ATTENTE', 'EN_EXAMEN', 'REJETEE'];

export const SELECTION_DOCUMENT = {
  id: true,
  type: true,
  referenceActe: true,
  dateActe: true,
  nomFichier: true,
  typeMime: true,
  tailleOctets: true,
  statut: true,
  commentaire: true,
  deposeLe: true,
  examineLe: true,
};

export async function lireDossier(db, ecoleId) {
  const ecole = await db.ecole.findUnique({
    where: { id: ecoleId },
    include: {
      commune: { include: { departement: true } },
      documents: { select: SELECTION_DOCUMENT, orderBy: { deposeLe: 'asc' } },
    },
  });
  return {
    ecole: {
      id: ecole.id,
      code: ecole.code,
      nom: ecole.nom,
      statut: ecole.statut,
      type: ecole.type,
      ordres: ecole.ordres,
      commune: ecole.commune.nom,
      departement: ecole.commune.departement.nom,
      statutVerification: ecole.statutVerification,
      motifDecision: ecole.motifDecision,
      verifieeLe: ecole.verifieeLe,
    },
    documents: ecole.documents,
    piecesObligatoires: piecesObligatoires(ecole.statut).map((type) => ({
      type,
      libelle: LIBELLES_PIECES[type],
    })),
    piecesManquantes: piecesManquantes(ecole.statut, ecole.documents),
  };
}

export async function ajouterDocument(
  db,
  { ecoleId, utilisateurId, adresseIp },
  metadonnees,
  fichier,
) {
  const ecole = await db.ecole.findUnique({ where: { id: ecoleId } });
  if (!STATUTS_MODIFIABLES.includes(ecole.statutVerification)) {
    throw new ErreurApi(409, 'DOSSIER_CLOS', 'Le dossier ne peut plus être complété');
  }
  if (!fichier) throw new ErreurApi(400, 'FICHIER_MANQUANT', 'Joignez un fichier');

  const piece = { ...analyserPiece(metadonnees.type, fichier), ...metadonnees };
  const donnees = await stockerPiece(ecoleId, piece);
  try {
    const document = await db.documentEcole.create({
      data: { ...donnees, deposeParId: utilisateurId },
      select: SELECTION_DOCUMENT,
    });
    await journaliser(db, {
      utilisateurId,
      action: 'CREATION',
      entite: 'DocumentEcole',
      entiteId: document.id,
      apres: { type: document.type, nomFichier: document.nomFichier },
      adresseIp,
    });
    return document;
  } catch (erreur) {
    await supprimerFichiers([donnees.cheminFichier]);
    throw erreur;
  }
}

/** Nouvelle soumission d'un dossier rejeté, après ajout des pièces corrigées. */
export async function resoumettreDossier(db, { ecoleId, utilisateurId, adresseIp }) {
  const ecole = await db.ecole.findUnique({ where: { id: ecoleId }, include: { documents: true } });
  if (ecole.statutVerification !== 'REJETEE') {
    throw new ErreurApi(
      409,
      'DOSSIER_NON_REJETE',
      'Seul un dossier rejeté peut être soumis à nouveau',
    );
  }
  const manquantes = piecesManquantes(ecole.statut, ecole.documents);
  if (manquantes.length) {
    throw new ErreurApi(400, 'PIECES_MANQUANTES', 'Des pièces obligatoires sont manquantes', {
      manquantes,
    });
  }
  await db.ecole.update({
    where: { id: ecoleId },
    data: { statutVerification: 'EN_ATTENTE', motifDecision: null },
  });
  await journaliser(db, {
    utilisateurId,
    action: 'MODIFICATION',
    entite: 'Ecole',
    entiteId: ecoleId,
    avant: { statutVerification: 'REJETEE' },
    apres: { statutVerification: 'EN_ATTENTE' },
    adresseIp,
  });
}

/** Contenu d'un document (client isolé : uniquement ceux de l'établissement). */
export async function lireContenuDocument(client, documentId) {
  const document = await client.documentEcole.findUnique({ where: { id: documentId } });
  if (!document) throw new ErreurApi(404, 'INTROUVABLE', 'Document introuvable');
  return { document, contenu: await lireFichier(document.cheminFichier) };
}
