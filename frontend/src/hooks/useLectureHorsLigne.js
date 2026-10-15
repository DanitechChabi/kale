import { useCallback, useEffect, useState } from 'react';
import { lireAvecRepli } from '../lib/horsLigne.js';

/** Comme useRequete, avec repli sur la dernière copie connue sans réseau. */
export function useLectureHorsLigne(chemin) {
  const [etat, setEtat] = useState({
    donnees: null,
    erreur: null,
    chargement: true,
    horsLigne: false,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!chemin) return undefined;
    let actif = true;
    lireAvecRepli(chemin).then(
      ({ donnees, horsLigne }) =>
        actif && setEtat({ donnees, erreur: null, chargement: false, horsLigne }),
      (erreur) => actif && setEtat({ donnees: null, erreur, chargement: false, horsLigne: false }),
    );
    return () => {
      actif = false;
    };
  }, [chemin, version]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);
  return { ...etat, recharger };
}
