import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/** En-tête de page de l'espace : retour éventuel, surtitre, titre, actions. */
export default function EnTetePage({ retour, surtitre, titre, description, actions }) {
  return (
    <div className="entree space-y-3">
      {retour && (
        <Link
          to={retour.vers}
          className="inline-flex items-center gap-1 text-sm font-semibold text-marque-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> {retour.libelle}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {surtitre && <p className="text-sm font-medium text-marque-700">{surtitre}</p>}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{titre}</h1>
          {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
