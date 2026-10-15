// Client HTTP vers l'API EduRelevé.
// - Le jeton d'accès est gardé en mémoire uniquement (jamais dans localStorage).
// - Le jeton de rafraîchissement voyage dans un cookie httpOnly géré par le navigateur.
// - Sur un jeton expiré, la session est rafraîchie une fois puis la requête rejouée.

const URL_API = import.meta.env.VITE_API_URL ?? '/api';

/** Erreur renvoyée par l'API, au format { erreur: { code, message, details } }. */
export class ErreurApi extends Error {
  constructor(statut, code, message, details) {
    super(message);
    this.statut = statut;
    this.code = code;
    this.details = details;
  }
}

let jetonAcces = null;
let surSessionPerdue = () => {};
let rafraichissementEnCours = null;

export const definirJetonAcces = (jeton) => {
  jetonAcces = jeton;
};
/** Appelé quand la session ne peut plus être renouvelée (retour à la connexion). */
export const surPerteDeSession = (rappel) => {
  surSessionPerdue = rappel;
};

async function executer(chemin, { methode = 'GET', corps, signal, format = 'json' } = {}) {
  const estFormulaire = corps instanceof FormData;
  let reponse;
  try {
    reponse = await fetch(`${URL_API}${chemin}`, {
      method: methode,
      headers: {
        ...(corps && !estFormulaire && { 'Content-Type': 'application/json' }),
        ...(jetonAcces && { Authorization: `Bearer ${jetonAcces}` }),
      },
      body: corps ? (estFormulaire ? corps : JSON.stringify(corps)) : undefined,
      credentials: 'include',
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ErreurApi(0, 'RESEAU', 'Impossible de joindre le serveur. Vérifiez votre connexion.');
  }

  if (reponse.ok) {
    if (reponse.status === 204) return null;
    return format === 'blob' ? reponse.blob() : reponse.json();
  }
  const donnees = await reponse.json().catch(() => null);
  const e = donnees?.erreur ?? {};
  throw new ErreurApi(
    reponse.status,
    e.code ?? 'INCONNUE',
    e.message ?? `Erreur ${reponse.status}`,
    e.details,
  );
}

/** Renouvelle la session ; les appels simultanés partagent la même requête. */
export function rafraichirSession() {
  rafraichissementEnCours ??= executer('/auth/rafraichir', { methode: 'POST' })
    .then((resultat) => {
      definirJetonAcces(resultat.jetonAcces);
      return resultat;
    })
    .finally(() => {
      rafraichissementEnCours = null;
    });
  return rafraichissementEnCours;
}

// Codes pour lesquels une session renouvelée peut réussir : jeton expiré, ou
// absent (application rouverte hors connexion, puis retour du réseau)
const SESSION_A_RENOUVELER = ['JETON_EXPIRE', 'NON_AUTHENTIFIE'];

export async function appelApi(chemin, options = {}) {
  try {
    return await executer(chemin, options);
  } catch (erreur) {
    if (!SESSION_A_RENOUVELER.includes(erreur.code) || chemin.startsWith('/auth/')) throw erreur;
    try {
      await rafraichirSession();
    } catch {
      definirJetonAcces(null);
      surSessionPerdue();
      throw erreur;
    }
    return executer(chemin, options);
  }
}

/** Message lisible pour une erreur de champ renvoyée par l'API. */
export function erreursParChamp(erreur) {
  if (erreur?.code !== 'VALIDATION') return {};
  return Object.fromEntries((erreur.details ?? []).map((d) => [d.champ, d.message]));
}
