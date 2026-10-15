// Client HTTP minimal vers l'API EduRelevé.
// Les jetons JWT seront gérés ici à partir de la phase 3.

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

export async function appelApi(chemin, { methode = 'GET', corps, signal } = {}) {
  let reponse;
  try {
    reponse = await fetch(`${URL_API}${chemin}`, {
      method: methode,
      headers: corps ? { 'Content-Type': 'application/json' } : undefined,
      body: corps ? JSON.stringify(corps) : undefined,
      credentials: 'include',
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ErreurApi(0, 'RESEAU', 'Impossible de joindre le serveur. Vérifiez votre connexion.');
  }

  const donnees = await reponse.json().catch(() => null);
  if (!reponse.ok) {
    const e = donnees?.erreur ?? {};
    throw new ErreurApi(
      reponse.status,
      e.code ?? 'INCONNUE',
      e.message ?? `Erreur ${reponse.status}`,
      e.details,
    );
  }
  return donnees;
}
