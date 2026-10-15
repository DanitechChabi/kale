import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

const STYLES = {
  erreur: ['bg-red-50 text-red-800 ring-red-200', CircleAlert],
  succes: ['bg-marque-50 text-marque-800 ring-marque-200', CircleCheck],
  attention: ['bg-amber-50 text-amber-900 ring-amber-200', TriangleAlert],
  info: ['bg-sky-50 text-sky-900 ring-sky-200', Info],
};

export default function Alerte({ type = 'info', titre, children, className = '' }) {
  const [classes, Icone] = STYLES[type];
  return (
    <div
      className={`entree flex gap-3 rounded-xl p-4 text-sm ring-1 ${classes} ${className}`}
      role={type === 'erreur' ? 'alert' : 'status'}
    >
      <Icone className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        {titre && <p className="font-semibold">{titre}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
