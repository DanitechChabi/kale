import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, CloudUpload, Lock, Plus } from 'lucide-react';
import Apparition from '../../components/animation/Apparition.jsx';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { Champ, ChampSelection } from '../../components/ui/Champ.jsx';
import Dialogue from '../../components/ui/Dialogue.jsx';
import { useConnexion } from '../../hooks/useConnexion.js';
import { useLectureHorsLigne } from '../../hooks/useLectureHorsLigne.js';
import { appelApi } from '../../lib/api.js';
import { lireAvecRepli, memoriser, mettreEnFile, relire } from '../../lib/horsLigne.js';
import { formaterDate } from '../../lib/navigation.js';
import { formaterNote, LIBELLES_EVALUATIONS, libellePeriode } from '../../lib/notes.js';

const aujourdhui = () => new Date().toISOString().slice(0, 10);

function NouvelleEvaluation({ enseignement, periode, nombreParType, onCreee }) {
  const [type, setType] = useState('INTERROGATION');
  const [date, setDate] = useState(aujourdhui);
  const [bareme, setBareme] = useState('20');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function creer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    // L'identifiant est créé ici : l'évaluation existe tout de suite, même sans réseau
    const id = crypto.randomUUID();
    const corps = {
      id,
      enseignementId: enseignement.id,
      periodeId: periode.id,
      type,
      date,
      bareme: Number(bareme),
    };
    try {
      const { evaluation } = await appelApi('/evaluations', { methode: 'POST', corps });
      onCreee(evaluation.id);
    } catch (err) {
      if (err.code !== 'RESEAU') {
        setErreur(err.message);
        setEnvoi(false);
        return;
      }
      // Hors connexion : mise en file et feuille de notes préparée à partir des élèves connus
      const libelle =
        type === 'COMPOSITION' && !nombreParType[type]
          ? 'Composition'
          : `${LIBELLES_EVALUATIONS[type]} ${(nombreParType[type] ?? 0) + 1}`;
      await mettreEnFile({
        cle: `evaluation:${id}`,
        chemin: '/evaluations',
        methode: 'POST',
        corps: { ...corps, libelle },
        libelle: `${enseignement.matiere} · ${libelle}`,
      });
      const classe = await relire(`/classes/${enseignement.classe.id}`);
      await memoriser(`/evaluations/${id}/notes`, {
        evaluation: {
          id,
          type,
          libelle,
          date,
          bareme: Number(bareme),
          periode,
          enseignement: {
            id: enseignement.id,
            matiere: enseignement.matiere,
            classe: enseignement.classe,
          },
        },
        eleves: (classe?.donnees.classe.eleves ?? []).map((el) => ({ ...el, note: null })),
        statistiques: { moyenne: null, effectif: 0 },
        enAttente: true,
      });
      onCreee(id);
    }
  }

  return (
    <form onSubmit={creer} className="space-y-4">
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      <ChampSelection
        libelle="Type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        options={Object.entries(LIBELLES_EVALUATIONS).map(([valeur, libelle]) => ({
          valeur,
          libelle,
        }))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ
          libelle="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          obligatoire
        />
        <Champ
          libelle="Noté sur"
          type="number"
          inputMode="numeric"
          min="1"
          max="100"
          value={bareme}
          onChange={(e) => setBareme(e.target.value)}
          obligatoire
        />
      </div>
      <Bouton type="submit" icone={Plus} chargement={envoi} className="w-full">
        Créer et saisir les notes
      </Bouton>
    </form>
  );
}

export default function NotesEnseignement() {
  const { id } = useParams();
  const [parametres] = useSearchParams();
  const naviguer = useNavigate();
  const periodeId = parametres.get('periode');
  const { file } = useConnexion();
  const { donnees, erreur, chargement, horsLigne } = useLectureHorsLigne(
    `/enseignements/${id}/evaluations?periodeId=${periodeId}`,
  );
  const [creation, setCreation] = useState(false);

  // Garde la liste des élèves de la classe sur le téléphone pour une saisie sans réseau
  const classeId = donnees?.enseignement.classe.id;
  useEffect(() => {
    if (classeId && !horsLigne) lireAvecRepli(`/classes/${classeId}`).catch(() => {});
  }, [classeId, horsLigne]);

  if (chargement) return <Chargement />;
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;

  const { enseignement, periode, evaluations } = donnees;
  // Évaluations créées hors connexion, pas encore envoyées
  const enAttente = file
    .filter(
      (f) =>
        f.methode === 'POST' &&
        f.chemin === '/evaluations' &&
        f.corps.enseignementId === id &&
        f.corps.periodeId === periodeId,
    )
    .filter((f) => !evaluations.some((e) => e.id === f.corps.id))
    .map((f) => ({ ...f.corps, enAttente: true, nombreNotes: 0, statistiques: { moyenne: null } }));
  const liste = [...evaluations, ...enAttente];
  const nombreParType = liste.reduce((t, e) => ({ ...t, [e.type]: (t[e.type] ?? 0) + 1 }), {});

  return (
    <div className="space-y-6">
      <EnTetePage
        retour={{ vers: `/espace/notes?periode=${periodeId}`, libelle: 'Notes' }}
        surtitre={`${enseignement.classe.nom} · ${libellePeriode(periode)} · coef. ${enseignement.coefficient}`}
        titre={enseignement.matiere}
        actions={
          !periode.estCloturee && (
            <Bouton icone={Plus} onClick={() => setCreation(true)}>
              Nouvelle évaluation
            </Bouton>
          )
        }
      />
      {periode.estCloturee && (
        <Alerte type="info" titre="Période clôturée">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-4 w-4" /> Les notes sont définitives et ne peuvent plus être
            modifiées.
          </span>
        </Alerte>
      )}
      {!liste.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          Aucune évaluation pour cette période.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          {liste.map((e, i) => (
            <Apparition as="li" key={e.id} delai={i * 50}>
              <Link
                to={`/espace/notes/evaluation/${e.id}`}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-marque-50/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    {e.libelle}
                    {e.enAttente && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        <CloudUpload className="h-3 w-3" /> à envoyer
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500">
                    {formaterDate(e.date)} · sur {e.bareme} · {e.nombreNotes} note
                    {e.nombreNotes > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="chiffres text-lg font-semibold">
                    {formaterNote(e.statistiques.moyenne)}
                  </p>
                  <p className="text-xs text-slate-500">moyenne /20</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </Link>
            </Apparition>
          ))}
        </ul>
      )}
      <Dialogue ouvert={creation} onFermer={() => setCreation(false)} titre="Nouvelle évaluation">
        <NouvelleEvaluation
          enseignement={enseignement}
          periode={periode}
          nombreParType={nombreParType}
          onCreee={(evaluationId) => naviguer(`/espace/notes/evaluation/${evaluationId}`)}
        />
      </Dialogue>
    </div>
  );
}
