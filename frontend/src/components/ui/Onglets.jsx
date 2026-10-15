/** Onglets simples ; `onglets` : [[valeur, libellé, compteur?]] */
export default function Onglets({ onglets, actif, onChange, className = '' }) {
  return (
    <div
      className={`-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0 ${className}`}
      role="tablist"
    >
      {onglets.map(([valeur, libelle, compteur]) => {
        const selectionne = valeur === actif;
        return (
          <button
            key={valeur}
            type="button"
            role="tab"
            aria-selected={selectionne}
            onClick={() => onChange(valeur)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
              selectionne
                ? 'bg-marque-600 text-white shadow-sm'
                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {libelle}
            {compteur !== undefined && (
              <span
                className={`rounded-full px-1.5 text-xs tabular-nums ${selectionne ? 'bg-white/20' : 'bg-slate-100'}`}
              >
                {compteur}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
