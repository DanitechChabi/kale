import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, UserCheck } from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import Onglets from '../../components/ui/Onglets.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { formaterDate } from '../../lib/navigation.js';
import { LIBELLES_TYPES_DOCUMENT, STATUTS_DEMANDE } from '../../lib/releves.js';

const ONGLETS = [
  ['EN_ATTENTE', 'À traiter'],
  ['EN_COURS', 'En cours'],
  ['DELIVREE', 'Délivrées'],
  ['REJETEE', 'Rejetées'],
];

/** Délai écoulé depuis la demande, en jours (indicateur suivi par le ministère). */
const joursDepuis = (date) => Math.floor((Date.now() - new Date(date)) / 86_400_000);

export default function Duplicatas() {
  const [parametres, setParametres] = useSearchParams();
  const statut = parametres.get('statut') ?? 'EN_ATTENTE';
  const { donnees, erreur, chargement } = useRequete(`/duplicatas?statut=${statut}`);
  const compteurs = donnees?.compteurs ?? {};

  return (
    <div className="space-y-6">
      <EnTetePage
        retour={{ vers: '/espace/bulletins', libelle: 'Bulletins et relevés' }}
        titre="Demandes de duplicata"
        description="Déposées en ligne par d’anciens élèves ou leurs parents. Retrouvez le document archivé et délivrez-le : le demandeur le télécharge sans se déplacer."
      />
      <Onglets
        onglets={ONGLETS.map(([valeur, libelle]) => [valeur, libelle, compteurs[valeur] ?? 0])}
        actif={statut}
        onChange={(valeur) => setParametres({ statut: valeur }, { replace: true })}
      />

      {erreur && <Alerte type="erreur">{erreur.message}</Alerte>}
      {chargement && <Chargement />}
      {donnees &&
        (donnees.demandes.length ? (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {donnees.demandes.map((d, i) => {
              const attente = joursDepuis(d.demandeLe);
              return (
                <li
                  key={d.id}
                  className="ligne-note"
                  style={{ '--delai': `${Math.min(i, 20) * 25}ms` }}
                >
                  <Link
                    to={`/espace/duplicatas/${d.id}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50 sm:grid-cols-[1fr_12rem_9rem_auto]"
                  >
                    <div className="min-w-0">
                      <p className="truncate">
                        <span className="font-semibold">{d.nomEleve}</span> {d.prenomsEleve}
                      </p>
                      <p className="text-xs text-slate-500">
                        {LIBELLES_TYPES_DOCUMENT[d.typeDocument]}
                        {d.numeroPeriode ? ` · période ${d.numeroPeriode}` : ''} · {d.libelleAnnee}
                      </p>
                    </div>
                    <div className="hidden text-sm sm:block">
                      <p className="chiffres text-slate-700">{d.numeroSuivi}</p>
                      {d.eleveIdentifie && (
                        <p className="flex items-center gap-1 text-xs font-semibold text-marque-700">
                          <UserCheck className="h-3.5 w-3.5" /> Élève identifié
                        </p>
                      )}
                    </div>
                    <div className="hidden text-sm text-slate-500 sm:block">
                      {['EN_ATTENTE', 'EN_COURS'].includes(d.statut) ? (
                        <span className={attente >= 7 ? 'font-semibold text-rouge' : ''}>
                          {attente === 0 ? 'Aujourd’hui' : `Il y a ${attente} j`}
                        </span>
                      ) : (
                        formaterDate(d.clotureLe)
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge statut={d.statut} table={STATUTS_DEMANDE} />
                      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <Alerte type="info">Aucune demande dans cette catégorie.</Alerte>
        ))}
    </div>
  );
}
