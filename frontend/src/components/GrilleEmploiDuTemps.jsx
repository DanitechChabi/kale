import { useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import {
  DEBUT_JOURNEE,
  FIN_JOURNEE,
  JOURS,
  JOURS_COURTS,
  enHeure,
  enMinutes,
  heureLisible,
  jourDe,
  teinteMatiere,
} from '../lib/emploiDuTemps.js';

const HAUTEUR_HEURE = 56; // px
const HEURES = Array.from(
  { length: (FIN_JOURNEE - DEBUT_JOURNEE) / 60 },
  (_, i) => DEBUT_JOURNEE + i * 60,
);

const legende = (c, afficherClasse) =>
  afficherClasse
    ? c.classe.nom
    : c.enseignant
      ? `${c.enseignant.prenoms[0]}. ${c.enseignant.nom}`
      : '';

/** Bloc d'un cours, positionné selon son horaire. */
function Bloc({ creneau, afficherClasse, onClick, index }) {
  const debut = enMinutes(creneau.heureDebut);
  const fin = enMinutes(creneau.heureFin);
  const style = {
    top: ((debut - DEBUT_JOURNEE) / 60) * HAUTEUR_HEURE,
    height: ((fin - debut) / 60) * HAUTEUR_HEURE - 3,
    '--delai': `${Math.min(index, 14) * 20}ms`,
  };
  const Element = onClick ? 'button' : 'div';
  return (
    <Element
      type={onClick ? 'button' : undefined}
      onClick={onClick ? () => onClick(creneau) : undefined}
      className={`entree absolute inset-x-1 flex flex-col justify-start overflow-hidden rounded-md px-2 py-1 text-left text-xs ring-1 ${teinteMatiere(creneau.code)} ${onClick ? 'cursor-pointer hover:ring-2' : ''}`}
      style={style}
    >
      <span className="block truncate font-semibold">{creneau.matiere}</span>
      <span className="chiffres block opacity-80">
        {creneau.heureDebut}–{creneau.heureFin}
      </span>
      <span className="block truncate opacity-80">
        {legende(creneau, afficherClasse)}
        {creneau.salle && ` · ${creneau.salle}`}
      </span>
    </Element>
  );
}

/** Liste d'une journée (téléphone). */
function Journee({ creneaux, afficherClasse, onCreneau }) {
  if (!creneaux.length)
    return <p className="py-6 text-center text-sm text-slate-500">Pas de cours ce jour.</p>;
  return (
    <ol className="marge-rouge divide-y divide-slate-100 rounded-2xl bg-white py-1 pr-3 pl-10 ring-1 ring-slate-200">
      {creneaux.map((c, i) => {
        const Element = onCreneau ? 'button' : 'div';
        return (
          <li key={c.id} className="ligne-note" style={{ '--delai': `${i * 40}ms` }}>
            <Element
              type={onCreneau ? 'button' : undefined}
              onClick={onCreneau ? () => onCreneau(c) : undefined}
              className="grid w-full grid-cols-[4.5rem_1fr] gap-x-3 py-2.5 text-left"
            >
              <span className="chiffres text-sm text-slate-500">
                {c.heureDebut}
                <span className="block text-xs leading-4 text-slate-400">{c.heureFin}</span>
              </span>
              <span className="min-w-0">
                <span
                  className={`inline-block rounded px-1.5 text-sm font-semibold ring-1 ${teinteMatiere(c.code)}`}
                >
                  {c.matiere}
                </span>
                <span className="mt-1 block truncate text-xs text-slate-500">
                  {legende(c, afficherClasse)}
                  {c.salle && (
                    <span className="ml-1 inline-flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" /> {c.salle}
                    </span>
                  )}
                </span>
              </span>
            </Element>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Emploi du temps de la semaine. Ordinateur : grille lundi-samedi ; téléphone :
 * un jour à la fois (aujourd'hui par défaut). `onCaseVide(jour, heure)` et
 * `onCreneau(creneau)` rendent la grille modifiable.
 */
export default function GrilleEmploiDuTemps({
  creneaux,
  afficherClasse = false,
  onCreneau,
  onCaseVide,
}) {
  const aujourdhui = jourDe();
  const [jourMobile, setJourMobile] = useState(aujourdhui <= 6 ? aujourdhui : 1);
  const maintenant = new Date();
  const minutesMaintenant = maintenant.getHours() * 60 + maintenant.getMinutes();

  return (
    <>
      {/* Téléphone : onglets des jours */}
      <div className="space-y-3 md:hidden">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Jour">
          {JOURS_COURTS.map((j, i) => (
            <button
              key={j}
              type="button"
              role="tab"
              aria-selected={jourMobile === i + 1}
              onClick={() => setJourMobile(i + 1)}
              className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition ${
                jourMobile === i + 1 ? 'bg-white shadow-md' : 'text-slate-600'
              } ${i + 1 === aujourdhui ? 'underline decoration-rouge decoration-2 underline-offset-4' : ''}`}
            >
              {j}
            </button>
          ))}
        </div>
        <Journee
          key={jourMobile}
          creneaux={creneaux.filter((c) => c.jour === jourMobile)}
          afficherClasse={afficherClasse}
          onCreneau={onCreneau}
        />
        {onCaseVide && (
          <button
            type="button"
            onClick={() => onCaseVide(jourMobile, '08:00')}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-marque-700 border border-dashed border-slate-300"
          >
            <Plus className="h-4 w-4" /> Ajouter un cours le {JOURS[jourMobile - 1].toLowerCase()}
          </button>
        )}
      </div>

      {/* Ordinateur : semaine complète */}
      <div className="hidden overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 md:block">
        <div className="grid grid-cols-[3.5rem_repeat(6,1fr)] border-b-2 border-slate-900">
          <span />
          {JOURS.map((j, i) => (
            <span
              key={j}
              className={`px-2 py-2 text-sm font-semibold ${i + 1 === aujourdhui ? 'text-rouge' : ''}`}
            >
              {j}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-[3.5rem_repeat(6,1fr)]">
          <div className="relative" style={{ height: HEURES.length * HAUTEUR_HEURE }}>
            {HEURES.map((m, i) => (
              <span
                key={m}
                className="chiffres absolute right-2 -translate-y-1/2 text-xs text-slate-400"
                style={{ top: i * HAUTEUR_HEURE }}
              >
                {i ? heureLisible(enHeure(m)) : ''}
              </span>
            ))}
          </div>
          {JOURS.map((j, i) => {
            const jour = i + 1;
            return (
              <div
                key={j}
                className="relative border-l border-slate-100"
                style={{ height: HEURES.length * HAUTEUR_HEURE }}
              >
                {/* Lignes réglées : une par heure, cliquables pour ajouter un cours */}
                {HEURES.map((m, k) =>
                  onCaseVide ? (
                    <button
                      key={m}
                      type="button"
                      aria-label={`Ajouter un cours le ${j.toLowerCase()} à ${heureLisible(enHeure(m))}`}
                      onClick={() => onCaseVide(jour, enHeure(m))}
                      className="absolute inset-x-0 border-t border-reglure hover:bg-marque-50/60"
                      style={{ top: k * HAUTEUR_HEURE, height: HAUTEUR_HEURE }}
                    />
                  ) : (
                    <span
                      key={m}
                      className="absolute inset-x-0 border-t border-reglure"
                      style={{ top: k * HAUTEUR_HEURE }}
                    />
                  ),
                )}
                {creneaux
                  .filter((c) => c.jour === jour)
                  .map((c, k) => (
                    <Bloc
                      key={c.id}
                      creneau={c}
                      index={k + i * 2}
                      afficherClasse={afficherClasse}
                      onClick={onCreneau}
                    />
                  ))}
                {/* Heure actuelle : trait rouge de la marge du cahier */}
                {jour === aujourdhui &&
                  minutesMaintenant > DEBUT_JOURNEE &&
                  minutesMaintenant < FIN_JOURNEE && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-rouge"
                      style={{ top: ((minutesMaintenant - DEBUT_JOURNEE) / 60) * HAUTEUR_HEURE }}
                    />
                  )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
