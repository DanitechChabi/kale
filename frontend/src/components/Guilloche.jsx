// Guillochis : réseaux de courbes entrelacées, comme sur les diplômes et les
// billets de banque. Ce motif de sécurité est le langage visuel du document
// authentique ; les tracés sont calculés (aucun fichier image à télécharger).
import { useMemo } from 'react';

const pas = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const versChemin = (points) =>
  points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');

/** Bande ondulée : familles de sinusoïdes déphasées qui se croisent. */
function cheminsBande({ largeur, hauteur, lignes, onde1, onde2 }) {
  const milieu = hauteur / 2;
  return pas(lignes, (i) => {
    const phase = (i / lignes) * Math.PI * 2;
    return versChemin(
      pas(Math.ceil(largeur / 4) + 1, (k) => {
        const x = k * 4;
        const y =
          milieu +
          hauteur * 0.32 * Math.sin((x / onde1) * Math.PI * 2 + phase) +
          hauteur * 0.12 * Math.sin((x / onde2) * Math.PI * 2 - phase * 2);
        return [x, y];
      }),
    );
  });
}

/**
 * Rosace : anneaux tressés de courbes polaires r(θ) = R + A·sin(nθ + φ),
 * chaque copie étant légèrement déphasée (motif des billets et diplômes).
 */
function cheminsRosace(rayon) {
  const anneaux = [
    { R: 0.8, A: 0.13, n: 14, copies: 10 },
    { R: 0.52, A: 0.1, n: 10, copies: 8 },
    { R: 0.28, A: 0.07, n: 7, copies: 6 },
  ];
  return anneaux.flatMap(({ R, A, n, copies }) =>
    pas(copies, (i) => {
      const phase = (i / copies) * ((Math.PI * 2) / n);
      const points = pas(721, (k) => {
        const theta = (k / 720) * Math.PI * 2;
        const r = rayon * (R + A * Math.sin(n * theta + phase));
        return [rayon + r * Math.cos(theta), rayon + r * Math.sin(theta)];
      });
      return versChemin(points) + 'Z';
    }),
  );
}

/**
 * <Guilloche variante="bande" /> ou <Guilloche variante="rosace" />.
 * `anime` : les traits se dessinent à l'apparition (voir animations.css).
 */
export default function Guilloche({
  variante = 'bande',
  largeur = 1200,
  hauteur = 160,
  lignes = 14,
  anime = false,
  className = '',
}) {
  const chemins = useMemo(() => {
    if (variante === 'rosace') return cheminsRosace(largeur / 2);
    return cheminsBande({ largeur, hauteur, lignes, onde1: largeur / 3.2, onde2: largeur / 7.5 });
  }, [variante, largeur, hauteur, lignes]);

  const taille = variante === 'rosace' ? `0 0 ${largeur} ${largeur}` : `0 0 ${largeur} ${hauteur}`;

  return (
    <svg
      viewBox={taille}
      preserveAspectRatio={variante === 'rosace' ? 'xMidYMid meet' : 'none'}
      className={`guilloche ${anime ? 'guilloche-anime' : ''} ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {chemins.map((d, i) => (
        <path
          key={i}
          d={d}
          pathLength="1"
          fill="none"
          stroke="currentColor"
          strokeWidth={variante === 'rosace' ? 0.75 : 1}
          vectorEffect="non-scaling-stroke"
          style={{ '--i': i }}
        />
      ))}
    </svg>
  );
}
