import { LoaderCircle } from 'lucide-react';

export default function Chargement({ texte = 'Chargement…', plein = false }) {
  return (
    <div
      className={`flex items-center justify-center gap-2 text-sm text-slate-500 ${plein ? 'min-h-[50dvh]' : 'py-10'}`}
      role="status"
    >
      <LoaderCircle className="h-5 w-5 animate-spin text-marque-600" aria-hidden="true" />
      {texte}
    </div>
  );
}
