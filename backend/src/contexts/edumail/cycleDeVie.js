// Cycle de vie d'un compte EduMail : transitions contrôlées, création idempotente chez le
// fournisseur, suspension, réactivation, clôture, réinitialisation de l'accès.
//
// Chaque transition :
// - est conditionnelle (« de tel statut vers tel statut ») : deux actions simultanées ne
//   peuvent pas aboutir toutes les deux ;
// - laisse un événement (historique en ajout seul) et, pour les décisions, une entrée du
//   journal d'audit ;
// - ne contient jamais de secret (mot de passe, jeton) ni de message brut du fournisseur.
import { randomInt } from 'node:crypto';
import { config } from '../../config/env.js';
import { ErreurApi } from '../../middlewares/erreurs.js';
import { journaliser } from '../audit/journal.js';
import { appelFournisseur, ErreurFournisseur, fournisseurEduMail } from './fournisseurs.js';
import {
  consentementRequis,
  consentementValable,
  situationEleve,
  statutAttente,
  STATUTS_EN_ATTENTE,
} from './eligibilite.js';

// Partie locale neutre : 10 caractères tirés au hasard (sans i, l, o, u pour éviter les
// confusions), sans lien avec le nom, le téléphone, le NPI ni l'identifiant de connexion
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
export const genererPartieLocale = () =>
  Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

/** Adresse complète, normalisée en minuscules. */
export function adresseDe(partieLocale, domaine = config.EDUMAIL_DOMAINE) {
  if (!domaine) return null;
  const adresse = `${partieLocale}@${domaine}`.toLowerCase();
  if (!/^[a-z0-9][a-z0-9.-]{2,31}@[a-z0-9.-]+\.[a-z]{2,63}$/.test(adresse)) {
    throw new ErreurApi(500, 'ADRESSE_INVALIDE', 'Adresse EduMail invalide');
  }
  return adresse;
}

/** État du service, sans aucun secret : peut être montré à tout utilisateur connecté. */
export async function etatService() {
  const fournisseur = fournisseurEduMail();
  const etat = await fournisseur
    .etat()
    .catch(() => ({ pret: false, raison: 'Fournisseur injoignable' }));
  return {
    fournisseur: fournisseur.nom,
    simulation: fournisseur.simule,
    domaineConfigure: Boolean(config.EDUMAIL_DOMAINE),
    domaine: config.EDUMAIL_DOMAINE ?? null,
    creationActivee: etat.pret && Boolean(config.EDUMAIL_DOMAINE),
    raison: !config.EDUMAIL_DOMAINE ? 'Aucun domaine de messagerie n’est configuré.' : etat.raison,
    urlWebmail: config.EDUMAIL_URL_WEBMAIL ?? null,
    consentement: {
      politique: config.EDUMAIL_CONSENTEMENT,
      age: config.EDUMAIL_CONSENTEMENT === 'avant_age' ? config.EDUMAIL_AGE_CONSENTEMENT : null,
    },
  };
}

/** Événement de l'historique (sans secret). */
export const evenement = (
  db,
  compte,
  { type, statutAvant, statutApres, auteurId, motif, details },
) =>
  db.eduMailEvenement.create({
    data: {
      compteId: compte.id,
      type,
      statutAvant: statutAvant ?? null,
      statutApres: statutApres ?? null,
      auteurId: auteurId ?? null,
      motif: motif ?? null,
      details: details ?? undefined,
    },
  });

/**
 * Transition conditionnelle : n'aboutit que si le compte est encore dans le statut lu.
 * Renvoie le compte à jour, ou lève une erreur 409 si quelqu'un a agi entre-temps.
 */
