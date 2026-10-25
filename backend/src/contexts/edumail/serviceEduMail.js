// EduMail : cas d'usage de l'élève, du parent, de l'établissement et des comptes nationaux.
//
// Droits (toujours contrôlés ici, côté serveur) :
// - élève : demander, suivre, réinitialiser son accès (mot de passe EduRelevé exigé),
//   signaler une erreur d'identité ou d'inscription ;
// - parent relié : donner ou retirer son consentement ;
// - secrétariat : examiner, vérifier les pièces, saisir une attestation écrite, traiter
//   les signalements ; décider seulement avec une délégation explicite de la direction ;
// - direction : décisions, suspension, réactivation, clôture, délégation ;
// - comptes nationaux : statistiques agrégées et état de la configuration.
// L'établissement ne voit que ses élèves (client isolé). Aucun secret n'est renvoyé.
import { prisma } from '../../config/prisma.js';
import { prismaPourEcole } from '../../db/isolation.js';
import { ErreurApi } from '../../middlewares/erreurs.js';
import {
  detecterTypeFichier,
  empreinteSha256,
  enregistrerFichier,
  lireFichier,
} from '../../utils/fichiers.js';
import { verifierMotDePasse } from '../../utils/motDePasse.js';
import { journaliser } from '../audit/journal.js';
import { accesEnfant } from '../suivi/serviceSuivi.js';
import {
  bilanDossier,
  chargerCompte,
  cloturer,
  etatService,
  evenement,
  genererPartieLocale,
  provisionner,
  reactiver,
  reevaluer,
  reinitialiser,
  suspendre,
  transition,
} from './cycleDeVie.js';
import {
  consentementRequis,
  consentementValable,
  situationEleve,
  STATUTS_EN_ATTENTE,
  STATUTS_OUVERTS,
  statutAttente,
} from './eligibilite.js';

const MESSAGES_NON_ELIGIBLE = {
  FICHE_INTROUVABLE:
    'Votre compte n’est relié à aucune fiche élève : adressez-vous au secrétariat.',
  SANS_COMPTE: 'Votre compte n’est relié à aucune fiche élève : adressez-vous au secrétariat.',
  ECOLE_NON_VERIFIEE:
    'Votre établissement n’est pas encore vérifié : EduMail n’est pas disponible.',
};

// --- Présentation -----------------------------------------------------------------------

/** Ce que voit l'élève : jamais d'identifiant externe ni de message technique. */
function pourEleve(compte, bilan) {
  if (!compte) return null;
  const reel = ['ACTIF', 'SUSPENDU'].includes(compte.statut);
  return {
    id: compte.id,
    statut: compte.statut,
    adresse: reel || compte.statut === 'CLOTURE' ? compte.adresse : null,
    simule: compte.simule,
    demandeLe: compte.demandeLe,
    activeLe: compte.activeLe,
    derniereVerificationLe: compte.derniereVerificationLe,
    motifDecision: compte.statut === 'REFUSE' ? compte.motifDecision : null,
    motifSuspension: compte.statut === 'SUSPENDU' ? compte.motifSuspension : null,
    consentement: bilan && { requis: bilan.requis, obtenu: bilan.obtenu },
  };
}

async function noms(ids) {
  const uniques = [...new Set(ids.filter(Boolean))];
  if (!uniques.length) return new Map();
  // Client global : noms des auteurs (personnel, parents) affichés dans l'historique
  const personnes = await prisma.utilisateur.findMany({
    where: { id: { in: uniques } },
    select: { id: true, nom: true, prenoms: true, role: true },
  });
  return new Map(personnes.map((p) => [p.id, { nom: `${p.prenoms} ${p.nom}`, role: p.role }]));
}

const presenterConsentement = (c, personnes) => ({
  id: c.id,
  mode: c.mode,
  valable: consentementValable(c),
  parent: c.parentId ? (personnes.get(c.parentId) ?? null) : null,
  representantNom: c.representantNom,
  representantLien: c.representantLien,
  signeLe: c.signeLe,
  methode: c.methode,
  recueilliPar: personnes.get(c.recueilliParId) ?? null,
  recueilliParId: c.recueilliParId,
  preuve: Boolean(c.preuveChemin),
  validePar: c.valideParId ? (personnes.get(c.valideParId) ?? null) : null,
  valideLe: c.valideLe,
  retireLe: c.retireLe,
  retirePar: c.retireParId ? (personnes.get(c.retireParId) ?? null) : null,
  motifRetrait: c.motifRetrait,
  creeLe: c.creeLe,
});

// --- Élève --------------------------------------------------------------------------------

