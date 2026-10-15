// Logo EduRelevé : icône (relevé scellé) + nom. Même dessin que branding/icone.svg.
// `anime` : le sceau apparaît puis la coche se trace (utilisé dans l'en-tête).
import { useId } from 'react';

export function IconeLogo({ className = 'h-9 w-9', anime = false }) {
  // Identifiant unique du dégradé : plusieurs logos peuvent coexister sur la page
  const idFond = `logo-fond-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg
      viewBox="0 0 512 512"
      className={`${className} ${anime ? 'logo-anime' : ''}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={idFond} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0E8A48" />
          <stop offset="1" stopColor="#065F33" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${idFond})`} />
      <g transform="translate(-31 -24)">
        <path
          d="M150 96h150l76 76v236a24 24 0 0 1-24 24H150a24 24 0 0 1-24-24V120a24 24 0 0 1 24-24z"
          fill="#FFFFFF"
        />
        <path d="M300 96v52a24 24 0 0 0 24 24h52z" fill="#BFE3CC" />
        <rect x="172" y="200" width="150" height="20" rx="10" fill="#0E8A48" />
        <rect x="172" y="248" width="168" height="20" rx="10" fill="#0E8A48" opacity=".35" />
        <rect x="172" y="296" width="100" height="20" rx="10" fill="#0E8A48" opacity=".35" />
        <g className="sceau-logo">
          <circle cx="356" cy="372" r="92" fill="#065F33" />
          <circle cx="356" cy="372" r="74" fill="#FCD116" />
        </g>
        <path
          className="coche-logo"
          pathLength="1"
          d="M320 374l25 25 49-53"
          fill="none"
          stroke="#065F33"
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** Logo complet. `inverse` : version pour fond foncé. */
export default function Logo({
  inverse = false,
  anime = false,
  taille = 'h-9 w-9',
  texte = 'text-xl',
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <IconeLogo className={taille} anime={anime} />
      <span className={`${texte} font-bold tracking-tight`}>
        <span className={inverse ? 'text-white' : 'text-marque-900'}>Edu</span>
        <span className={inverse ? 'text-or' : 'text-marque-500'}>Relevé</span>
      </span>
    </span>
  );
}
