// Fournisseurs de messagerie EduMail : une interface commune, des pilotes interchangeables.
//
// Contrat d'un pilote (toutes les méthodes sont asynchrones) :
//   nom, simule                         → identification (simule : jamais en production)
//   etat()                              → { pret, raison } : identifiants, domaine, autorisations
//   trouver({ cle, adresse })           → { idExterne, statut } | null   (reprise après incident)
//   adresseDisponible(adresse)          → booléen
//   creerCompte({ cle, adresse, prenom, nom }) → { idExterne }
//   statut(idExterne)                   → 'ACTIF' | 'SUSPENDU' | 'CLOTURE' | 'INCONNU'
//   suspendre(idExterne), reactiver(idExterne), cloturer(idExterne)   (clôturer = désactiver)
//   reinitialiserAcces(idExterne)       → { motDePasseTemporaire } (remis une fois, jamais stocké)
// Toute erreur est une ErreurFournisseur { code, message } sans secret ni donnée personnelle.
//
// Aucun pilote réel n'est branché : un fournisseur (Google Workspace for Education,
// Microsoft 365 Éducation…) s'ajoute ici avec ses identifiants lus dans env.js, puis
// s'autorise dans EDUMAIL_FOURNISSEUR. Le reste du module ne change pas.
import { randomBytes, randomUUID } from 'node:crypto';
import { config } from '../../config/env.js';

export class ErreurFournisseur extends Error {
  constructor(code, message, { incertain = false } = {}) {
    super(message);
    this.code = code;
    // Résultat inconnu (délai dépassé…) : la relance vérifiera d'abord chez le fournisseur
    this.incertain = incertain;
  }
}

/** Fournisseur par défaut : rien n'est créé, l'interface l'indique clairement. */
const aucun = {
  nom: 'aucun',
  simule: false,
  async etat() {
    return { pret: false, raison: 'Aucun fournisseur de messagerie n’est configuré.' };
  },
  async trouver() {
    return null;
  },
  async adresseDisponible() {
    throw new ErreurFournisseur('NON_CONFIGURE', 'Aucun fournisseur de messagerie configuré');
  },
  ...Object.fromEntries(
    ['creerCompte', 'statut', 'suspendre', 'reactiver', 'cloturer', 'reinitialiserAcces'].map(
      (operation) => [
        operation,
        async () => {
          throw new ErreurFournisseur('NON_CONFIGURE', 'Aucun fournisseur de messagerie configuré');
        },
      ],
    ),
  ),
};

/**
 * Fournisseur simulé, en mémoire : développement et tests uniquement (refusé en
 * production par env.js). Les comptes qu'il « crée » sont marqués simulés partout.
 * Les tests peuvent provoquer une panne ou un échec après création (incident partiel).
 */
function creerSimulation() {
  const comptes = new Map(); // idExterne → { cle, adresse, statut }
  const incidents = { prochain: null };
  const incident = (operation) => {
    const i = incidents.prochain;
    if (!i || (i.operation && i.operation !== operation)) return;
    incidents.prochain = i.repeter ? i : null;
    if (i.apres) return i; // échec après l'opération (création réussie, réponse perdue)
    throw new ErreurFournisseur(i.code, i.message ?? 'Panne simulée du fournisseur', i);
  };
  const lire = (idExterne) => {
    const c = comptes.get(idExterne);
    if (!c) throw new ErreurFournisseur('INTROUVABLE', 'Compte inconnu du fournisseur');
    return c;
  };
  return {
    nom: 'simulation',
    simule: true,
    async etat() {
      return { pret: true, raison: 'Fournisseur simulé : aucune boîte réelle n’est créée.' };
    },
    async trouver({ cle, adresse }) {
      incident('trouver');
      for (const [idExterne, c] of comptes) {
        if ((cle && c.cle === cle) || (adresse && c.adresse === adresse)) {
          return { idExterne, statut: c.statut };
        }
      }
      return null;
    },
    async adresseDisponible(adresse) {
      incident('adresseDisponible');
      return ![...comptes.values()].some((c) => c.adresse === adresse);
    },
    async creerCompte({ cle, adresse }) {
      incident('creerCompte');
      const idExterne = `sim-${randomUUID()}`;
      comptes.set(idExterne, { cle, adresse, statut: 'ACTIF' });
      const apres = incident('creerCompte:apres');
      if (apres)
        throw new ErreurFournisseur(apres.code, 'Délai dépassé (simulé)', { incertain: true });
      return { idExterne };
    },
    async statut(idExterne) {
      return comptes.get(idExterne)?.statut ?? 'INCONNU';
    },
    async suspendre(idExterne) {
      incident('suspendre');
      lire(idExterne).statut = 'SUSPENDU';
    },
    async reactiver(idExterne) {
      incident('reactiver');
      lire(idExterne).statut = 'ACTIF';
    },
    async cloturer(idExterne) {
      incident('cloturer');
      lire(idExterne).statut = 'CLOTURE';
    },
    async reinitialiserAcces(idExterne) {
      incident('reinitialiserAcces');
      lire(idExterne);
      return { motDePasseTemporaire: randomBytes(9).toString('base64url') };
    },
    // --- Réservé aux tests ---
    _incident(prochain) {
      incidents.prochain = prochain;
    },
    _comptes: comptes,
  };
}

const PILOTES = { aucun, simulation: config.estProduction ? null : creerSimulation() };
let remplacement = null;

/** Pilote actif (les tests peuvent en substituer un). */
export function fournisseurEduMail() {
  if (remplacement) return remplacement;
  const pilote = PILOTES[config.EDUMAIL_FOURNISSEUR];
  if (!pilote) throw new Error(`Fournisseur EduMail indisponible : ${config.EDUMAIL_FOURNISSEUR}`);
  return pilote;
}

/** Réservé aux tests : remplace le pilote (null pour revenir à la configuration). */
export function remplacerFournisseurEduMail(pilote) {
  if (config.estProduction) throw new Error('Interdit en production');
  remplacement = pilote;
}

export { creerSimulation };

/**
 * Exécute un appel au fournisseur avec un délai maximal. Un dépassement est un
 * résultat incertain : l'opération a pu aboutir, la reprise vérifiera.
 */
export async function appelFournisseur(fonction, delai = config.EDUMAIL_DELAI_FOURNISSEUR_MS) {
  let minuteur;
  const limite = new Promise((_, rejeter) => {
    minuteur = setTimeout(
      () =>
        rejeter(
          new ErreurFournisseur('DELAI_DEPASSE', 'Le fournisseur n’a pas répondu à temps', {
            incertain: true,
          }),
        ),
      delai,
    );
  });
  try {
    return await Promise.race([fonction(), limite]);
  } catch (erreur) {
    if (erreur instanceof ErreurFournisseur) throw erreur;
    // Erreur inattendue d'un pilote : on ne renvoie jamais son message brut (secrets possibles)
    throw new ErreurFournisseur('ERREUR_FOURNISSEUR', 'Erreur inattendue du fournisseur', {
      incertain: true,
    });
  } finally {
    clearTimeout(minuteur);
  }
}
