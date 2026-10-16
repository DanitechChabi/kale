import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../contexte/Auth.jsx';
import LienAncre from './LienAncre.jsx';
import Logo from './Logo.jsx';

// Mise en page commune : en-tête, contenu, pied de page (mobile d'abord).
export default function Gabarit() {
  const { statut } = useAuth();
  // L'en-tête prend une ombre dès que la page défile
  const [defile, setDefile] = useState(false);
  useEffect(() => {
    const surDefilement = () => setDefile(window.scrollY > 8);
    surDefilement();
    window.addEventListener('scroll', surDefilement, { passive: true });
    return () => window.removeEventListener('scroll', surDefilement);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className={`sticky top-0 z-20 bg-white/85 backdrop-blur-md transition-shadow duration-300 ${
          defile ? 'shadow-[0_8px_30px_-12px_rgb(6_95_51/0.25)]' : ''
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="EduRelevé — accueil" className="entree">
            <Logo anime />
          </Link>
          <nav className="hidden items-center gap-1 text-sm font-medium text-slate-600 md:flex">
            {[
              ['verifier', 'Vérifier un document'],
              ['espaces', 'Espaces'],
              ['fonctionnement', 'Fonctionnement'],
            ].map(([lien, libelle], i) => (
              <LienAncre
                key={lien}
                cible={lien}
                className="entree group relative rounded-lg px-3 py-2 transition-colors hover:text-marque-700"
                style={{ '--delai': `${200 + i * 80}ms` }}
              >
                {libelle}
                {/* Soulignement qui se déploie au survol */}
                <span className="absolute inset-x-3 bottom-1 h-0.5 origin-left scale-x-0 rounded-full bg-marque-500 transition-transform duration-300 group-hover:scale-x-100" />
              </LienAncre>
            ))}
          </nav>
          <div className="entree flex items-center gap-2" style={{ '--delai': '360ms' }}>
            {statut === 'connecte' ? (
              <Link
                to="/espace"
                className="rounded-lg bg-marque-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-marque-700"
              >
                Mon espace
              </Link>
            ) : (
              <>
                <Link
                  to="/inscription-ecole"
                  className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-marque-700 transition hover:bg-marque-50 lg:block"
                >
                  Inscrire mon établissement
                </Link>
                <Link
                  to="/connexion"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-marque-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-marque-700"
                >
                  <LogIn className="h-4 w-4" /> Connexion
                </Link>
              </>
            )}
          </div>
        </div>
        {/* Liseré aux couleurs nationales, déployé au chargement */}
        <div className="flex h-[3px]" aria-hidden="true">
          <div className="lisere flex-1 bg-marque-500" style={{ '--delai': '100ms' }} />
          <div className="lisere flex-1 bg-or" style={{ '--delai': '250ms' }} />
          <div className="lisere flex-1 bg-rouge" style={{ '--delai': '400ms' }} />
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t-2 border-slate-900 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="space-y-1">
            <Logo taille="h-7 w-7" texte="text-base" />
            <p className="text-sm text-slate-500">
              Gestion scolaire et relevés de notes vérifiables.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-slate-600">
            <a href="/verifier" className="hover:text-marque-700">
              Vérifier un document
            </a>
            <Link to="/educourses" className="hover:text-marque-700">
              EduCourses
            </Link>
            <Link to="/duplicata" className="hover:text-marque-700">
              Demander un duplicata
            </Link>
            <Link to="/duplicata/suivi" className="hover:text-marque-700">
              Suivre une demande
            </Link>
          </nav>
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} EduRelevé. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
