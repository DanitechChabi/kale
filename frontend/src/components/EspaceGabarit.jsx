import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChartColumn,
  ChevronDown,
  FileCheck2,
  GraduationCap,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  PenLine,
  ScrollText,
  School,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { LIBELLES_ROLES, useAuth } from '../contexte/Auth.jsx';
import EtatSynchronisation from './EtatSynchronisation.jsx';
import Logo from './Logo.jsx';

// Entrées de navigation selon le rôle
const ECOLE = ['ADMIN_ECOLE', 'SECRETARIAT', 'ENSEIGNANT'];
const NAVIGATION = [
  { vers: '/espace', libelle: 'Accueil', icone: LayoutDashboard, fin: true },
  {
    vers: '/espace/notes',
    libelle: 'Notes',
    icone: PenLine,
    roles: ['ADMIN_ECOLE', 'ENSEIGNANT'],
    verifiee: true,
  },
  { vers: '/espace/classes', libelle: 'Classes', icone: School, roles: ECOLE, verifiee: true },
  { vers: '/espace/eleves', libelle: 'Élèves', icone: GraduationCap, roles: ECOLE, verifiee: true },
  {
    vers: '/espace/resultats',
    libelle: 'Résultats',
    icone: ChartColumn,
    roles: ECOLE,
    verifiee: true,
  },
  {
    vers: '/espace/bulletins',
    libelle: 'Bulletins',
    icone: ScrollText,
    roles: ['ADMIN_ECOLE', 'SECRETARIAT'],
    verifiee: true,
  },
  {
    vers: '/espace/duplicatas',
    libelle: 'Duplicatas',
    icone: Inbox,
    roles: ['ADMIN_ECOLE', 'SECRETARIAT'],
    verifiee: true,
  },
  {
    vers: '/espace/mes-documents',
    libelle: 'Mes bulletins',
    icone: ScrollText,
    roles: ['ELEVE'],
  },
  {
    vers: '/espace/dossier',
    libelle: 'Dossier',
    icone: FileCheck2,
    roles: ['ADMIN_ECOLE'],
    nonVerifiee: true,
  },
  {
    vers: '/espace/verification',
    libelle: 'Vérification des établissements',
    icone: ShieldCheck,
    roles: ['SUPER_ADMIN', 'MINISTERE'],
  },
];

// Pages d'administration de l'établissement, rangées dans le menu du compte
const MENU_ETABLISSEMENT = [
  { vers: '/espace/comptes', libelle: 'Comptes', icone: UsersRound },
  { vers: '/espace/annee', libelle: 'Année scolaire', icone: CalendarDays },
  { vers: '/espace/dossier', libelle: 'Dossier de vérification', icone: FileCheck2 },
];

function MenuCompte() {
  const { utilisateur, deconnexion } = useAuth();
  const naviguer = useNavigate();
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!ouvert) return undefined;
    const fermer = (e) => !ref.current?.contains(e.target) && setOuvert(false);
    const echap = (e) => e.key === 'Escape' && setOuvert(false);
    document.addEventListener('pointerdown', fermer);
    document.addEventListener('keydown', echap);
    return () => {
      document.removeEventListener('pointerdown', fermer);
      document.removeEventListener('keydown', echap);
    };
  }, [ouvert]);

  const initiales = `${utilisateur.prenoms[0] ?? ''}${utilisateur.nom[0] ?? ''}`.toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 hover:bg-slate-100"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-marque-600 text-xs font-bold text-white">
          {initiales}
        </span>
        <span className="hidden text-left text-sm leading-tight sm:block lg:hidden">
          <span className="block font-semibold text-slate-900">
            {utilisateur.prenoms} {utilisateur.nom}
          </span>
          <span className="block text-xs text-slate-500">{LIBELLES_ROLES[utilisateur.role]}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-500 transition-transform ${ouvert ? 'rotate-180' : ''}`}
        />
      </button>
      {ouvert && (
        <div
          role="menu"
          className="entree absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200"
          style={{ '--delai': '0ms' }}
        >
          <div className="border-b border-slate-100 px-4 py-3 text-sm">
            <p className="font-semibold">
              {utilisateur.prenoms} {utilisateur.nom}
            </p>
            <p className="text-slate-500">
              {utilisateur.ecole?.nom ?? LIBELLES_ROLES[utilisateur.role]}
            </p>
          </div>
          {utilisateur.role === 'ADMIN_ECOLE' &&
            utilisateur.ecole?.statutVerification === 'VERIFIEE' && (
              <div className="border-b border-slate-100 py-1">
                {MENU_ETABLISSEMENT.map(({ vers, libelle, icone: Icone }) => (
                  <Link
                    key={vers}
                    to={vers}
                    role="menuitem"
                    onClick={() => setOuvert(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50"
                  >
                    <Icone className="h-4 w-4 text-slate-500" /> {libelle}
                  </Link>
                ))}
              </div>
            )}
          <Link
            to="/espace/mot-de-passe"
            role="menuitem"
            onClick={() => setOuvert(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50"
          >
            <KeyRound className="h-4 w-4 text-slate-500" /> Changer de mot de passe
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              await deconnexion();
              naviguer('/connexion', { replace: true });
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-rouge hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

/** Mise en page de l'espace connecté. */
export default function EspaceGabarit() {
  const { utilisateur } = useAuth();
  const ecoleVerifiee = utilisateur.ecole?.statutVerification === 'VERIFIEE';
  const liens = NAVIGATION.filter(
    (l) =>
      (!l.roles || l.roles.includes(utilisateur.role)) &&
      (!l.verifiee || ecoleVerifiee) &&
      (!l.nonVerifiee || !ecoleVerifiee),
  );

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/espace" aria-label="EduRelevé — tableau de bord">
            <Logo />
          </Link>
          {!utilisateur.doitChangerMotDePasse && (
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
              {liens.map(({ vers, libelle, icone: Icone, fin }) => (
                <NavLink
                  key={vers}
                  to={vers}
                  end={fin}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-marque-50 text-marque-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  <Icone className="h-4 w-4" /> {libelle}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="flex items-center gap-2">
            <EtatSynchronisation />
            <MenuCompte />
          </div>
        </div>
        {/* Navigation mobile : onglets défilants */}
        {!utilisateur.doitChangerMotDePasse && liens.length > 1 && (
          <nav
            className="flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden"
            aria-label="Navigation principale"
          >
            {liens.map(({ vers, libelle, icone: Icone, fin }) => (
              <NavLink
                key={vers}
                to={vers}
                end={fin}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    isActive ? 'bg-marque-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`
                }
              >
                <Icone className="h-3.5 w-3.5" /> {libelle}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