async function eleveDuCompte(db, utilisateur) {
  const eleve = await db.eleve.findFirst({
    where: { utilisateurId: utilisateur.id },
    select: { id: true },
  });
  if (!eleve) throw new ErreurApi(403, 'NON_ELIGIBLE', MESSAGES_NON_ELIGIBLE.FICHE_INTROUVABLE);
  return eleve.id;
}

const dernierDossier = (db, eleveId) =>
  db.eduMailCompte.findFirst({
    where: { eleveId },
    orderBy: { demandeLe: 'desc' },
    include: { consentements: true, identifiant: true },
  });

export async function vueEleve(db, utilisateur) {
  const service = await etatService();
  const eleve = await db.eleve.findFirst({
    where: { utilisateurId: utilisateur.id },
    select: { id: true },
  });
  if (!eleve) {
    return {
      service,
      eligibilite: { statut: 'NON_ELIGIBLE', message: MESSAGES_NON_ELIGIBLE.FICHE_INTROUVABLE },
      compte: null,
      signalements: [],
    };
  }
  const compte = await dernierDossier(db, eleve.id);
  const bilan = compte ? await bilanDossier(db, compte) : null;
  const s = bilan?.situation ?? (await situationEleve(db, eleve.id));
  const signalements = await db.eduMailSignalement.findMany({
    where: { eleveId: eleve.id },
    orderBy: { creeLe: 'desc' },
    take: 10,
    select: {
      id: true,
      categorie: true,
      message: true,
      statut: true,
      reponse: true,
      creeLe: true,
      traiteLe: true,
    },
  });
  return {
    service,
    eligibilite: {
      statut: s.statut,
      message:
        MESSAGES_NON_ELIGIBLE[s.motif] ??
        (s.statut === 'A_VERIFIER'
          ? 'Votre inscription de cette année doit être vérifiée par l’établissement avant toute décision.'
          : null),
    },
    compte: pourEleve(compte, bilan),
    signalements,
  };
}

/** Partie locale stable de l'élève, créée à sa première demande et jamais réattribuée. */
async function identifiantDe(db, eleveId) {
  const existant = await db.eduMailIdentifiant.findUnique({ where: { eleveId } });
  if (existant) return existant;
  for (let essai = 0; essai < 5; essai++) {
    try {
      return await db.eduMailIdentifiant.create({
        data: { eleveId, partieLocale: genererPartieLocale() },
      });
    } catch (erreur) {
      if (erreur.code !== 'P2002') throw erreur;
      const deja = await db.eduMailIdentifiant.findUnique({ where: { eleveId } });
      if (deja) return deja; // demande simultanée
    }
  }
  throw new ErreurApi(500, 'IDENTIFIANT_INDISPONIBLE', 'Impossible de réserver un identifiant');
}

/** L'élève demande son compte. Rejouable : un dossier déjà ouvert est renvoyé tel quel. */
export async function demander(db, utilisateur) {
  const eleveId = await eleveDuCompte(db, utilisateur);
  const situation = await situationEleve(db, eleveId);
  if (situation.statut === 'NON_ELIGIBLE') {
    throw new ErreurApi(
      403,
      'NON_ELIGIBLE',
      MESSAGES_NON_ELIGIBLE[situation.motif] ?? 'Demande impossible',
    );
  }
  const ouvert = await db.eduMailCompte.findFirst({
    where: { eleveId, statut: { in: STATUTS_OUVERTS } },
    include: { consentements: true },
  });
  if (ouvert) return { compte: pourEleve(ouvert, await bilanDossier(db, ouvert)), deja: true };
  // Une adresse clôturée n'est jamais rouverte ni réattribuée automatiquement
  const cloture = await db.eduMailCompte.findFirst({
    where: { eleveId, statut: 'CLOTURE', adresse: { not: null } },
  });
  if (cloture) {
    throw new ErreurApi(
      409,
      'COMPTE_CLOTURE',
      'Votre compte EduMail a été clôturé : adressez-vous à la direction de votre établissement',
    );
  }

  const identifiant = await identifiantDe(db, eleveId);
  const requis = consentementRequis(situation.eleve);
  const statut = statutAttente(situation, { requis, obtenu: false });
  let compte;
  try {
    compte = await db.eduMailCompte.create({
      data: {
        eleveId,
        identifiantId: identifiant.id,
        demandeurId: utilisateur.id,
        statut,
        consentementRequis: requis,
        derniereVerificationLe: new Date(),
      },
    });
  } catch (erreur) {
    if (erreur.code !== 'P2002') throw erreur;
    const existant = await db.eduMailCompte.findFirst({
      where: { eleveId, statut: { in: STATUTS_OUVERTS } },
      include: { consentements: true },
    });
    return { compte: pourEleve(existant, await bilanDossier(db, existant)), deja: true };
  }
  await evenement(db, compte, { type: 'DEMANDE', statutApres: statut, auteurId: utilisateur.id });
  await journaliser(db, {
    utilisateurId: utilisateur.id,
    action: 'CREATION',
    entite: 'EduMailCompte',
    entiteId: compte.id,
    apres: { statut },
    adresseIp: utilisateur.adresseIp,
  });
  return {
    compte: pourEleve({ ...compte, consentements: [] }, { requis, obtenu: false }),
    deja: false,
  };
}

