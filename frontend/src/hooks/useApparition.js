import { useEffect, useRef, useState } from 'react';

// Détecte l'entrée d'un élément dans l'écran (une seule fois) pour déclencher son animation.
// Sans IntersectionObserver (vieux navigateur, tests), l'élément est visible d'emblée.
export function useApparition({ seuil = 0.15 } = {}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = ref.current;
    if (visible || !element) return undefined;

    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (entree.isIntersecting) {
          setVisible(true);
          observateur.disconnect();
        }
      },
      { threshold: seuil, rootMargin: '0px 0px -40px 0px' },
    );
    observateur.observe(element);
    return () => observateur.disconnect();
  }, [visible, seuil]);

  return [ref, visible];
}
