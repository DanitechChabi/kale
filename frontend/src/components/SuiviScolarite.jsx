import { useState } from 'react';
import { ChevronDown, ExternalLink, FileText } from 'lucide-react';
import Alerte from './ui/Alerte.jsx';
import { formaterDate } from '../lib/navigation.js';
import {
  LIBELLES_EVALUATIONS,
  formaterNote,
  formaterRang,
  libellePeriode,
  periodeParDefaut,
} from '../lib/notes.js';
import { lienVerification, ouvrirPdf, titreDocument } from '../lib/releves.js';

const couleur = (m) => (m === null ? 'text-slate-400' : m < 10 ? 'text-rouge' : 'text-slate-900');

/** Ligne d'une matière : moyenne, repère de la classe, notes en dépliant. */
function LigneMatiere({ matiere, index }) {
  const [ouvert, setOuvert] = useState(false);
  const pourcentage = (v) => `${Math.max(0, Math.min(100, (v / 20) * 100))}%`;
  return (
    <li className="ligne-note" style={{ '--delai': `${Math.min(index, 20) * 30}ms` }}>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-x-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">
            {matiere.matiere}
            {matiere.estFacultative && (
              <span className="ml-1.5 text-xs font-semibold text-sceau">facultative</span>
            )}
          </span>
          {/* Jauge : moyenne de l'élève, trait = moyenne de la classe */}
          <span className="relative mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100">
            {matiere.moyenne !== null && (
              <span
                className={`jauge absolute inset-y-0 left-0 w-full origin-left rounded-full ${
                  matiere.moyenne < 10 ? 'bg-rouge/70' : 'bg-marque-500'
                }`}
                style={{
                  '--echelle': matiere.moyenne / 20,
                  '--delai': `${Math.min(index, 20) * 30 + 200}ms`,
                }}
              />
            )}
            {matiere.moyenneClasse !== null && (
              <span
                className="absolute inset-y-0 w-0.5 bg-encre"
                style={{ left: pourcentage(matiere.moyenneClasse) }}
                title={`Moyenne de la classe : ${formaterNote(matiere.moyenneClasse)}`}
              />
            )}
          </span>
        </span>
        <span className="chiffres text-xs text-slate-400">×{matiere.coefficient}</span>
        <span className="flex items-center gap-2">
          <span
            className={`chiffres w-12 text-right text-lg font-semibold ${couleur(matiere.moyenne)}`}
          >
            {formaterNote(matiere.moyenne)}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${ouvert ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      {ouvert && (
        <div className="entree cahier marge-rouge py-1 pr-4 pl-10 text-sm">
          {matiere.notes.length ? (
            <ul>
              {matiere.notes.map((n, i) => (
                <li key={i} className="flex h-7 items-center justify-between gap-3">
                  <span className="truncate text-slate-600">
                    {n.libelle || LIBELLES_EVALUATIONS[n.type]} · {formaterDate(n.date)}
                  </span>
                  <span
                    className={`chiffres shrink-0 font-semibold whitespace-nowrap ${couleur(n.surVingt)}`}
                  >
                    {n.absent ? 'Absent' : `${formaterNote(n.valeur)} / ${n.bareme}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="leading-7 text-slate-500">Aucune note pour le moment.</p>
          )}
          <p className="leading-7 text-slate-500">
            Moyenne de la classe :{' '}
            <span className="chiffres">{formaterNote(matiere.moyenneClasse)}</span>
          </p>
        </div>
      )}
    </li>
  );
}

function Absences({ absences }) {
  if (!absences.length) {
    return <p className="text-sm text-slate-500">Aucune absence ni retard cette année.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {absences.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
          <span className="chiffres w-24 text-slate-500">{formaterDate(a.date)}</span>
          <span className="chiffres text-slate-500">{a.heureDebut}</span>
          <span className="min-w-0 flex-1 font-medium">
            {a.statut === 'RETARD'
              ? `Retard${a.minutesRetard ? ` de ${a.minutesRetard} min` : ''}`
              : 'Absence'}
            {a.matiere && <span className="font-normal text-slate-500"> · {a.matiere}</span>}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              a.justifiee ? 'bg-marque-50 text-marque-700' : 'bg-red-50 text-rouge'
            }`}
            title={a.motif ?? undefined}
          >
            {a.justifiee ? 'Justifiée' : 'Non justifiée'}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Suivi d'un élève : moyennes par période, notes, absences et documents.
 * `cheminPdf(document)` : adresse API du PDF selon l'espace (parent ou élève).
 */
export default function SuiviScolarite({ suivi, cheminPdf }) {
  const periodeDefaut = periodeParDefaut(
    suivi.periodes.map((p) => ({ ...p, estCloturee: p.estCloturee })),
  );
  const [periodeId, setPeriodeId] = useState(periodeDefaut?.id ?? null);
  const periode = suivi.periodes.find((p) => p.id === periodeId);

  if (!suivi.classe) {
    return <Alerte type="info">Aucune inscription en cours pour cet élève.</Alerte>;
  }

  return (
    <div className="space-y-8">
      {suivi.periodes.length > 0 && (
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Période">
          {suivi.periodes.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === periodeId}
              onClick={() => setPeriodeId(p.id)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition ${
                p.id === periodeId ? 'bg-white text-slate-900 shadow-md' : 'text-slate-600'
              }`}
            >
              {libellePeriode(p)}
            </button>
          ))}
        </div>
      )}

      {periode && (
        <section key={periode.id} className="space-y-4">
          <div className="entree grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-slate-200 ring-1 ring-slate-200">
            <div className="bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Moyenne générale</p>
              <p className={`chiffres text-3xl font-semibold ${couleur(periode.moyenneGenerale)}`}>
                {formaterNote(periode.moyenneGenerale)}
              </p>
            </div>
            <div className="bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Rang</p>
              <p className="chiffres text-xl font-semibold">
                {periode.estCloturee ? formaterRang(periode.rang, periode.exAequo) : '–'}
              </p>
              <p className="text-xs text-slate-500">
                {periode.estCloturee ? `sur ${periode.effectif}` : 'à la clôture'}
              </p>
            </div>
            <div className="bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Moyenne de la classe</p>
              <p className="chiffres text-xl font-semibold">
                {formaterNote(periode.moyenneClasse)}
              </p>
            </div>
          </div>
          {!periode.estCloturee && (
            <p className="text-sm text-slate-500">
              Période en cours : les moyennes évoluent à chaque nouvelle note.
            </p>
          )}
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {periode.matieres.map((m, i) => (
              <LigneMatiere key={m.matiere} matiere={m} index={i} />
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="etiquette border-b-2 border-slate-900 pb-2">Absences et retards</h2>
        <Absences absences={suivi.absences} />
      </section>

      <section className="space-y-3">
        <h2 className="etiquette border-b-2 border-slate-900 pb-2">Bulletins et relevés</h2>
        {suivi.documents.length ? (
          <ul className="divide-y divide-slate-100">
            {suivi.documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{titreDocument(d)}</span> · {d.anneeScolaire}
                  {d.remplacePar && (
                    <span className="ml-2 text-xs font-semibold text-sceau">remplacé</span>
                  )}
                </span>
                <span className="chiffres font-semibold">{formaterNote(d.moyenneGenerale)}</span>
                <button
                  type="button"
                  onClick={() => ouvrirPdf(cheminPdf(d))}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-marque-700"
                  aria-label={`Ouvrir le document ${d.numeroAffiche}`}
                >
                  <FileText className="h-4 w-4" />
                </button>
                <a
                  href={lienVerification(d.numeroAffiche)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-marque-700"
                  aria-label={`Vérification du document ${d.numeroAffiche}`}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            Aucun document délivré pour le moment. Les bulletins arrivent après chaque conseil de
            classe.
          </p>
        )}
      </section>
    </div>
  );
}
