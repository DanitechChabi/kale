import { Link, Outlet } from 'react-router-dom';

// Mise en page commune : en-tête, contenu, pied de page (mobile d'abord).
export default function Gabarit() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-vert text-white shadow">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <Link to="/" className="text-lg font-bold tracking-tight">
            EduRelevé
          </Link>
        </div>
        {/* Bandeau aux couleurs nationales */}
        <div className="flex h-1">
          <div className="flex-1 bg-vert-fonce" />
          <div className="flex-1 bg-jaune" />
          <div className="flex-1 bg-rouge" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-gray-200 bg-white px-4 py-4 text-center text-xs text-gray-500">
        EduRelevé — Prototype pour le Prix national de la simplification administrative
      </footer>
    </div>
  );
}
