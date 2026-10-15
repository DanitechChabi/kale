import { Link } from 'react-router-dom';

export default function PageIntrouvable() {
  return (
    <div className="space-y-3 py-10 text-center">
      <h1 className="text-xl font-bold">Page introuvable</h1>
      <p className="text-gray-600">La page demandée n’existe pas.</p>
      <Link to="/" className="inline-block rounded-lg bg-vert px-4 py-2 font-medium text-white">
        Retour à l’accueil
      </Link>
    </div>
  );
}
