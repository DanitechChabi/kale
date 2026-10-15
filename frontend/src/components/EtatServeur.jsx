import { useEffect, useState } from 'react';
import { appelApi } from '../lib/api.js';

// Petit indicateur de connexion à l'API (utile pendant le développement et la démo).
export default function EtatServeur() {
  const [etat, setEtat] = useState('verification');

  useEffect(() => {
    const controleur = new AbortController();
    appelApi('/sante', { signal: controleur.signal })
      .then((r) => setEtat(r.statut === 'ok' ? 'ok' : 'erreur'))
      .catch((err) => {
        if (err.name !== 'AbortError') setEtat('erreur');
      });
    return () => controleur.abort();
  }, []);

  const styles = {
    verification: ['bg-gray-400', 'Vérification du serveur…'],
    ok: ['bg-green-500', 'Serveur connecté'],
    erreur: ['bg-red-500', 'Serveur injoignable'],
  };
  const [couleur, libelle] = styles[etat];

  return (
    <p className="inline-flex items-center gap-2 text-sm text-gray-600" role="status">
      <span className={`h-2.5 w-2.5 rounded-full ${couleur}`} aria-hidden="true" />
      {libelle}
    </p>
  );
}