export async function signaler(db, utilisateur, { categorie, message }) {
  const eleveId = await eleveDuCompte(db, utilisateur);
  const compte = await dernierDossier(db, eleveId);
  const s = await db.eduMailSignalement.create({
    data: { eleveId, compteId: compte?.id ?? null, auteurId: utilisateur.id, categorie, message },
    select: { id: true, categorie: true, message: true, statut: true, creeLe: true },
  });
  if (compte)
    await evenement(db, compte, {
      type: 'SIGNALEMENT',
      statutAvant: compte.statut,
      statutApres: compte.statut,
      auteurId: utilisateur.id,
      details: { categorie },
    });
  return { signalement: s };
}

/** Réinitialisation par l'élève : ré-authentification par son mot de passe EduRelevé. */
export async function reinitialiserParEleve(db, utilisateur, motDePasse) {
  const eleveId = await eleveDuCompte(db, utilisateur);
  const compte = await dernierDossier(db, eleveId);
  if (!compte) throw new ErreurApi(404, 'INTROUVABLE', 'Aucun compte EduMail');
  const titulaire = await db.utilisateur.findUnique({
    where: { id: utilisateur.id },
    select: { motDePasseHash: true },
  });
  if (!(await verifierMotDePasse(motDePasse, titulaire.motDePasseHash))) {
    await evenement(db, compte, {
      type: 'REINITIALISATION_REFUSEE',
      statutAvant: compte.statut,
      statutApres: compte.statut,
      auteurId: utilisateur.id,
    });
    throw new ErreurApi(401, 'MOT_DE_PASSE_INCORRECT', 'Mot de passe EduRelevé incorrect');
  }
  return reinitialiser(db, compte, utilisateur, { parEtablissement: false });
}

// --- Parent -------------------------------------------------------------------------------

async function dossierEnfant(parentId, eleveId) {
  const { db } = await accesEnfant(parentId, eleveId);
  const compte = await db.eduMailCompte.findFirst({
    where: { eleveId, statut: { in: STATUTS_OUVERTS } },
    include: { consentements: true },
  });
  return { db, compte };
}

export async function vueParent(parentId, eleveId) {
  const { db, compte } = await dossierEnfant(parentId, eleveId);
  if (!compte) return { compte: null, consentement: null, service: await etatService() };
  const bilan = await bilanDossier(db, compte);
  const mien = compte.consentements.find((c) => c.parentId === parentId && !c.retireLe);
  return {
    service: await etatService(),
    compte: pourEleve(compte, bilan),
    consentement: {
      requis: bilan.requis,
      obtenu: bilan.obtenu,
      donneParMoi: Boolean(mien),
      donneLe: mien?.creeLe ?? null,
    },
  };
}

export async function consentir(parent, eleveId) {
  const { db, compte } = await dossierEnfant(parent.id, eleveId);
  if (!compte) throw new ErreurApi(404, 'INTROUVABLE', 'Aucune demande EduMail pour cet enfant');
  if (compte.consentements.some((c) => c.parentId === parent.id && !c.retireLe))
    return vueParent(parent.id, eleveId);
  const c = await db.eduMailConsentement.create({
    data: {
      compteId: compte.id,
      mode: 'ESPACE_PARENT',
      parentId: parent.id,
      recueilliParId: parent.id,
      methode: 'ESPACE_PARENT_EN_LIGNE',
    },
  });
  await evenement(db, compte, {
    type: 'CONSENTEMENT_DONNE',
    statutAvant: compte.statut,
    statutApres: compte.statut,
    auteurId: parent.id,
    details: { mode: 'ESPACE_PARENT' },
  });
  await journaliser(db, {
    utilisateurId: parent.id,
    action: 'CREATION',
    entite: 'EduMailConsentement',
    entiteId: c.id,
    apres: { compte: compte.id, mode: 'ESPACE_PARENT' },
    adresseIp: parent.adresseIp,
  });
  await reevaluer(db, compte, parent, 'Consentement du parent');
  return vueParent(parent.id, eleveId);
}