export async function transition(
  db,
  compte,
  vers,
  donnees,
  { type, auteur, motif, details, audit = true },
) {
  const { count } = await db.eduMailCompte.updateMany({
    where: { id: compte.id, statut: compte.statut },
    data: { statut: vers, ...donnees },
  });
  if (!count) {
    throw new ErreurApi(409, 'CONFLIT', 'Ce dossier vient d’être modifié : rechargez la page');
  }
  await evenement(db, compte, {
    type,
    statutAvant: compte.statut,
    statutApres: vers,
    auteurId: auteur?.id,
    motif,
    details,
  });
  if (audit && auteur) {
    await journaliser(db, {
      utilisateurId: auteur.id,
      action: 'MODIFICATION',
      entite: 'EduMailCompte',
      entiteId: compte.id,
      avant: { statut: compte.statut },
      apres: { statut: vers, action: type, ...(motif && { motif }) },
      adresseIp: auteur.adresseIp,
    });
  }
  return db.eduMailCompte.findUnique({ where: { id: compte.id } });
}

/** Charge un dossier de l'établissement (404 sinon, y compris pour un autre établissement). */
export async function chargerCompte(db, id) {
  const compte = await db.eduMailCompte.findUnique({
    where: { id },
    include: { consentements: { orderBy: { creeLe: 'asc' } }, identifiant: true },
  });
  if (!compte) throw new ErreurApi(404, 'INTROUVABLE', 'Dossier EduMail introuvable');
  return compte;
}

/** Situation, consentement requis et obtenu pour un dossier. */
export async function bilanDossier(db, compte) {
  const situation = await situationEleve(db, compte.eleveId);
  const requis = situation.eleve ? consentementRequis(situation.eleve) : true;
  const obtenu = (compte.consentements ?? []).some(consentementValable);
  return { situation, requis, obtenu };
}

/**
 * Recalcule le statut d'un dossier en attente (après une vérification de l'inscription ou
 * un changement de consentement). Sans effet sur les autres statuts.
 */
export async function reevaluer(db, lu, auteur, raison) {
  if (!STATUTS_EN_ATTENTE.includes(lu.statut)) return lu;
  // Relecture : les consentements viennent peut-être d'être ajoutés, validés ou retirés
  const compte = await chargerCompte(db, lu.id);
  if (!STATUTS_EN_ATTENTE.includes(compte.statut)) return compte;
  const bilan = await bilanDossier(db, compte);
  const vers = statutAttente(bilan.situation, bilan);
  await db.eduMailCompte.update({
    where: { id: compte.id },
    data: { consentementRequis: bilan.requis, derniereVerificationLe: new Date() },
  });
  if (vers === compte.statut) return db.eduMailCompte.findUnique({ where: { id: compte.id } });
  return transition(
    db,
    compte,
    vers,
    {},
    { type: 'REEVALUATION', auteur, motif: raison, audit: false },
  );
}

// --- Création chez le fournisseur -------------------------------------------------------

const VERROU_EXPIRE_MS = 10 * 60 * 1000;
const erreurCourte = (e) =>
  `${e.code ?? 'ERREUR'} : ${String(e.message ?? '').slice(0, 200)}`.slice(0, 300);

/**
 * Crée la boîte chez le fournisseur, de manière idempotente :
 * 1. réservation (APPROUVE ou ERREUR → EN_COURS) : une seule création à la fois ;
 * 2. recherche préalable chez le fournisseur par la clé du dossier et par l'adresse :
 *    un compte créé lors d'une tentative interrompue est repris, jamais recréé ;
 * 3. création, puis enregistrement de l'adresse et de l'identifiant externe.
 * Sans fournisseur prêt ou sans domaine, le dossier reste APPROUVE (rien n'est simulé).
 */
