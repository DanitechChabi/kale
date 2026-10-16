import { useId, useRef, useState } from 'react';
import { CADRE_CARTE, DEPARTEMENTS_CARTE } from '../lib/carteBenin.js';
import { classes, RAMPE } from '../lib/tableauDeBord.js';

const CENTRE_LITTORAL = DEPARTEMENTS_CARTE.find((d) => d.code === 'LI').centre;

/**
 * Carte des départements colorés selon un indicateur (rampe séquentielle, plus foncé =
 * plus élevé). Un département sans donnée est hachuré. Survol ou focus : infobulle ;
 * clic ou Entrée : sélection du département. Les valeurs restent lisibles sans survol
 * dans le tableau de détail de la page.
 */
export default function CarteBenin({ zones, indicateur, selection, onChoisir }) {
  const idMotif = useId();
  const cadre = useRef(null);
  const [survol, setSurvol] = useState(null);
  const parCode = new Map(zones.map((z) => [z.code, z]));
  const { bornes, couleur, uniques } = classes(zones.map(indicateur.lire));

  // Position de l'infobulle : le pointeur, ou le centre du département au clavier
  const placer = (code, evenement) => {
    const boite = cadre.current.getBoundingClientRect();
    let { clientX: x, clientY: y } = evenement;
    if (x === undefined) {
      const r = evenement.currentTarget.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }
    setSurvol({ code, x: x - boite.left, y: y - boite.top, largeur: boite.width });
  };
  // Le département sélectionné est dessiné en dernier : son contour reste entier
  const ordre = [...DEPARTEMENTS_CARTE].sort(
    (a, b) => (parCode.get(a.code)?.id === selection) - (parCode.get(b.code)?.id === selection),
  );

  const zoneSurvol = survol && parCode.get(survol.code);
  const littoral = parCode.get('LI');
  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-end">
      <div ref={cadre} className="relative mx-auto w-full max-w-[19rem]">
        <svg
          viewBox={`-4 -4 ${CADRE_CARTE.largeur + 8} ${CADRE_CARTE.hauteur + 8}`}
          className="carte-benin h-auto w-full"
          role="group"
          aria-label={`Carte des départements : ${indicateur.libelle.toLowerCase()}`}
        >
          <defs>
            <pattern
              id={idMotif}
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill="var(--color-slate-100)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-slate-300)" strokeWidth="1.5" />
            </pattern>
          </defs>
          {ordre.map(({ code, d }, i) => {
            const zone = parCode.get(code);
            const valeur = zone ? indicateur.lire(zone) : null;
            const choisi = zone && selection === zone.id;
            return (
              <path
                key={code}
                d={d}
                fill={
                  valeur === null || valeur === undefined ? `url(#${idMotif})` : couleur(valeur)
                }
                stroke={choisi ? 'var(--color-encre)' : 'white'}
                strokeWidth={choisi ? 2.5 : 1.5}
                strokeLinejoin="round"
                className="departement cursor-pointer outline-none"
                style={{ '--delai': `${i * 45}ms` }}
                tabIndex={zone ? 0 : -1}
                role="button"
                aria-pressed={Boolean(choisi)}
                aria-label={zone ? `${zone.nom} : ${indicateur.afficher(valeur)}` : code}
                onPointerMove={(e) => placer(code, e)}
                onPointerLeave={() => setSurvol(null)}
                onFocus={(e) => placer(code, e)}
                onBlur={() => setSurvol(null)}
                onClick={() => zone && onChoisir(zone)}
                onKeyDown={(e) => {
                  if (zone && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onChoisir(zone);
                  }
                }}
              />
            );
          })}
          {/* Le Littoral (Cotonou) est minuscule à cette échelle : renvoi nommé et cliquable */}
          {littoral && (
            <g className="cursor-pointer" onClick={() => onChoisir(littoral)} aria-hidden="true">
              <line
                x1={CENTRE_LITTORAL[0] + 4}
                y1={CENTRE_LITTORAL[1]}
                x2={CENTRE_LITTORAL[0] + 52}
                y2={CENTRE_LITTORAL[1] - 14}
                stroke="var(--color-slate-400)"
                strokeWidth="1"
              />
              <text
                x={CENTRE_LITTORAL[0] + 55}
                y={CENTRE_LITTORAL[1] - 11}
                fontSize="12"
                fill="var(--color-slate-700)"
              >
                Littoral
              </text>
            </g>
          )}
        </svg>
        {zoneSurvol && (
          <div
            className="pointer-events-none absolute z-10 rounded-md bg-encre px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
            style={{
              left: Math.min(Math.max(survol.x, 60), survol.largeur - 60),
              top: survol.y - 12,
              transform: 'translate(-50%, -100%)',
            }}
            role="status"
          >
            <span className="chiffres block text-sm font-semibold">
              {indicateur.afficher(indicateur.lire(zoneSurvol))}
            </span>
            <span className="text-white/75">{zoneSurvol.nom}</span>
          </div>
        )}
      </div>

      {/* Légende : classes de la rampe, et hachure « sans donnée » */}
      <div className="space-y-2 text-xs text-slate-600">
        <p className="etiquette">{indicateur.libelle}</p>
        {bornes.length === 0 ? (
          <p>Aucune donnée pour cette année.</p>
        ) : (
          <ul className="space-y-1">
            {(uniques ? [RAMPE.at(-1)] : RAMPE).map((teinte, i) => (
              <li key={teinte} className="flex items-center gap-2">
                <span className="h-3 w-5 rounded-sm" style={{ background: teinte }} />
                <span className="chiffres">
                  {uniques
                    ? indicateur.afficher(bornes[0][0])
                    : `${indicateur.afficher(bornes[i][0])} – ${indicateur.afficher(bornes[i][1])}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-center gap-2">
          <svg className="h-3 w-5 rounded-sm" aria-hidden="true">
            <rect width="100%" height="100%" fill={`url(#${idMotif})`} />
          </svg>
          Sans donnée
        </p>
      </div>
    </div>
  );
}
