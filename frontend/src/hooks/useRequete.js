import { useCallback, useEffect, useState } from 'react';
import { appelApi } from '../lib/api.js';

/** Charge une ressource de l'API ; `recharger` relance la requête. */
export function useRequete(chemin) {
  const [etat, setEtat] = useState({ donnees: null, erreur: null, chargement: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!chemin) return undefined;
    const controleur = new AbortController();
    appelApi(chemin, { signal: controleur.signal }).then(
      (donnees) => setEtat({ donnees, erreur: null, chargement: false }),
      (erreur) =>
        erreur.name !== 'AbortError' && setEtat({ donnees: null, erreur, chargement: false }),
    );
    return () => controleur.abort();
  }, [chemin, version]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);
  return { ...etat, recharger };
}
