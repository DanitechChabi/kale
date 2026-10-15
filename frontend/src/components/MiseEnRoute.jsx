import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { useRequete } from '../hooks/useRequete.js';

/** Étapes de démarrage d'un établissement vérifié, cochées au fil de l'avancement. */
export default function MiseEnRoute() {
  const annees = useRequete('/annees');
  const classes = useRequete('/classes');
  const eleves = useRequete('/eleves?parPage=1');
  const enseignants = useRequete('/utilisateurs?role=ENSEIGNANT');

  const etapes = [
    ['Créer l’année scolaire', '/espace/annee', annees.donnees?.annees.some((a) => a.estCourante)],
    ['Créer les classes', '/espace/classes', classes.donnees?.classes.length > 0],
    ['Importer la liste des élèves', '/espace/import', eleves.donnees?.total > 0],
    [
      'Créer les comptes des enseignants',
      '/espace/comptes',
      enseignants.donnees?.comptes.length > 0,
    ],
  ];
  const faites = etapes.filter(([, , fait]) => fait).length;
  if (faites === etapes.length) return null;

  return (
    <section
      className="entree rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
      style={{ '--delai': '60ms' }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Mise en route de l’établissement</h2>
        <span className="text-sm font-semibold text-marque-700 tabular-nums">
          {faites}/{etapes.length}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full origin-left rounded-full bg-marque-500 transition-transform duration-700"
          style={{ transform: `scaleX(${faites / etapes.length})` }}
        />
      </div>
      <ol className="mt-4 space-y-1">
        {etapes.map(([libelle, vers, fait], i) => (
          <li key={vers}>
            <Link
              to={vers}
              className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${fait ? 'text-slate-400' : 'font-medium hover:bg-marque-50'}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  fait ? 'bg-marque-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {fait ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={`flex-1 ${fait ? 'line-through' : ''}`}>{libelle}</span>
              {!fait && <ArrowRight className="h-4 w-4 text-marque-600" />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
