import { Lock } from 'lucide-react';
import { libellePeriode } from '../lib/notes.js';

/** Sélecteur de trimestre ou semestre ; une période clôturée porte un cadenas. */
export default function ChoixPeriode({ periodes, valeur, onChange }) {
  return (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Période">
      {periodes.map((p) => {
        const actif = p.id === valeur;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={actif}
            onClick={() => onChange(p.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition ${
              actif ? 'bg-white text-slate-900 shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {libellePeriode(p)}
            {p.estCloturee && <Lock className="h-3.5 w-3.5 text-slate-400" aria-label="clôturé" />}
          </button>
        );
      })}
    </div>
  );
}
