import { useSyncExternalStore } from 'react';

// Indique si l'utilisateur a demandé à réduire les animations (réglage d'accessibilité du système).
const requete = '(prefers-reduced-motion: reduce)';

function sAbonner(rappel) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const media = window.matchMedia(requete);
  media.addEventListener('change', rappel);
  return () => media.removeEventListener('change', rappel);
}

function lireValeur() {
  return typeof window !== 'undefined' && !!window.matchMedia?.(requete).matches;
}

export function useMouvementReduit() {
  return useSyncExternalStore(sAbonner, lireValeur, () => false);
}
