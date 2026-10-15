import { useEffect, useRef } from 'react';
import { useMouvementReduit } from '../../hooks/useMouvementReduit.js';

const format = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Nombre qui défile de 0 jusqu'à sa valeur (courbe décélérée).
// Écrit directement dans le DOM pour éviter un rendu React à chaque image.
// `actif` : l'animation ne démarre qu'une fois l'élément visible.
export default function Compteur({ valeur, delai = 0, duree = 900, actif = true }) {
  const ref = useRef(null);
  const reduit = useMouvementReduit();

  useEffect(() => {
    const element = ref.current;
    if (!element || !actif) return undefined;
    if (reduit) {
      element.textContent = format.format(valeur);
      return undefined;
    }

    let image;
    let debut;
    const pas = (instant) => {
      debut ??= instant;
      const progression = Math.min(1, (instant - debut) / duree);
      element.textContent = format.format(valeur * (1 - (1 - progression) ** 3));
      if (progression < 1) image = requestAnimationFrame(pas);
    };
    const minuteur = setTimeout(() => (image = requestAnimationFrame(pas)), delai);
    return () => {
      clearTimeout(minuteur);
      cancelAnimationFrame(image);
    };
  }, [valeur, delai, duree, reduit, actif]);

  return (
    <span ref={ref} className="tabular-nums">
      {format.format(reduit ? valeur : 0)}
    </span>
  );
}
