// Demandes de duplicata en ligne : un ancien élève (ou un parent) demande son
// bulletin ou son relevé sans se déplacer ; le secrétariat de l'établissement
// retrouve le document archivé et le délivre, ou rejette la demande avec un motif.
//
// Côté public, aucun compte n'est nécessaire : la demande est suivie avec son
// numéro de suivi et le téléphone déclaré, qui doivent correspondre tous deux.
import { prisma } from '../../config/prisma.js';
import { prismaPourEcole } from '../../db/isolation.js';
import { ErreurApi } from '../../middlewares/erreurs.js';
import { signerJetonDuplicata, verifierJetonDuplicata } from '../../utils/jetons.js';
import { formaterNumero, genererNumero, normaliserNumero } from '../../utils/numeroDocument.js';
import { contenuDocument, urlVerification } from '../releves/serviceReleves.js';

/** « Dossou-Yovo  Afiavi » → « DOSSOU YOVO AFIAVI » (accents, casse, tirets ignorés). */
export const nomCompare = (texte) =>
  (texte ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

const memeNom = (eleve, nom, prenoms) =>
  nomCompare(eleve.nom) === nomCompare(nom) &&
  nomCompare(eleve.prenoms).split(' ')[0] === nomCompare(prenoms).split(' ')[0];

const dateIso = (date) => new Date(date).toISOString().slice(0, 10);

// --- Côté public ---------------------------------------------------------------------

/** Établissements vérifiés, pour choisir où adresser la demande. */
export async function rechercherEtablissements(texte) {
  const ecoles = await prisma.ecole.findMany({
    where: {
      statutVerification: 'VERIFIEE',
      actif: true,
      ...(texte && {
        OR: [
          { nom: { contains: texte, mode: 'insensitive' } },
          { sigle: { contains: texte, mode: 'insensitive' } },
          { commune: { nom: { contains: texte, mode: 'insensitive' } } },
        ],
      }),
    },
    select: { id: true, nom: true, sigle: true, commune: { select: { nom: true } } },
    orderBy: { nom: 'asc' },
    take: 20,
  });
  return {
    etablissements: ecoles.map((e) => ({
      id: e.id,
      nom: e.nom,
      sigle: e.sigle,
      commune: e.commune?.nom ?? null,
    })),
  };
}

/**
 * Enregistre une demande. L'élève et l'année sont rapprochés automatiquement
 * quand c'est sans ambiguïté (même nom, premier prénom et date de naissance).
 * Client global : le demandeur n'a pas de compte ; l'école est choisie par lui
 * et doit être vérifiée.
 */
export async function deposerDemande(donnees) {
  const ecole = await prisma.ecole.findFirst({
    where: { id: donnees.ecoleId, statutVerification: 'VERIFIEE', actif: true },
    select: { id: true, nom: true },
  });
  if (!ecole) throw new ErreurApi(404, 'INTROUVABLE', 'Établissement introuvable');

  const [candidats, annee] = await Promise.all([
    prisma.eleve.findMany({
      where: { ecoleId: ecole.id, dateNaissance: donnees.dateNaissance },
      select: { id: true, nom: true, prenoms: true },
    }),
    prisma.anneeScolaire.findFirst({
      where: { ecoleId: ecole.id, libelle: donnees.libelleAnnee },
      select: { id: true },
    }),
  ]);
  const correspondants = candidats.filter((e) =>
    memeNom(e, donnees.nomEleve, donnees.prenomsEleve),
  );

  const demande = await prisma.demandeDuplicata.create({
    data: {
      ecoleId: ecole.id,
      numeroSuivi: genererNumero('D', new Date().getUTCFullYear()),
      eleveId: correspondants.length === 1 ? correspondants[0].id : null,
      nomDemandeur: donnees.nomDemandeur,
      telephone: donnees.telephone,
      email: donnees.email ?? null,
      typeDocument: donnees.typeDocument,
      nomEleve: donnees.nomEleve.toUpperCase(),
      prenomsEleve: donnees.prenomsEleve,
      dateNaissance: donnees.dateNaissance,
      matriculeDeclare: donnees.matriculeDeclare ?? null,
      numeroPeriode: donnees.typeDocument === 'BULLETIN_PERIODE' ? donnees.numeroPeriode : null,
      anneeScolaireId: annee?.id ?? null,
      libelleAnnee: donnees.libelleAnnee,
      classeDeclaree: donnees.classeDeclaree ?? null,
      motif: donnees.motif ?? null,
    },
  });
  return {
    numeroSuivi: formaterNumero(demande.numeroSuivi),
    etablissement: ecole.nom,
    demandeLe: demande.demandeLe,
  };
}

/** Suivi public : numéro de suivi ET téléphone déclaré, sinon « introuvable ». */
export async function suivreDemande(numeroSaisi, telephone) {
  const numeroSuivi = normaliserNumero(numeroSaisi);
  const demande =
    numeroSuivi &&
    (await prisma.demandeDuplicata.findUnique({
      where: { numeroSuivi },
      include: {
        ecole: { select: { nom: true } },
        releve: { select: { numero: true, type: true } },
      },
    }));
  // Même réponse si le numéro n'existe pas ou si le téléphone ne correspond pas
  if (!demande || demande.telephone !== telephone) {
    throw new ErreurApi(
      404,
      'INTROUVABLE',
      'Aucune demande ne correspond à ce numéro et ce téléphone',
    );
  }
  return {
    demande: {
      numeroSuivi: formaterNumero(demande.numeroSuivi),
      etablissement: demande.ecole.nom,
      typeDocument: demande.typeDocument,
      libelleAnnee: demande.libelleAnnee,
      numeroPeriode: demande.numeroPeriode,
      eleve: `${demande.nomEleve} ${demande.prenomsEleve}`,
      statut: demande.statut,
      motifRejet: demande.motifRejet,
      demandeLe: demande.demandeLe,
      priseEnChargeLe: demande.priseEnChargeLe,
      clotureLe: demande.clotureLe,
      document: demande.releve && {
        numero: formaterNumero(demande.releve.numero),
        urlVerification: urlVerification(demande.releve.numero),
        // Lien de téléchargement valable 15 minutes
        jetonTelechargement: signerJetonDuplicata(demande.id),
      },
    },
  };
}

/** Téléchargement public d'un duplicata délivré, avec un jeton de suivi valide. */
export async function telechargerDuplicata(jeton) {
  const demandeId = verifierJetonDuplicata(jeton);
  const demande =
    demandeId &&
    (await prisma.demandeDuplicata.findUnique({
      where: { id: demandeId },
      select: { statut: true, releveId: true, ecoleId: true },
    }));
  if (!demande || demande.statut !== 'DELIVREE') {
    throw new ErreurApi(
      410,
      'LIEN_EXPIRE',
      'Ce lien de téléchargement a expiré : reprenez le suivi de votre demande',
    );
  }
  return contenuDocument(prismaPourEcole(demande.ecoleId), demande.releveId);
}

// --- Côté établissement (client isolé req.db) ---------------------------------------

const resumeDemande = (d) => ({
  id: d.id,
  numeroSuivi: formaterNumero(d.numeroSuivi),
  statut: d.statut,
  typeDocument: d.typeDocument,
  libelleAnnee: d.libelleAnnee,
  numeroPeriode: d.numeroPeriode,
  nomEleve: d.nomEleve,
  prenomsEleve: d.prenomsEleve,
  dateNaissance: dateIso(d.dateNaissance),
  nomDemandeur: d.nomDemandeur,
  demandeLe: d.demandeLe,
  clotureLe: d.clotureLe,
  eleveIdentifie: Boolean(d.eleveId),
});

export async function listerDemandes(db, { statut } = {}) {
  const [demandes, compteurs] = await Promise.all([
    db.demandeDuplicata.findMany({
      where: statut ? { statut } : {},
      orderBy: [{ demandeLe: statut === 'DELIVREE' || statut === 'REJETEE' ? 'desc' : 'asc' }],
      take: 200,
    }),
    db.demandeDuplicata.groupBy({ by: ['statut'], _count: { _all: true } }),
  ]);
  return {
    demandes: demandes.map(resumeDemande),
    compteurs: Object.fromEntries(compteurs.map((c) => [c.statut, c._count._all])),
  };
}

async function chargerDemande(db, id) {
  const demande = await db.demandeDuplicata.findUnique({
    where: { id },
    include: {
      traitePar: { select: { nom: true, prenoms: true } },
      releve: { select: { id: true, numero: true } },
    },
  });
  if (!demande) throw new ErreurApi(404, 'INTROUVABLE', 'Demande introuvable');
  return demande;
}

/**
 * Détail d'une demande avec les élèves qui pourraient correspondre et, pour
 * chacun, les documents archivés du type demandé (le plus pertinent en premier).
 */
export async function detailDemande(db, id) {
  const demande = await chargerDemande(db, id);
  const nom = nomCompare(demande.nomEleve).split(' ')[0];
  const eleves = await db.eleve.findMany({
    where: demande.eleveId
      ? { id: demande.eleveId }
      : {
          OR: [
            { dateNaissance: demande.dateNaissance },
            { nom: { contains: nom, mode: 'insensitive' } },
            ...(demande.matriculeDeclare ? [{ matricule: demande.matriculeDeclare }] : []),
          ],
        },
    select: {
      id: true,
      nom: true,
      prenoms: true,
      matricule: true,
      dateNaissance: true,
      relevesArchives: {
        where: { type: demande.typeDocument },
        select: {
          id: true,
          numero: true,
          genereLe: true,
          remplacePar: { select: { id: true } },
          anneeScolaire: { select: { libelle: true } },
          periode: { select: { numero: true, type: true } },
        },
        orderBy: { genereLe: 'desc' },
      },
    },
    take: 15,
  });

  const score = (e) =>
    (dateIso(e.dateNaissance) === dateIso(demande.dateNaissance) ? 2 : 0) +
    (memeNom(e, demande.nomEleve, demande.prenomsEleve) ? 2 : 0) +
    (demande.matriculeDeclare && e.matricule === demande.matriculeDeclare ? 1 : 0);

  const candidats = eleves
    .map((e) => ({
      id: e.id,
      nom: e.nom,
      prenoms: e.prenoms,
      matricule: e.matricule,
      dateNaissance: dateIso(e.dateNaissance),
      correspondance: score(e),
      documents: e.relevesArchives
        // Seuls les documents en vigueur peuvent être délivrés
        .filter((r) => !r.remplacePar)
        .map((r) => ({
          id: r.id,
          numero: formaterNumero(r.numero),
          anneeScolaire: r.anneeScolaire.libelle,
          periode: r.periode,
          genereLe: r.genereLe,
          correspond:
            r.anneeScolaire.libelle === demande.libelleAnnee &&
            (demande.typeDocument === 'RELEVE_ANNUEL' ||
              r.periode?.numero === demande.numeroPeriode),
        }))
        .sort((a, b) => b.correspond - a.correspond),
    }))
    .sort((a, b) => b.correspondance - a.correspondance);

  return {
    demande: {
      ...resumeDemande(demande),
      telephone: demande.telephone,
      email: demande.email,
      classeDeclaree: demande.classeDeclaree,
      matriculeDeclare: demande.matriculeDeclare,
      motif: demande.motif,
      motifRejet: demande.motifRejet,
      priseEnChargeLe: demande.priseEnChargeLe,
      traitePar: demande.traitePar,
      document: demande.releve && {
        id: demande.releve.id,
        numero: formaterNumero(demande.releve.numero),
      },
    },
    candidats,
  };
}

function verifierOuverte(demande) {
  if (['DELIVREE', 'REJETEE'].includes(demande.statut)) {
    throw new ErreurApi(409, 'DEMANDE_CLOTUREE', 'Cette demande est déjà traitée');
  }
}

export async function prendreEnCharge(db, utilisateur, id) {
  const demande = await chargerDemande(db, id);
  verifierOuverte(demande);
  if (demande.statut === 'EN_ATTENTE') {
    await db.demandeDuplicata.update({
      where: { id },
      data: { statut: 'EN_COURS', priseEnChargeLe: new Date(), traiteParId: utilisateur.id },
    });
  }
  return detailDemande(db, id);
}

/** Délivre un document archivé de l'établissement, du type demandé et en vigueur. */
export async function delivrer(db, utilisateur, id, releveId) {
  const demande = await chargerDemande(db, id);
  verifierOuverte(demande);
  const releve = await db.releveArchive.findUnique({
    where: { id: releveId },
    select: { id: true, type: true, eleveId: true, remplacePar: { select: { id: true } } },
  });
  if (!releve) throw new ErreurApi(404, 'INTROUVABLE', 'Document introuvable');
  if (releve.type !== demande.typeDocument) {
    throw new ErreurApi(409, 'TYPE_DIFFERENT', 'Ce document n’est pas du type demandé');
  }
  if (releve.remplacePar) {
    throw new ErreurApi(
      409,
      'DEJA_REMPLACE',
      'Ce document a été remplacé : délivrez sa version corrigée',
    );
  }
  const maintenant = new Date();
  await db.demandeDuplicata.update({
    where: { id },
    data: {
      statut: 'DELIVREE',
      releveId: releve.id,
      eleveId: releve.eleveId,
      traiteParId: utilisateur.id,
      priseEnChargeLe: demande.priseEnChargeLe ?? maintenant,
      clotureLe: maintenant,
    },
  });
  return detailDemande(db, id);
}

export async function rejeter(db, utilisateur, id, motif) {
  const demande = await chargerDemande(db, id);
  verifierOuverte(demande);
  const maintenant = new Date();
  await db.demandeDuplicata.update({
    where: { id },
    data: {
      statut: 'REJETEE',
      motifRejet: motif,
      traiteParId: utilisateur.id,
      priseEnChargeLe: demande.priseEnChargeLe ?? maintenant,
      clotureLe: maintenant,
    },
  });
  return detailDemande(db, id);
}
