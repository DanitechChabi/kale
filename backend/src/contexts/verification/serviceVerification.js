// Vérification des établissements par le ministère ou l'administrateur de la plateforme.
import { prisma } from '../../config/prisma.js';
import { ErreurApi } from '../../middlewares/erreurs.js';
import { journaliser } from '../audit/journal.js';
import { SELECTION_DOCUMENT } from '../ecole/serviceDossier.js';
import { LIBELLES_PIECES, piecesNonAcceptees, piecesObligatoires } from '../ecole/pieces.js';

/** Décisions possibles selon le statut actuel */
const TRANSITIONS = {
  EN_ATTENTE: ['EN_EXAMEN', 'VERIFIEE', 'REJETEE'],
  EN_EXAMEN: ['VERIFIEE', 'REJETEE'],
  VERIFIEE: ['SUSPENDUE'],
  SUSPENDUE: ['VERIFIEE'],
  REJETEE: [],
};

export async function listerEcoles({ statut, recherche, page, parPage }) {
  const where = {
    ...(statut && { statutVerification: statut }),
    ...(recherche && {
      OR: [
        { nom: { contains: recherche, mode: 'insensitive' } },
        { code: { contains: recherche, mode: 'insensitive' } },
      ],
    }),
  };
  const [total, ecoles, compteurs] = await Promise.all([
    prisma.ecole.count({ where }),
    prisma.ecole.findMany({
      where,
      orderBy: { creeLe: 'asc' },
      skip: (page - 1) * parPage,
      take: parPage,
      select: {
        id: true,
        code: true,
        nom: true,
        statut: true,
        type: true,
        statutVerification: true,
        creeLe: true,
        commune: { select: { nom: true, departement: { select: { nom: true } } } },
        _count: { select: { documents: true } },
      },
    }),
    prisma.ecole.groupBy({ by: ['statutVerification'], _count: true }),
  ]);
  return {
    total,
    page,
    parPage,
    compteurs: Object.fromEntries(compteurs.map((c) => [c.statutVerification, c._count])),
    ecoles: ecoles.map(({ commune, _count, ...e }) => ({
      ...e,
      commune: commune.nom,
      departement: commune.departement.nom,
      nombreDocuments: _count.documents,
    })),
  };
}

export async function detailEcole(ecoleId) {
  const ecole = await prisma.ecole.findUnique({
    where: { id: ecoleId },
    include: {
      commune: { include: { departement: true } },
      documents: { select: SELECTION_DOCUMENT, orderBy: { deposeLe: 'asc' } },
      utilisateurs: {
        where: { role: 'ADMIN_ECOLE' },
        select: { id: true, nom: true, prenoms: true, telephone: true, email: true, creeLe: true },
      },
      verifieePar: { select: { nom: true, prenoms: true, role: true } },
    },
  });
  if (!ecole) throw new ErreurApi(404, 'INTROUVABLE', 'Établissement introuvable');

  const { commune, utilisateurs, documents, ...reste } = ecole;
  return {
    ecole: { ...reste, commune: commune.nom, departement: commune.departement.nom },
    responsables: utilisateurs,
    documents,
    piecesObligatoires: piecesObligatoires(ecole.statut).map((type) => ({
      type,
      libelle: LIBELLES_PIECES[type],
    })),
    piecesNonAcceptees: piecesNonAcceptees(ecole.statut, documents),
    decisionsPossibles: TRANSITIONS[ecole.statutVerification],
  };
}

export async function examinerDocument(documentId, { statut, commentaire }, auteur) {
  const document = await prisma.documentEcole.findUnique({
    where: { id: documentId },
    include: { ecole: { select: { statutVerification: true } } },
  });
  if (!document) throw new ErreurApi(404, 'INTROUVABLE', 'Document introuvable');
  if (!['EN_ATTENTE', 'EN_EXAMEN'].includes(document.ecole.statutVerification)) {
    throw new ErreurApi(409, 'DOSSIER_CLOS', 'Ce dossier n’est plus en cours d’examen');
  }

  const misAJour = await prisma.documentEcole.update({
    where: { id: documentId },
    data: {
      statut,
      commentaire: commentaire ?? null,
      examineParId: auteur.id,
      examineLe: new Date(),
    },
    select: SELECTION_DOCUMENT,
  });
  await journaliser(prisma, {
    ecoleId: document.ecoleId,
    utilisateurId: auteur.id,
    action: 'MODIFICATION',
    entite: 'DocumentEcole',
    entiteId: documentId,
    avant: { statut: document.statut },
    apres: { statut, commentaire: commentaire ?? null },
    adresseIp: auteur.adresseIp,
  });
  return misAJour;
}

export async function deciderEcole(ecoleId, { statut, motif }, auteur) {
  const ecole = await prisma.ecole.findUnique({
    where: { id: ecoleId },
    include: { documents: true },
  });
  if (!ecole) throw new ErreurApi(404, 'INTROUVABLE', 'Établissement introuvable');

  if (!TRANSITIONS[ecole.statutVerification].includes(statut)) {
    throw new ErreurApi(
      409,
      'TRANSITION_INTERDITE',
      `Impossible de passer de « ${ecole.statutVerification} » à « ${statut} »`,
    );
  }
  if (['REJETEE', 'SUSPENDUE'].includes(statut) && !motif) {
    throw new ErreurApi(400, 'MOTIF_OBLIGATOIRE', 'Indiquez le motif de la décision');
  }
  if (statut === 'VERIFIEE') {
    const nonAcceptees = piecesNonAcceptees(ecole.statut, ecole.documents);
    if (nonAcceptees.length) {
      throw new ErreurApi(
        409,
        'PIECES_NON_ACCEPTEES',
        'Toutes les pièces obligatoires doivent être acceptées',
        {
          pieces: nonAcceptees,
        },
      );
    }
  }

  const decision = await prisma.ecole.update({
    where: { id: ecoleId },
    data: {
      statutVerification: statut,
      motifDecision: ['REJETEE', 'SUSPENDUE'].includes(statut) ? motif : null,
      ...(statut === 'VERIFIEE' && { verifieeLe: new Date(), verifieeParId: auteur.id }),
    },
    select: { id: true, statutVerification: true, motifDecision: true, verifieeLe: true },
  });
  await journaliser(prisma, {
    ecoleId,
    utilisateurId: auteur.id,
    action: 'MODIFICATION',
    entite: 'Ecole',
    entiteId: ecoleId,
    avant: { statutVerification: ecole.statutVerification },
    apres: { statutVerification: statut, motif: motif ?? null },
    adresseIp: auteur.adresseIp,
  });
  return decision;
}
