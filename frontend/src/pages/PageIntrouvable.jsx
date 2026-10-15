import { Link } from 'react-router-dom';

export default function PageIntrouvable() {
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-20 text-center">
      <p className="text-sm font-semibold text-marque-600">Erreur 404</p>
      <h1 className="text-2xl font-bold tracking-tight">Page introuvable</h1>
      <p className="text-slate-600">La page demandée n’existe pas ou a été déplacée.</p>
      <Link
        to="/"
        className="inline-block rounded-lg bg-marque-600 px-5 py-3 text-sm font-semibold text-white hover:bg-marque-700"
      >
        Retour à l’accueil
      </Link>
    </div>
  );
}
