// Fonctionnement hors connexion (saisie des notes).
//
// - Un petit stockage IndexedDB garde : la file des envois en attente, les
//   brouillons de feuilles de notes et une copie des dernières données lues.
// - Les envois sont rejoués dans l'ordre au retour du réseau (événement
//   « online »), sans interrogation périodique : pas de consommation inutile
//   de batterie ni de data.
// - Les opérations sont idempotentes côté serveur : un envoi rejoué deux fois
//   ne crée pas de doublon.
import { appelApi, ErreurApi } from './api.js';

const BASE = 'edureleve';
const MAGASINS = ['file', 'brouillons', 'cache'];

// Repli en mémoire quand IndexedDB est indisponible (navigation privée, tests)
const memoire = Object.fromEntries(MAGASINS.map((m) => [m, new Map()]));
let ouverture;

function ouvrir() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  ouverture ??= new Promise((resoudre) => {
    const requete = indexedDB.open(BASE, 1);
    requete.onupgradeneeded = () => MAGASINS.forEach((m) => requete.result.createObjectStore(m));
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => resoudre(null);
  });
  return ouverture;
}

async function operation(magasin, mode, action) {
  const base = await ouvrir();
  if (!base) return action(null, memoire[magasin]);
  return new Promise((resoudre, rejeter) => {
    const transaction = base.transaction(magasin, mode);
    const requete = action(transaction.objectStore(magasin));
    transaction.oncomplete = () => resoudre(requete?.result);
    transaction.onerror = () => rejeter(transaction.error);
  });
}

const lire = (magasin, cle) =>
  operation(magasin, 'readonly', (store, map) => (map ? map.get(cle) : store.get(cle)));
const ecrire = (magasin, cle, valeur) =>
  operation(magasin, 'readwrite', (store, map) =>
    map ? map.set(cle, valeur) : store.put(valeur, cle),
  );
const effacer = (magasin, cle) =>
  operation(magasin, 'readwrite', (store, map) => (map ? map.delete(cle) : store.delete(cle)));
const tout = (magasin) =>
  operation(magasin, 'readonly', (store, map) => (map ? [...map.values()] : store.getAll()));

// --- Copie locale des données lues -------------------------------------------

export const memoriser = (chemin, donnees) => ecrire('cache', chemin, { donnees, le: Date.now() });
export const relire = async (chemin) => (await lire('cache', chemin)) ?? null;

/** Lecture réseau avec repli sur la dernière copie connue. */
export async function lireAvecRepli(chemin, options) {
  try {
    const donnees = await appelApi(chemin, options);
    memoriser(chemin, donnees).catch(() => {});
    return { donnees, horsLigne: false };
  } catch (erreur) {
    if (erreur.code !== 'RESEAU') throw erreur;
    const copie = await relire(chemin);
    if (!copie) throw erreur;
    return { donnees: copie.donnees, horsLigne: true, copieDu: copie.le };
  }
}

/** Efface les copies locales (déconnexion : téléphone parfois partagé). La file d'envoi est conservée. */
export async function viderCopies() {
  const base = await ouvrir();
  if (!base) {
    memoire.cache.clear();
    memoire.brouillons.clear();
    return;
  }
  await Promise.all(
    ['cache', 'brouillons'].map((m) => operation(m, 'readwrite', (store) => store.clear())),
  );
}

// --- Brouillons de saisie ------------------------------------------------------

export const lireBrouillon = (cle) => lire('brouillons', cle);
export const ecrireBrouillon = (cle, valeur) =>
  ecrire('brouillons', cle, { ...valeur, le: Date.now() });
export const effacerBrouillon = (cle) => effacer('brouillons', cle);

// --- File des envois -----------------------------------------------------------

const abonnes = new Set();
const prevenir = async () => {
  const file = await fileEnAttente();
  abonnes.forEach((rappel) => rappel(file));
};
export function ecouterFile(rappel) {
  abonnes.add(rappel);
  fileEnAttente().then(rappel);
  return () => abonnes.delete(rappel);
}

export const fileEnAttente = async () =>
  ((await tout('file')) ?? []).sort((a, b) => a.creeLe - b.creeLe);

/**
 * Ajoute un envoi. `cle` regroupe les envois remplaçables : une nouvelle
 * feuille de notes pour la même évaluation remplace la précédente.
 */
export async function mettreEnFile({ cle, chemin, methode, corps, libelle }) {
  const existant = cle ? await lire('file', cle) : null;
  const id = cle ?? crypto.randomUUID();
  await ecrire('file', id, {
    id,
    chemin,
    methode,
    corps,
    libelle,
    creeLe: existant?.creeLe ?? Date.now(),
    erreur: null,
  });
  await prevenir();
}

let synchronisationEnCours = null;

/**
 * Rejoue les envois dans l'ordre. S'arrête au premier problème de réseau ;
 * un refus du serveur (période clôturée…) est conservé avec son message.
 */
export function synchroniser() {
  synchronisationEnCours ??= (async () => {
    let envoyes = 0;
    for (const envoi of await fileEnAttente()) {
      try {
        await appelApi(envoi.chemin, { methode: envoi.methode, corps: envoi.corps });
        await effacer('file', envoi.id);
        envoyes++;
      } catch (erreur) {
        // Réseau absent ou session à rouvrir : on réessaiera plus tard, sans marquer d'échec
        if (erreur instanceof ErreurApi && (erreur.code === 'RESEAU' || erreur.statut === 401))
          break;
        await ecrire('file', envoi.id, { ...envoi, erreur: erreur.message });
      }
    }
    await prevenir();
    return envoyes;
  })().finally(() => {
    synchronisationEnCours = null;
  });
  return synchronisationEnCours;
}

export async function abandonnerEnvoi(id) {
  await effacer('file', id);
  await prevenir();
}

// Au retour du réseau, envoi automatique
if (typeof window !== 'undefined') window.addEventListener('online', () => synchroniser());
