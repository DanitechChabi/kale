import { LoaderCircle } from 'lucide-react';

const VARIANTES = {
  principal:
    'bg-marque-600 text-white shadow-sm hover:bg-marque-700 focus-visible:outline-marque-600 disabled:bg-marque-600/60',
  secondaire:
    'bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-marque-600 disabled:text-slate-400',
  danger: 'bg-rouge text-white hover:bg-red-700 focus-visible:outline-rouge disabled:bg-rouge/60',
  discret: 'text-marque-700 hover:bg-marque-50 focus-visible:outline-marque-600',
};

/** Bouton de l'application. `chargement` désactive le bouton et affiche une roue. */
export default function Bouton({
  variante = 'principal',
  chargement = false,
  icone: Icone,
  className = '',
  children,
  disabled,
  type = 'button',
  ...reste
}) {
  return (
    <button
      type={type}
      disabled={disabled || chargement}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTES[variante]} ${className}`}
      {...reste}
    >
      {chargement ? (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icone && <Icone className="h-4 w-4" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