export async function provisionner(db, compteId, auteur) {
  const compte = await chargerCompte(db, compteId);
  if (!['APPROUVE', 'ERREUR'].includes(compte.statut)) {
    throw new ErreurApi(409, 'STATUT_INCOMPATIBLE', 'Ce dossier n’est pas prêt pour la création');
  }
  const service = await etatService();
  if (!service.creationActivee) {
    await evenement(db, compte, {
      type: 'CREATION_NON_ACTIVEE',
      statutAvant: compte.statut,
      statutApres: compte.statut,
      auteurId: auteur?.id,
      motif: service.raison,
    });
    return { compte, creationActivee: false, raison: service.raison };
  }
  const reserve = await db.eduMailCompte.updateMany({
    where: { id: compte.id, statut: compte.statut },
    data: { statut: 'EN_COURS', verrouLe: new Date(), tentatives: { increment: 1 } },
  });
  if (!reserve.count) throw new ErreurApi(409, 'CONFLIT', 'Une création est déjà en cours');
  await evenement(db, compte, {
    type: 'CREATION_DEMARREE',
    statutAvant: compte.statut,
    statutApres: 'EN_COURS',
    auteurId: auteur?.id,
  });

  const fournisseur = fournisseurEduMail();
  const adresse = adresseDe(compte.identifiant.partieLocale);
  const enCours = { ...compte, statut: 'EN_COURS' };
  try {
    const eleve = await db.eleve.findUnique({
      where: { id: compte.eleveId },
      select: { nom: true, prenoms: true },
    });
    let existant = await appelFournisseur(() => fournisseur.trouver({ cle: compte.id, adresse }));
    let repris = Boolean(existant);
    if (!existant) {
      if (!(await appelFournisseur(() => fournisseur.adresseDisponible(adresse)))) {
        throw new ErreurFournisseur(
          'ADRESSE_INDISPONIBLE',
          'Adresse déjà utilisée chez le fournisseur',
        );
      }
      existant = await appelFournisseur(() =>
        fournisseur.creerCompte({ cle: compte.id, adresse, prenom: eleve.prenoms, nom: eleve.nom }),
      );
      repris = false;
    }
    const actif = await transition(
      db,
      enCours,
      'ACTIF',
      {
        adresse,
        fournisseur: fournisseur.nom,
        idExterne: existant.idExterne,
        simule: fournisseur.simule,
        activeLe: new Date(),
        verrouLe: null,
        derniereErreur: null,
      },
      {
        type: repris ? 'CREATION_REPRISE' : 'CREATION_REUSSIE',
        auteur,
        details: { fournisseur: fournisseur.nom, simule: fournisseur.simule },
      },
    );
    return { compte: actif, creationActivee: true };
  } catch (erreur) {
    const e =
      erreur instanceof ErreurFournisseur || erreur instanceof ErreurApi
        ? erreur
        : new ErreurFournisseur('ERREUR_INTERNE', 'Erreur pendant la création');
    const echoue = await transition(
      db,
      enCours,
      'ERREUR',
      { verrouLe: null, derniereErreur: erreurCourte(e) },
      {
        type: 'CREATION_ECHOUEE',
        auteur,
        details: { code: e.code ?? 'ERREUR', incertain: Boolean(e.incertain) },
      },
    );
    return { compte: echoue, creationActivee: true, erreur: { code: e.code ?? 'ERREUR' } };
  }
}

/** Créations interrompues (arrêt du serveur) : repassées en ERREUR, relance possible. */
export async function reprendreCreationsInterrompues(prisma) {
  const limite = new Date(Date.now() - VERROU_EXPIRE_MS);
  const bloques = await prisma.eduMailCompte.findMany({
    where: { statut: 'EN_COURS', verrouLe: { lt: limite } },
    select: { id: true, ecoleId: true, statut: true },
  });
  for (const c of bloques) {
    const { count } = await prisma.eduMailCompte.updateMany({
      where: { id: c.id, statut: 'EN_COURS' },
      data: {
        statut: 'ERREUR',
        verrouLe: null,
        derniereErreur: 'INTERROMPU : création interrompue, à relancer (vérification préalable)',
      },
    });
    if (count) {
      await prisma.eduMailEvenement.create({
        data: {
          ecoleId: c.ecoleId,
          compteId: c.id,
          type: 'CREATION_INTERROMPUE',
          statutAvant: 'EN_COURS',
          statutApres: 'ERREUR',
        },
      });
    }
  }
  return bloques.length;
}

