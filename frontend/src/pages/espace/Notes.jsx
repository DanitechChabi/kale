import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, CloudOff } from 'lucide-react';
import Apparition from '../../components/animation/Apparition.jsx';
import ChoixPeriode from '../../components/ChoixPeriode.jsx';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { useAuth } from '../../contexte/Auth.jsx';
import { useLectureHorsLigne } from '../../hooks/useLectureHorsLigne.js';
import { periodeParDefaut } from '../../lib/notes.js';

/** Liste des matières à noter, regroupées par classe. */
export default function Notes() {
  const { utilisateur } = useAuth();
  const [parametres, setParametres] = useSearchParams();
  const { donnees, erreur, chargement, horsLigne } = useLectureHorsLigne('/mes-enseignements');

  const periodes = donnees?.annee?.periodes ?? [];
  const periodeId = parametres.get('periode') ?? periodeParDefaut(periodes)?.id;
  const parClasse = useMemo(() => {
    const groupes = new Map();
    for (const e of donnees?.enseignements ?? []) {
      if (!groupes.has(e.classe.id))
        groupes.set(e.classe.id, { classe: e.classe, effectif: e.effectif, matieres: [] });
      groupes.get(e.classe.id).matieres.push(e);
    }
    return [...groupes.values()];
  }, [donnees]);

  if (chargement) return <Chargement />;
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (!donnees.annee) return <Alerte type="info">Aucune année scolaire en cours.</Alerte>;

  return (
    <div className="space-y-6">
      <EnTetePage
        surtitre={donnees.annee.libelle}
        titre="Notes"
        description={
          utilisateur.role === 'ENSEIGNANT'
            ? 'Vos matières. La saisie fonctionne aussi sans connexion : les notes partent dès le retour du réseau.'
            : 'Toutes les matières de l’établissement.'
        }
      />
      {horsLigne && (
        <Alerte type="attention" titre="Hors connexion">
          <span className="inline-flex items-center gap-1.5">
            <CloudOff className="h-4 w-4" /> Dernière liste enregistrée sur ce téléphone.
          </span>
        </Alerte>
      )}
      <div className="entree max-w-md" style={{ '--delai': '60ms' }}>
        <ChoixPeriode
          periodes={periodes}
          valeur={periodeId}
          onChange={(id) => setParametres({ periode: id }, { replace: true })}
        />
      </div>
      {!parClasse.length && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          Aucune matière ne vous est encore attribuée. Le responsable de l’établissement désigne
          l’enseignant de chaque matière depuis la page de la classe.
        </div>
      )}
      <div className="space-y-5">
        {parClasse.map(({ classe, effectif, matieres }, i) => (
          <Apparition
            key={classe.id}
            delai={i * 60}
            as="section"
            className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200"
          >
            <header className="flex items-baseline justify-between border-b border-slate-900 px-4 py-3">
              <h2 className="text-lg font-bold">{classe.nom}</h2>
              <p className="chiffres text-xs text-slate-500">{effectif} élèves</p>
            </header>
            <ul className="divide-y divide-slate-100">
              {matieres.map((m) => (
                <li key={m.id}>
                  <Link
                    to={`/espace/notes/${m.id}?periode=${periodeId}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-marque-50/50"
                  >
                    <span className="flex-1 font-medium">{m.matiere}</span>
                    <span className="chiffres text-xs text-slate-500">coef. {m.coefficient}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </Apparition>
        ))}
      </div>
    </div>
  );
}