/** Retrait d'un consentement : daté, jamais effacé ; le compte actif est signalé à l'établissement. */
async function retirerConsentements(db, compte, consentements, auteur, motif) {
  for (const c of consentements) {
    await db.eduMailConsentement.update({
      where: { id: c.id },
      data: { retireLe: new Date(), retireParId: auteur.id, motifRetrait: motif ?? null },
    });
    await journaliser(db, {
      utilisateurId: auteur.id,
      action: 'MODIFICATION',
      entite: 'EduMailConsentement',
      entiteId: c.id,
      avant: { retire: false },
      apres: { retire: true, motif: motif ?? null },
      adresseIp: auteur.adresseIp,
    });
  }
  await evenement(db, compte, {
    type: 'CONSENTEMENT_RETIRE',
    statutAvant: compte.statut,
    statutApres: compte.statut,
    auteurId: auteur.id,
    motif,
  });
  if (STATUTS_EN_ATTENTE.includes(compte.statut))
    return reevaluer(db, compte, auteur, 'Retrait du consentement');
  const a = await chargerCompte(db, compte.id);
  const bilan = await bilanDossier(db, a);
  if (bilan.requis && !bilan.obtenu && a.statut !== 'CLOTURE') {
    // Aucune suspension automatique : la direction examine et décide
    await db.eduMailCompte.update({
      where: { id: a.id },
      data: { aReexaminer: 'CONSENTEMENT_RETIRE' },
    });
    await evenement(db, a, {
      type: 'A_REEXAMINER',
      statutAvant: a.statut,
      statutApres: a.statut,
      motif: 'Consentement retiré',
    });
  }
  return a;
}

export async function retirerConsentementParent(parent, eleveId, motif) {
  const { db, compte } = await dossierEnfant(parent.id, eleveId);
  if (!compte) throw new ErreurApi(404, 'INTROUVABLE', 'Aucune demande EduMail pour cet enfant');
  const miens = compte.consentements.filter((c) => c.parentId === parent.id && !c.retireLe);
  if (miens.length) await retirerConsentements(db, compte, miens, parent, motif);
  return vueParent(parent.id, eleveId);
}

// --- Établissement ----------------------------------------------------------------------

async function delegation(utilisateur) {
  // Client global : réglage de l'établissement de l'utilisateur lui-même
  const ecole = await prisma.ecole.findUnique({
    where: { id: utilisateur.ecoleId },
    select: { edumailDelegationSecretariat: true },
  });
  return Boolean(ecole?.edumailDelegationSecretariat);
}

/** Décisions : la direction, ou le secrétariat sur délégation explicite (tracée). */
async function exigerDecideur(utilisateur) {
  if (utilisateur.role === 'ADMIN_ECOLE') return { parDelegation: false };
  if (utilisateur.role === 'SECRETARIAT' && (await delegation(utilisateur)))
    return { parDelegation: true };
  throw new ErreurApi(
    403,
    'ACCES_REFUSE',
    'Décision réservée à la direction (ou au secrétariat sur délégation)',
  );
}
const exigerDirection = (utilisateur) => {
  if (utilisateur.role !== 'ADMIN_ECOLE')
    throw new ErreurApi(403, 'ACCES_REFUSE', 'Action réservée à la direction');
};

export async function tableauEtablissement(db, utilisateur, { statut, reexaminer } = {}) {
  const where = {
    ...(statut && { statut }),
    ...(reexaminer && { aReexaminer: { not: null } }),
  };
  const [dossiers, compteurs, aReexaminer, signalements] = await Promise.all([
    db.eduMailCompte.findMany({
      where,
      orderBy: { demandeLe: 'desc' },
      take: 200,
      select: {
        id: true,
        statut: true,
        adresse: true,
        simule: true,
        demandeLe: true,
        activeLe: true,
        aReexaminer: true,
        consentementRequis: true,
        eleve: { select: { id: true, nom: true, prenoms: true, matricule: true } },
      },
    }),
    db.eduMailCompte.groupBy({ by: ['statut'], _count: { _all: true } }),
    db.eduMailCompte.count({ where: { aReexaminer: { not: null } } }),
    db.eduMailSignalement.count({ where: { statut: 'OUVERT' } }),
  ]);
  return {
    service: await etatService(),
    delegationSecretariat: await delegation(utilisateur),
    statistiques: {
      parStatut: Object.fromEntries(compteurs.map((c) => [c.statut, c._count._all])),
      aReexaminer,
      signalementsOuverts: signalements,
    },
    dossiers,
  };
}