// --- Opérations sur un compte existant ---------------------------------------------------

/** Appel au fournisseur pour un compte déjà créé ; un échec laisse le statut inchangé. */
async function operationFournisseur(db, compte, auteur, operation) {
  const fournisseur = fournisseurEduMail();
  if (compte.fournisseur !== fournisseur.nom) {
    throw new ErreurApi(
      503,
      'FOURNISSEUR_INDISPONIBLE',
      'Le fournisseur de ce compte n’est plus configuré : opération impossible pour le moment',
    );
  }
  try {
    return await appelFournisseur(() => fournisseur[operation](compte.idExterne));
  } catch (erreur) {
    await evenement(db, compte, {
      type: `ECHEC_${operation.toUpperCase()}`,
      statutAvant: compte.statut,
      statutApres: compte.statut,
      auteurId: auteur?.id,
      details: { code: erreur.code ?? 'ERREUR' },
    });
    throw new ErreurApi(
      502,
      'FOURNISSEUR_ERREUR',
      'Le fournisseur de messagerie a refusé l’opération. Réessayez plus tard.',
      {
        code: erreur.code ?? 'ERREUR',
      },
    );
  }
}

export async function suspendre(db, compte, auteur, motif) {
  if (compte.statut !== 'ACTIF')
    throw new ErreurApi(409, 'STATUT_INCOMPATIBLE', 'Seul un compte actif peut être suspendu');
  await operationFournisseur(db, compte, auteur, 'suspendre');
  return transition(
    db,
    compte,
    'SUSPENDU',
    { motifSuspension: motif },
    { type: 'SUSPENSION', auteur, motif },
  );
}

export async function reactiver(db, compte, auteur, motif) {
  if (compte.statut !== 'SUSPENDU')
    throw new ErreurApi(409, 'STATUT_INCOMPATIBLE', 'Seul un compte suspendu peut être réactivé');
  await operationFournisseur(db, compte, auteur, 'reactiver');
  return transition(
    db,
    compte,
    'ACTIF',
    { motifSuspension: null },
    { type: 'REACTIVATION', auteur, motif },
  );
}

/** Clôture : désactivation chez le fournisseur (jamais de suppression), adresse conservée. */
export async function cloturer(db, compte, auteur, motif) {
  if (!['ACTIF', 'SUSPENDU', 'APPROUVE', 'ERREUR'].includes(compte.statut)) {
    throw new ErreurApi(409, 'STATUT_INCOMPATIBLE', 'Ce dossier ne peut pas être clôturé');
  }
  if (compte.idExterne) await operationFournisseur(db, compte, auteur, 'cloturer');
  return transition(
    db,
    compte,
    'CLOTURE',
    { motifCloture: motif },
    { type: 'CLOTURE', auteur, motif },
  );
}

/**
 * Réinitialise l'accès : le fournisseur génère un mot de passe temporaire, remis une seule
 * fois à l'appelant (jamais stocké ni journalisé).
 */
export async function reinitialiser(db, compte, auteur, { parEtablissement }) {
  if (compte.statut !== 'ACTIF') {
    throw new ErreurApi(
      409,
      'STATUT_INCOMPATIBLE',
      'L’accès ne peut être réinitialisé que pour un compte actif',
    );
  }
  const resultat = await operationFournisseur(db, compte, auteur, 'reinitialiserAcces');
  await evenement(db, compte, {
    type: 'REINITIALISATION',
    statutAvant: 'ACTIF',
    statutApres: 'ACTIF',
    auteurId: auteur.id,
    details: { parEtablissement },
  });
  await journaliser(db, {
    utilisateurId: auteur.id,
    action: 'MODIFICATION',
    entite: 'EduMailCompte',
    entiteId: compte.id,
    apres: { action: 'REINITIALISATION', parEtablissement },
    adresseIp: auteur.adresseIp,
  });
  return { motDePasseTemporaire: resultat.motDePasseTemporaire, simule: compte.simule };
}
