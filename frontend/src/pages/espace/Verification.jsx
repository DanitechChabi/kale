import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, FileText, MapPin, Search } from 'lucide-react';
import Apparition from '../../components/animation/Apparition.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Badge, { STATUTS_ECOLE } from '../../components/ui/Badge.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { formaterDate } from '../../lib/navigation.js';

const ONGLETS = [
  ['EN_ATTENTE', 'En attente'],
  ['EN_EXAMEN', 'En examen'],
  ['VERIFIEE', 'Vérifiés'],
  ['REJETEE', 'Rejetés'],
  ['SUSPENDUE', 'Suspendus'],
];

const LIBELLES_TYPES = {
  CEG: 'CEG',
  LYCEE: 'Lycée',
  LYCEE_TECHNIQUE: 'Lycée technique',
  COMPLEXE_SCOLAIRE: 'Complexe scolaire',
};

export default function Verification() {
  const [parametres, setParametres] = useSearchParams();
  const statut = parametres.get('statut') ?? 'EN_ATTENTE';
  const [saisie, setSaisie] = useState(parametres.get('recherche') ?? '');
  const recherche = parametres.get('recherche') ?? '';

  // Recherche appliquée après une courte pause de frappe
  useEffect(() => {
    const minuteur = setTimeout(() => {
      if (saisie === recherche) return;
      setParametres(
        (p) => {
          const suivant = new URLSearchParams(p);
          if (saisie) suivant.set('recherche', saisie);
          else suivant.delete('recherche');
          return suivant;
        },
        { replace: true },
      );
    }, 350);
    return () => clearTimeout(minuteur);
  }, [saisie, recherche, setParametres]);

  const requete = new URLSearchParams({ statut, ...(recherche && { recherche }) });
  const { donnees, erreur, chargement } = useRequete(`/verification/ecoles?${requete}`);

  return (
    <div className="space-y-6">
      <div className="entree">
        <h1 className="text-2xl font-bold tracking-tight">Vérification des établissements</h1>
        <p className="text-sm text-slate-600">
          Examinez les pièces déposées puis validez ou rejetez chaque dossier.
        </p>
      </div>

      <div
        className="entree flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        style={{ '--delai': '80ms' }}
      >
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
          {ONGLETS.map(([valeur, libelle]) => {
            const actif = valeur === statut;
            const nombre = donnees?.compteurs?.[valeur] ?? 0;
            return (
              <button
                key={valeur}
                role="tab"
                aria-selected={actif}
                onClick={() => setParametres({ statut: valeur, ...(recherche && { recherche }) })}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                  actif
                    ? 'bg-marque-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {libelle}
                <span
                  className={`rounded-full px-1.5 text-xs tabular-nums ${actif ? 'bg-white/20' : 'bg-slate-100'}`}
                >
                  {nombre}
                </span>
              </button>
            );
          })}
        </div>
        <label className="relative block sm:w-64">
          <span className="sr-only">Rechercher un établissement</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Nom ou code"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-base focus:border-marque-500 focus:ring-2 focus:ring-marque-500/20 focus:outline-none sm:text-sm"
          />
        </label>
      </div>

      {erreur && <Alerte type="erreur">{erreur.message}</Alerte>}
      {chargement && <Chargement />}
      {donnees && !donnees.ecoles.length && (
        <div className="entree rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Aucun établissement dans cette catégorie{recherche && ` pour « ${recherche} »`}.
        </div>
      )}
      {donnees && donnees.ecoles.length > 0 && (
        <ul className="space-y-3">
          {donnees.ecoles.map((ecole, i) => (
            <Apparition as="li" key={ecole.id} delai={Math.min(i, 8) * 50}>
              <Link
                to={`/espace/verification/${ecole.id}`}
                className="group flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-marque-200"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{ecole.nom}</p>
                    <Badge statut={ecole.statutVerification} table={STATUTS_ECOLE} />
                  </div>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span>
                      {LIBELLES_TYPES[ecole.type]} ·{' '}
                      {ecole.statut === 'PUBLIC' ? 'Public' : 'Privé'} · {ecole.code}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {ecole.commune}, {ecole.departement}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" /> {ecole.nombreDocuments} pièce
                      {ecole.nombreDocuments > 1 ? 's' : ''}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400">Déposé le {formaterDate(ecole.creeLe)}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Apparition>
          ))}
        </ul>
      )}
    </div>
  );
}