export async function detailDossier(db, utilisateur, id) {
  const compte = await chargerCompte(db, id);
  const bilan = await bilanDossier(db, compte);
  const [evenements, signalements] = await Promise.all([
    db.eduMailEvenement.findMany({
      where: { compteId: id },
      orderBy: { creeLe: 'desc' },
      take: 100,
    }),
    db.eduMailSignalement.findMany({
      where: { eleveId: compte.eleveId },
      orderBy: { creeLe: 'desc' },
    }),
  ]);
  const personnes = await noms([
    ...compte.consentements.flatMap((c) => [
      c.parentId,
      c.recueilliParId,
      c.valideParId,
      c.retireParId,
    ]),
    ...evenements.map((e) => e.auteurId),
    compte.decisionParId,
    ...signalements.map((s) => s.traiteParId),
  ]);
  const { situation } = bilan;
  const decideur = await exigerDecideur(utilisateur).then(
    () => true,
    () => false,
  );
  return {
    service: await etatService(),
    droits: {
      decider: decideur,
      direction: utilisateur.role === 'ADMIN_ECOLE',
      utilisateurId: utilisateur.id,
    },
    dossier: {
      id: compte.id,
      statut: compte.statut,
      adresse: compte.adresse,
      adressePrevue: compte.identifiant.partieLocale,
      fournisseur: compte.fournisseur,
      referenceFournisseur: compte.idExterne,
      simule: compte.simule,
      demandeLe: compte.demandeLe,
      activeLe: compte.activeLe,
      derniereVerificationLe: compte.derniereVerificationLe,
      aReexaminer: compte.aReexaminer,
      decision: compte.decisionLe && {
        par: personnes.get(compte.decisionParId) ?? null,
        le: compte.decisionLe,
        parDelegation: compte.decisionParDelegation,
        motif: compte.motifDecision,
      },
      motifSuspension: compte.motifSuspension,
      motifCloture: compte.motifCloture,
      tentatives: compte.tentatives,
      derniereErreur: compte.derniereErreur,
    },
    eleve: situation.eleve && {
      id: situation.eleve.id,
      nom: situation.eleve.nom,
      prenoms: situation.eleve.prenoms,
      dateNaissance: situation.eleve.dateNaissance,
    },
    situation: {
      statut: situation.statut,
      motif: situation.motif,
      inscription: situation.inscription,
    },
    consentement: {
      requis: bilan.requis,
      obtenu: bilan.obtenu,
      liste: compte.consentements.map((c) => presenterConsentement(c, personnes)),
    },
    evenements: evenements.map((e) => ({
      id: e.id,
      type: e.type,
      statutAvant: e.statutAvant,
      statutApres: e.statutApres,
      motif: e.motif,
      details: e.details,
      auteur: personnes.get(e.auteurId) ?? null,
      le: e.creeLe,
    })),
    signalements: signalements.map((s) => ({
      id: s.id,
      categorie: s.categorie,
      message: s.message,
      statut: s.statut,
      reponse: s.reponse,
      creeLe: s.creeLe,
      traiteLe: s.traiteLe,
      traitePar: personnes.get(s.traiteParId) ?? null,
    })),
  };
}

export async function decider(db, utilisateur, id, { decision, motif }) {
  const { parDelegation } = await exigerDecideur(utilisateur);
  let compte = await chargerCompte(db, id);
  const donnees = {
    decisionParId: utilisateur.id,
    decisionLe: new Date(),
    decisionParDelegation: parDelegation,
    motifDecision: motif ?? null,
  };
  if (decision === 'REFUSER') {
    if (!motif) throw new ErreurApi(400, 'MOTIF_OBLIGATOIRE', 'Indiquez le motif du refus');
    if (
      ![...STATUTS_EN_ATTENTE, 'APPROUVE', 'ERREUR'].includes(compte.statut) ||
      compte.idExterne
    ) {
      throw new ErreurApi(
        409,
        'STATUT_INCOMPATIBLE',
        'Ce dossier ne peut plus être refusé (utilisez la clôture)',
      );
    }
    await transition(db, compte, 'REFUSE', donnees, {
      type: parDelegation ? 'REFUS_PAR_DELEGATION' : 'REFUS',
      auteur: utilisateur,
      motif,
    });
    return detailDossier(db, utilisateur, id);
  }
  // Approbation : la situation et le consentement sont revérifiés au moment de décider
  compte = await reevaluer(db, compte, utilisateur, 'Vérification avant décision');
  if (compte.statut === 'A_VERIFIER') {
    throw new ErreurApi(
      409,
      'INSCRIPTION_A_VERIFIER',
      'L’inscription de l’élève pour l’année en cours doit d’abord être vérifiée',
    );
  }
  if (compte.statut === 'EN_ATTENTE_CONSENTEMENT') {
    throw new ErreurApi(
      409,
      'CONSENTEMENT_MANQUANT',
      'Le consentement du représentant légal est requis et n’a pas été validé',
    );
  }
  if (compte.statut !== 'EN_ATTENTE_DECISION') {
    throw new ErreurApi(409, 'STATUT_INCOMPATIBLE', 'Ce dossier n’attend pas de décision');
  }
  await transition(db, compte, 'APPROUVE', donnees, {
    type: parDelegation ? 'APPROBATION_PAR_DELEGATION' : 'APPROBATION',
    auteur: utilisateur,
    motif,
  });
  const creation = await provisionner(db, id, utilisateur);
  return {
    ...(await detailDossier(db, utilisateur, id)),
    creation: {
      activee: creation.creationActivee,
      raison: creation.raison ?? null,
      erreur: creation.erreur ?? null,
    },
  };
}

