import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import ChoixPeriode from '../../components/ChoixPeriode.jsx';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { useAuth } from '../../contexte/Auth.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { formaterNote, formaterRang, periodeParDefaut } from '../../lib/notes.js';

const couleurMoyenne = (m) =>
  m === null ? 'text-slate-400' : m < 10 ? 'text-rouge' : 'text-slate-900';

function Tableau({ resultats }) {
  const [ouvert, setOuvert] = useState(null);
  const { enseignements, eleves } = resultats;
  return (
    <>
      {/* Ordinateur : registre complet */}
      <div className="hidden overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200 lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-900 text-left align-bottom">
              <th className="sticky left-0 bg-white px-3 py-2 font-semibold">Élève</th>
              {enseignements.map((e) => (
                <th
                  key={e.id}
                  className="px-2 py-2 text-right text-xs font-semibold text-slate-600"
                  title={e.matiere}
                >
                  {e.code}
                  <span className="chiffres block font-normal text-slate-400">
                    ×{e.coefficient}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Moy.</th>
              <th className="px-3 py-2 text-right font-semibold">Rang</th>
            </tr>
          </thead>
          <tbody>
            {eleves.map((el, i) => (
              <tr
                key={el.id}
                className="ligne-note border-b border-slate-100"
                style={{ '--delai': `${Math.min(i, 25) * 20}ms` }}
              >
                <td className="sticky left-0 bg-white px-3 py-2 whitespace-nowrap">
                  <span className="font-semibold">{el.nom}</span> {el.prenoms}
                </td>
                {enseignements.map((e) => (
                  <td
                    key={e.id}
                    className={`chiffres px-2 py-2 text-right ${couleurMoyenne(el.moyennes[e.id].moyenne)}`}
                  >
                    {formaterNote(el.moyennes[e.id].moyenne)}
                  </td>
                ))}
                <td
                  className={`chiffres px-3 py-2 text-right font-semibold ${couleurMoyenne(el.moyenneGenerale)}`}
                >
                  {formaterNote(el.moyenneGenerale)}
                </td>
                <td className="chiffres px-3 py-2 text-right whitespace-nowrap">
                  {formaterRang(el.rang, el.exAequo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Téléphone : liste dépliable */}
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 lg:hidden">
        {eleves.map((el) => (
          <li key={el.id}>
            <button
              type="button"
              onClick={() => setOuvert(ouvert === el.id ? null : el.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
              aria-expanded={ouvert === el.id}
            >
              <span className="chiffres w-14 shrink-0 text-xs text-slate-500">
                {formaterRang(el.rang, el.exAequo)}
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold">{el.nom}</span> {el.prenoms}
              </span>
              <span className={`chiffres font-semibold ${couleurMoyenne(el.moyenneGenerale)}`}>
                {formaterNote(el.moyenneGenerale)}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform ${ouvert === el.id ? 'rotate-180' : ''}`}
              />
            </button>
            {ouvert === el.id && (
              <dl className="entree grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 bg-slate-50 px-4 py-3 text-sm">
                {enseignements.map((e) => (
                  <div key={e.id} className="contents">
                    <dt className="truncate text-slate-600">{e.matiere}</dt>
                    <dd className="chiffres text-right text-slate-400">×{e.coefficient}</dd>
                    <dd
                      className={`chiffres text-right font-semibold ${couleurMoyenne(el.moyennes[e.id].moyenne)}`}
                    >
                      {formaterNote(el.moyennes[e.id].moyenne)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function Resultats() {
  const { utilisateur } = useAuth();
  const [parametres, setParametres] = useSearchParams();
  const { donnees: listeClasses } = useRequete('/classes');
  const { donnees: listeAnnees } = useRequete('/annees');
  const annee = listeAnnees?.annees.find((a) => a.estCourante);
  const classes = listeClasses?.classes ?? [];
  const classeId = parametres.get('classe') ?? classes[0]?.id;
  const periodeId = parametres.get('periode') ?? (annee && periodeParDefaut(annee.periodes)?.id);
  const {
    donnees: resultats,
    erreur,
    chargement,
  } = useRequete(
    classeId && periodeId ? `/resultats?classeId=${classeId}&periodeId=${periodeId}` : null,
  );

  const choisir = (cle, valeur) =>
    setParametres(
      (p) =>
        new URLSearchParams({
          ...Object.fromEntries(p),
          ...(classeId && { classe: classeId }),
          ...(periodeId && { periode: periodeId }),
          [cle]: valeur,
        }),
      { replace: true },
    );

  return (
    <div className="space-y-6">
      <EnTetePage
        surtitre={annee?.libelle}
        titre="Résultats"
        description="Moyennes pondérées par les coefficients et rangs, calculés à partir des notes saisies."
        actions={
          utilisateur.role === 'ADMIN_ECOLE' && (
            <Link
              to="/espace/cloture"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-50"
            >
              <ShieldCheck className="h-4 w-4" /> Contrôle et clôture
            </Link>
          )
        }
      />
      <div
        className="entree flex flex-col gap-3 sm:flex-row sm:items-center"
        style={{ '--delai': '60ms' }}
      >
        <select
          aria-label="Classe"
          value={classeId ?? ''}
          onChange={(e) => choisir('classe', e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold sm:w-48 sm:text-sm"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
        {annee && (
          <div className="sm:w-96">
            <ChoixPeriode
              periodes={annee.periodes}
              valeur={periodeId}
              onChange={(id) => choisir('periode', id)}
            />
          </div>
        )}
      </div>

      {erreur && <Alerte type="erreur">{erreur.message}</Alerte>}
      {chargement && classeId && <Chargement />}
      {resultats && (
        <>
          <dl
            className="entree grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200 ring-1 ring-slate-200 sm:grid-cols-4"
            style={{ '--delai': '100ms' }}
          >
            {[
              ['Moyenne de classe', formaterNote(resultats.statistiques.moyenne)],
              ['Plus forte', formaterNote(resultats.statistiques.max)],
              ['Plus faible', formaterNote(resultats.statistiques.min)],
              [
                'Taux de réussite',
                resultats.statistiques.tauxReussite === null
                  ? '–'
                  : `${formaterNote(resultats.statistiques.tauxReussite, 0)} %`,
              ],
            ].map(([libelle, valeur]) => (
              <div key={libelle} className="bg-white px-4 py-3">
                <dt className="text-xs text-slate-500">{libelle}</dt>
                <dd className="chiffres text-2xl font-semibold">{valeur}</dd>
              </div>
            ))}
          </dl>
          {resultats.eleves.length ? (
            <Tableau resultats={resultats} />
          ) : (
            <Alerte type="info">Aucun élève inscrit dans cette classe.</Alerte>
          )}
        </>
      )}
    </div>
  );
}
