import EtatService from '../../components/edumail/EtatService.jsx';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { STATUTS_EDUMAIL } from '../../lib/edumail.js';

/** Comptes nationaux : chiffres agrégés, sans aucune donnée personnelle. */
export default function EduMailNational() {
  const { donnees, erreur, chargement } = useRequete('/edumail/national');
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  const total = Object.values(donnees.parStatut).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-6">
      <EnTetePage
        surtitre="Messagerie scolaire"
        titre="EduMail : vue nationale"
        description="Nombre de dossiers par étape, tous établissements confondus."
      />
      <EtatService service={donnees.service} />
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <dt className="text-xs text-slate-500">Dossiers</dt>
          <dd className="chiffres text-2xl font-semibold">{total}</dd>
        </div>
        {Object.entries(STATUTS_EDUMAIL).map(([statut, [libelle]]) => (
          <div key={statut} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <dt className="text-xs text-slate-500">{libelle}</dt>
            <dd className="chiffres text-2xl font-semibold">{donnees.parStatut[statut] ?? 0}</dd>
          </div>
        ))}
      </dl>
      {donnees.erreursParEtablissement && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Erreurs de création par établissement</h2>
          {donnees.erreursParEtablissement.length ? (
            <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
              {donnees.erreursParEtablissement.map((e) => (
                <li key={e.etablissement} className="flex justify-between px-4 py-3 text-sm">
                  <span>{e.etablissement}</span>
                  <span className="chiffres font-semibold text-rouge">{e.erreurs}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Alerte type="succes">Aucune erreur de création en attente.</Alerte>
          )}
        </section>
      )}
    </div>
  );
}