export async function relancerCreation(db, utilisateur, id) {
  await exigerDecideur(utilisateur);
  const creation = await provisionner(db, id, utilisateur);
  return {
    ...(await detailDossier(db, utilisateur, id)),
    creation: {
      activee: creation.creationActivee,
      raison: creation.raison ?? null,
      erreur: creation.erreur ?? null,
    },
  };
}

export async function reverifier(db, utilisateur, id) {
  const compte = await chargerCompte(db, id);
  await reevaluer(db, compte, utilisateur, 'Vérification par l’établissement');
  await db.eduMailCompte.update({ where: { id }, data: { derniereVerificationLe: new Date() } });
  return detailDossier(db, utilisateur, id);
}

export async function actionCompte(db, utilisateur, id, { action, motif }) {
  exigerDirection(utilisateur);
  if (!motif) throw new ErreurApi(400, 'MOTIF_OBLIGATOIRE', 'Indiquez le motif');
  const compte = await chargerCompte(db, id);
  const operations = { SUSPENDRE: suspendre, REACTIVER: reactiver, CLOTURER: cloturer };
  await operations[action](db, compte, utilisateur, motif);
  return detailDossier(db, utilisateur, id);
}

/** Examen terminé d'un compte signalé « à réexaminer » (aucun changement de statut). */
export async function terminerReexamen(db, utilisateur, id, note) {
  await exigerDecideur(utilisateur);
  const compte = await chargerCompte(db, id);
  if (!compte.aReexaminer) return detailDossier(db, utilisateur, id);
  await db.eduMailCompte.update({ where: { id }, data: { aReexaminer: null } });
  await evenement(db, compte, {
    type: 'REEXAMEN_TERMINE',
    statutAvant: compte.statut,
    statutApres: compte.statut,
    auteurId: utilisateur.id,
    motif: note,
  });
  await journaliser(db, {
    utilisateurId: utilisateur.id,
    action: 'MODIFICATION',
    entite: 'EduMailCompte',
    entiteId: id,
    avant: { aReexaminer: compte.aReexaminer },
    apres: { aReexaminer: null, note },
    adresseIp: utilisateur.adresseIp,
  });
  return detailDossier(db, utilisateur, id);
}

export async function reinitialiserParEtablissement(db, utilisateur, id) {
  const compte = await chargerCompte(db, id);
  return reinitialiser(db, compte, utilisateur, { parEtablissement: true });
}

