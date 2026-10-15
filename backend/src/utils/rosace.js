// Rosace guillochée propre à chaque document, calculée à partir de son numéro.
//
// Imprimée sur le PDF et redessinée à l'identique sur la page publique de
// vérification : on compare d'un coup d'œil le document papier et l'archive.
// Ce n'est pas une preuve cryptographique (c'est le rôle de l'empreinte SHA-256),
// mais un repère visuel difficile à reproduire à la main.
import { createHash } from 'node:crypto';

const pas = (n, f) => Array.from({ length: n }, (_, i) => f(i));

/** Paramètres des anneaux, dérivés de façon déterministe du numéro. */
export function parametresRosace(numero) {
  const o = createHash('sha256').update(`rosace:${numero}`).digest();
  return [
    { R: 0.8, A: 0.1 + (o[0] % 6) / 100, n: 11 + (o[1] % 8), copies: 9, decalage: o[2] / 255 },
    { R: 0.53, A: 0.08 + (o[3] % 5) / 100, n: 7 + (o[4] % 6), copies: 7, decalage: o[5] / 255 },
    { R: 0.28, A: 0.05 + (o[6] % 4) / 100, n: 4 + (o[7] % 5), copies: 5, decalage: o[8] / 255 },
  ];
}

/** Tracés de la rosace (polylignes fermées), centrée sur (rayon, rayon). */
export function tracesRosace(numero, rayon, points = 360) {
  return parametresRosace(numero).flatMap(({ R, A, n, copies, decalage }) =>
    pas(copies, (i) => {
      const phase = ((i + decalage) / copies) * ((Math.PI * 2) / n);
      return pas(points + 1, (k) => {
        const theta = (k / points) * Math.PI * 2;
        const r = rayon * (R + A * Math.sin(n * theta + phase));
        return [rayon + r * Math.cos(theta), rayon + r * Math.sin(theta)];
      });
    }),
  );
}

/** Rosace en SVG autonome (page de vérification, sans JavaScript). */
export function svgRosace(numero, { taille = 120, couleur = '#065f33' } = {}) {
  const rayon = taille / 2;
  const chemins = tracesRosace(numero, rayon, 240)
    .map(
      (pts) =>
        `<path d="${pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')}Z"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${taille} ${taille}" width="${taille}" height="${taille}" fill="none" stroke="${couleur}" stroke-width="0.5" aria-hidden="true">${chemins}</svg>`;
}
