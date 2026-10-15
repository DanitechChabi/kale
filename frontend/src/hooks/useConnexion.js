import { useEffect, useState } from 'react';
import { ecouterFile, synchroniser } from '../lib/horsLigne.js';

/** État du réseau et des envois en attente. */
export function useConnexion() {
  const [enLigne, setEnLigne] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [file, setFile] = useState([]);

  useEffect(() => {
    const maj = () => setEnLigne(navigator.onLine);
    window.addEventListener('online', maj);
    window.addEventListener('offline', maj);
    const arreter = ecouterFile(setFile);
    return () => {
      window.removeEventListener('online', maj);
      window.removeEventListener('offline', maj);
      arreter();
    };
  }, []);

  return {
    enLigne,
    file,
    enAttente: file.length,
    enErreur: file.filter((e) => e.erreur).length,
    synchroniser,
  };
}