/** Attestation écrite du représentant légal : preuve déposée, puis vérifiée par une autre personne. */
export async function enregistrerAttestation(db, utilisateur, id, donnees, fichier) {
  const compte = await chargerCompte(db, id);
  if (!STATUTS_OUVERTS.includes(compte.statut))
    throw new ErreurApi(409, 'STATUT_INCOMPATIBLE', 'Dossier clôturé');
  if (!fichier)
    throw new ErreurApi(400, 'PREUVE_REQUISE', 'Joignez le document signé (PDF ou photo)');
  const format = detecterTypeFichier(fichier.buffer);
  if (!format)
    throw new ErreurApi(400, 'FICHIER_INVALIDE', 'Seuls les PDF, JPEG et PNG sont acceptés');
  const chemin = await enregistrerFichier(
    `edumail/consentements/${utilisateur.ecoleId}`,
    fichier.buffer,
    format.extension,
  );
  const c = await db.eduMailConsentement.create({
    data: {
      compteId: id,
      mode: 'ATTESTATION_ECRITE',
      representantNom: donnees.representantNom,
      representantLien: donnees.representantLien,
      signeLe: new Date(donnees.signeLe),
      recueilliParId: utilisateur.id,
      methode: 'ATTESTATION_ECRITE_SIGNEE',
      preuveChemin: chemin,
      preuveType: format.typeMime,
      preuveEmpreinte: empreinteSha256(fichier.buffer),
    },
  });
  await evenement(db, compte, {
    type: 'ATTESTATION_DEPOSEE',
    statutAvant: compte.statut,
    statutApres: compte.statut,
    auteurId: utilisateur.id,
  });
  await journaliser(db, {
    utilisateurId: utilisateur.id,
    action: 'CREATION',
    entite: 'EduMailConsentement',
    entiteId: c.id,
    apres: { compte: id, mode: 'ATTESTATION_ECRITE', empreinte: c.preuveEmpreinte },
    adresseIp: utilisateur.adresseIp,
  });
  return detailDossier(db, utilisateur, id);
}

export async function validerAttestation(db, utilisateur, id, consentementId) {
  const compte = await chargerCompte(db, id);
  const c = compte.consentements.find((x) => x.id === consentementId);
  if (!c || c.mode !== 'ATTESTATION_ECRITE' || c.retireLe)
    throw new ErreurApi(404, 'INTROUVABLE', 'Attestation introuvable');
  if (c.valideLe) return detailDossier(db, utilisateur, id);
  if (c.recueilliParId === utilisateur.id) {
    throw new ErreurApi(
      409,
      'VALIDATION_INDEPENDANTE',
      'L’attestation doit être vérifiée par une autre personne que celle qui l’a saisie',
    );
  }
  await db.eduMailConsentement.update({
    where: { id: c.id },
    data: { valideParId: utilisateur.id, valideLe: new Date() },
  });
  await evenement(db, compte, {
    type: 'ATTESTATION_VALIDEE',
    statutAvant: compte.statut,
    statutApres: compte.statut,
    auteurId: utilisateur.id,
  });
  await journaliser(db, {
    utilisateurId: utilisateur.id,
    action: 'MODIFICATION',
    entite: 'EduMailConsentement',
    entiteId: c.id,
    avant: { valide: false },
    apres: { valide: true },
    adresseIp: utilisateur.adresseIp,
  });
  await reevaluer(db, compte, utilisateur, 'Attestation validée');
  return detailDossier(db, utilisateur, id);
}

/** Correction : retrait d'un consentement erroné par l'établissement (motif obligatoire). */
export async function retirerConsentementEtablissement(db, utilisateur, id, consentementId, motif) {
  if (!motif) throw new ErreurApi(400, 'MOTIF_OBLIGATOIRE', 'Indiquez le motif du retrait');
  const compte = await chargerCompte(db, id);
  const c = compte.consentements.find((x) => x.id === consentementId && !x.retireLe);
  if (!c) throw new ErreurApi(404, 'INTROUVABLE', 'Consentement introuvable');
  await retirerConsentements(db, compte, [c], utilisateur, motif);
  return detailDossier(db, utilisateur, id);
}

export async function preuveConsentement(db, id, consentementId) {
  const c = await db.eduMailConsentement.findFirst({ where: { id: consentementId, compteId: id } });
  if (!c?.preuveChemin) throw new ErreurApi(404, 'INTROUVABLE', 'Preuve introuvable');
  return {
    document: {
      typeMime: c.preuveType,
      nomFichier: `consentement-${c.id.slice(0, 8)}.${c.preuveType === 'application/pdf' ? 'pdf' : c.preuveType.split('/')[1]}`,
    },
    contenu: await lireFichier(c.preuveChemin),
  };
}

export async function listerSignalements(db, { statut } = {}) {
  const liste = await db.eduMailSignalement.findMany({
    where: statut ? { statut } : {},
    orderBy: { creeLe: 'desc' },
    take: 200,
    include: { eleve: { select: { nom: true, prenoms: true, matricule: true } } },
  });
  return { signalements: liste.map(({ auteurId: _a, ...s }) => s) };
}

export async function traiterSignalement(db, utilisateur, id, { statut, reponse }) {
  const s = await db.eduMailSignalement.findUnique({ where: { id } });
  if (!s) throw new ErreurApi(404, 'INTROUVABLE', 'Signalement introuvable');
  const maj = await db.eduMailSignalement.update({
    where: { id },
    data: { statut, reponse, traiteParId: utilisateur.id, traiteLe: new Date() },
  });
  await journaliser(db, {
    utilisateurId: utilisateur.id,
    action: 'MODIFICATION',
    entite: 'EduMailSignalement',
    entiteId: id,
    avant: { statut: s.statut },
    apres: { statut },
    adresseIp: utilisateur.adresseIp,
  });
  return { signalement: maj };
}

