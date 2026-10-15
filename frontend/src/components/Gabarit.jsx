import { Link, Outlet } from 'react-router-dom';
import Logo from './Logo.jsx';

// Mise en page commune : en-tête, contenu, pied de page (mobile d'abord).
export default function Gabarit() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="EduRelevé — accueil">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex">
            <a href="/#espaces" className="hover:text-marque-600">
              Espaces
            </a>
            <a href="/#fonctionnement" className="hover:text-marque-600">
              Fonctionnement
            </a>
          </nav>
        </div>
        {/* Liseré aux couleurs nationales */}
        <div className="flex h-[3px]" aria-hidden="true">
          <div className="flex-1 bg-marque-500" />
          <div className="flex-1 bg-or" />
          <div className="flex-1 bg-rouge" />
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="space-y-1">
            <Logo taille="h-7 w-7" texte="text-base" />
            <p className="text-sm text-slate-500">
              Gestion scolaire et relevés de notes vérifiables.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} EduRelevé. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
