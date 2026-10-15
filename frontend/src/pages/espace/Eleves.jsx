import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, FileSpreadsheet, Search, UserPlus } from 'lucide-react';
import Apparition from '../../components/animation/Apparition.jsx';
import EnTetePage from '../../components/EnTetePage.jsx';
import FormulaireEleve from '../../components/FormulaireEleve.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import Dialogue from '../../components/ui/Dialogue.jsx';
import { useAuth } from '../../contexte/Auth.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { age, formaterIdentifiant } from '../../lib/scolarite.js';

export default function Eleves() {
  const { utilisateur } = useAuth();
  const naviguer = useNavigate();
  const [parametres, setParametres] = useSearchParams();
  const [saisie, setSaisie] = useState(parametres.get('recherche') ?? '');
  const recherche = parametres.get('recherche') ?? '';
  const classeId = parametres.get('classe') ?? '';
  const page = Number(parametres.get('page') ?? 1);
  const gestion = ['ADMIN_ECOLE', 'SECRETARIAT'].includes(utilisateur.role);
  const [creation, setCreation] = useState(parametres.get('nouveau') === '1');

  useEffect(() => {
    const minuteur = setTimeout(() => {
      if (saisie === recherche) return;
      setParametres(
        (p) => {
          const suivant = new URLSearchParams(p);
          if (saisie) suivant.set('recherche', saisie);
          else suivant.delete('recherche');
          suivant.delete('page');
          return suivant;
        },
        { replace: true },
      );
    }, 350);
    return () => clearTimeout(minuteur);
  }, [saisie, recherche, setParametres]);

  const requete = new URLSearchParams({
    page: String(page),
    parPage: '50',
    ...(recherche && { recherche }),
    ...(classeId === 'aucune' ? { sansClasse: 'true' } : classeId ? { classeId } : {}),
  });
  const { donnees, erreur, chargement } = useRequete(`/eleves?${requete}`);
  const { donnees: listeClasses } = useRequete('/classes');
  const classes = listeClasses?.classes ?? [];
  const pages = donnees ? Math.max(1, Math.ceil(donnees.total / donnees.parPage)) : 1;

  const changerClasse = (valeur) =>
    setParametres((p) => {
      const suivant = new URLSearchParams(p);
      if (valeur) suivant.set('classe', valeur);
      else suivant.delete('classe');
      suivant.delete('page');
      return suivant;
    });

  return (
    <div className="space-y-6">
      <EnTetePage
        surtitre="Scolarité"
        titre="Élèves"
        description={donnees ? `${donnees.total} élève${donnees.total > 1 ? 's' : ''}` : undefined}
        actions={
          gestion && (
            <>
              <Link
                to="/espace/import"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"
              >
                <FileSpreadsheet className="h-4 w-4" /> Importer une liste
              </Link>
              <Bouton icone={UserPlus} onClick={() => setCreation(true)}>
                Nouvel élève
              </Bouton>
            </>
          )
        }
      />

      <div className="entree flex flex-col gap-3 sm:flex-row" style={{ '--delai': '80ms' }}>
        <label className="relative block flex-1">
          <span className="sr-only">Rechercher un élève</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Nom, prénoms, matricule ou identifiant"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-base focus:border-marque-500 focus:ring-2 focus:ring-marque-500/20 focus:outline-none sm:text-sm"
          />
        </label>
        <select
          aria-label="Filtrer par classe"
          value={classeId}
          onChange={(e) => changerClasse(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base sm:w-52 sm:text-sm"
        >
          <option value="">Toutes les classes</option>
          <option value="aucune">Sans classe cette année</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
      </div>

      {erreur && <Alerte type="erreur">{erreur.message}</Alerte>}
      {chargement && <Chargement />}
      {donnees && !donnees.eleves.length && (
        <div className="entree rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          {recherche || classeId
            ? 'Aucun élève ne correspond à ces critères.'
            : 'Aucun élève enregistré. Importez votre liste Excel pour commencer.'}
        </div>
      )}
      {donnees?.eleves.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {donnees.eleves.map((e, i) => (
            <Apparition as="li" key={e.id} delai={Math.min(i, 10) * 25}>
              <Link
                to={`/espace/eleves/${e.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-marque-50/40"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    e.sexe === 'F' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'
                  }`}
                  aria-hidden="true"
                >
                  {e.prenoms[0]}
                  {e.nom[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <span className="font-semibold">{e.nom}</span> {e.prenoms}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {e.inscription?.classe.nom ?? 'Sans classe'} · {age(e.dateNaissance)} ans ·{' '}
                    {e.matricule} ·{' '}
                    <span className="font-mono">{formaterIdentifiant(e.identifiant)}</span>
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </Link>
            </Apparition>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Pages">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() =>
                setParametres(
                  (p) => new URLSearchParams({ ...Object.fromEntries(p), page: String(n) }),
                )
              }
              aria-current={n === page ? 'page' : undefined}
              className={`h-9 min-w-9 rounded-lg px-2 text-sm font-semibold ${n === page ? 'bg-marque-600 text-white' : 'bg-white ring-1 ring-slate-200'}`}
            >
              {n}
            </button>
          ))}
        </nav>
      )}

      <Dialogue ouvert={creation} onFermer={() => setCreation(false)} titre="Nouvel élève" large>
        <FormulaireEleve
          classes={classes}
          onEnregistre={(eleve) => naviguer(`/espace/eleves/${eleve.id}`)}
        />
      </Dialogue>
    </div>
  );
}