export async function definirDelegation(utilisateur, active) {
  exigerDirection(utilisateur);
  const avant = await delegation(utilisateur);
  // Client global : réglage de l'établissement de la direction connectée uniquement
  await prisma.ecole.update({
    where: { id: utilisateur.ecoleId },
    data: { edumailDelegationSecretariat: active },
  });
  await journaliser(prisma, {
    ecoleId: utilisateur.ecoleId,
    utilisateurId: utilisateur.id,
    action: 'MODIFICATION',
    entite: 'Ecole',
    entiteId: utilisateur.ecoleId,
    avant: { edumailDelegationSecretariat: avant },
    apres: { edumailDelegationSecretariat: active },
    adresseIp: utilisateur.adresseIp,
  });
  return { delegationSecretariat: active };
}

// --- Vérification périodique ---------------------------------------------------------------

/**
 * Revérifie chaque dossier ouvert : les dossiers en attente changent d'état si les
 * données ont changé ; un compte dont l'élève n'est plus inscrit (ou dont le
 * consentement requis a disparu) est seulement signalé « à réexaminer ».
 */
export async function verifierDossiers() {
  // Client global : parcours des établissements ayant des dossiers EduMail ouverts
  const ecoles = await prisma.eduMailCompte.groupBy({
    by: ['ecoleId'],
    where: { statut: { in: STATUTS_OUVERTS } },
  });
  let signales = 0;
  for (const { ecoleId } of ecoles) {
    const db = prismaPourEcole(ecoleId);
    const dossiers = await db.eduMailCompte.findMany({
      where: { statut: { in: STATUTS_OUVERTS.filter((s) => s !== 'EN_COURS') } },
      include: { consentements: true },
    });
    for (const compte of dossiers) {
      if (STATUTS_EN_ATTENTE.includes(compte.statut)) {
        await reevaluer(db, compte, null, 'Vérification périodique');
        continue;
      }
      const bilan = await bilanDossier(db, compte);
      const raison =
        bilan.situation.statut !== 'ELIGIBLE'
          ? 'PLUS_INSCRIT'
          : bilan.requis && !bilan.obtenu
            ? 'CONSENTEMENT_RETIRE'
            : null;
      await db.eduMailCompte.update({
        where: { id: compte.id },
        data: {
          derniereVerificationLe: new Date(),
          ...(raison && !compte.aReexaminer && { aReexaminer: raison }),
        },
      });
      if (raison && !compte.aReexaminer) {
        signales++;
        await evenement(db, compte, {
          type: 'A_REEXAMINER',
          statutAvant: compte.statut,
          statutApres: compte.statut,
          motif:
            raison === 'PLUS_INSCRIT'
              ? 'Élève non inscrit pour l’année en cours'
              : 'Consentement requis absent',
        });
      }
    }
  }
  return { signales };
}

/** Relance quotidienne de la vérification (au démarrage puis toutes les 24 h). */
export function planifierVerifications() {
  const lancer = () =>
    verifierDossiers().catch((e) => console.error('EduMail, vérification :', e.message));
  lancer();
  setInterval(lancer, 24 * 3600 * 1000).unref();
}

// --- Comptes nationaux ------------------------------------------------------------------------

export async function statistiquesNationales(utilisateur) {
  // Client global : agrégats sans donnée personnelle (comptes nationaux)
  const parStatut = await prisma.eduMailCompte.groupBy({ by: ['statut'], _count: { _all: true } });
  const resultat = {
    service: await etatService(),
    parStatut: Object.fromEntries(parStatut.map((c) => [c.statut, c._count._all])),
  };
  if (utilisateur.role === 'SUPER_ADMIN') {
    const erreurs = await prisma.eduMailCompte.groupBy({
      by: ['ecoleId'],
      where: { statut: 'ERREUR' },
      _count: { _all: true },
    });
    const ecoles = await prisma.ecole.findMany({
      where: { id: { in: erreurs.map((e) => e.ecoleId) } },
      select: { id: true, nom: true },
    });
    resultat.erreursParEtablissement = erreurs.map((e) => ({
      etablissement: ecoles.find((x) => x.id === e.ecoleId)?.nom ?? '—',
      erreurs: e._count._all,
    }));
  }
  return resultat;
}
