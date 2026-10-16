import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquareText, Save } from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { useAuth } from '../../contexte/Auth.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';

const STATUTS = [
  ['PRESENT', 'Présent'],
  ['ABSENT', 'Absent'],
  ['RETARD', 'Retard'],
];
const HEURES = Array.from({ length: 23 }, (_, i) => {
  const minutes = 7 * 60 + i * 30; // 07:00 à 18:00, toutes les demi-heures
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** Créneau proposé : la demi-heure en cours, entre 7 h et 18 h. */
function heureCourante() {
  const d = new Date();
  const minutes = Math.min(
    18 * 60,
    Math.max(7 * 60, d.getHours() * 60 + (d.getMinutes() >= 30 ? 30 : 0)),
  );
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

const COULEURS = {
  PRESENT: 'bg-marque-600 text-white',
  ABSENT: 'bg-rouge text-white',
  RETARD: 'bg-sceau text-white',
};

function LigneEleve({ eleve, saisie, onChange, index }) {
  return (
    <li
      className="ligne-note grid grid-cols-1 items-center gap-2 px-4 py-3 sm:grid-cols-[1fr_auto]"
      style={{ '--delai': `${Math.min(index, 30) * 15}ms` }}
    >
      <p className="min-w-0 truncate">
        <span className="font-semibold">{eleve.nom}</span> {eleve.prenoms}
        {eleve.justifiee && saisie.statut !== 'PRESENT' && (
          <span className="ml-2 text-xs font-semibold text-marque-700">justifiée</span>
        )}
      </p>
      <div className="flex items-center gap-2">
        <div
          className="flex flex-1 gap-1 rounded-lg bg-slate-100 p-1 sm:flex-none"
          role="radiogroup"
          aria-label={`Présence de ${eleve.prenoms} ${eleve.nom}`}
        >
          {STATUTS.map(([valeur, libelle]) => (
            <button
              key={valeur}
              type="button"
              role="radio"
              aria-checked={saisie.statut === valeur}
              onClick={() => onChange({ ...saisie, statut: valeur })}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition sm:flex-none ${
                saisie.statut === valeur ? COULEURS[valeur] : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {libelle}
            </button>
          ))}
        </div>
        {saisie.statut === 'RETARD' && (
          <label className="flex items-center gap-1 text-sm text-slate-600">
            <input
              type="number"
              min="1"
              max="240"
              inputMode="numeric"
              value={saisie.minutesRetard ?? ''}
              onChange={(e) => onChange({ ...saisie, minutesRetard: e.target.value })}
              className="chiffres w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-right"
              aria-label="Minutes de retard"
            />
            min
          </label>
        )}
      </div>
    </li>
  );
}

export default function Appel() {
  const { utilisateur } = useAuth();
  const estEnseignant = utilisateur.role === 'ENSEIGNANT';
  const [parametres, setParametres] = useSearchParams();
  const { donnees: toutes } = useRequete(estEnseignant ? null : '/classes');
  const { donnees: miennes } = useRequete(estEnseignant ? '/mes-enseignements' : null);
  const classes = useMemo(() => {
    if (!estEnseignant) return toutes?.classes ?? [];
    const parId = new Map((miennes?.enseignements ?? []).map((e) => [e.classe.id, e.classe]));
    return [...parId.values()];
  }, [estEnseignant, toutes, miennes]);

  const classeId = parametres.get('classe') ?? classes[0]?.id;
  const date = parametres.get('date') ?? aujourdhui();
  const heureDebut = parametres.get('heure') ?? heureCourante();
  const chemin = classeId
    ? `/appels?classeId=${classeId}&date=${date}&heureDebut=${encodeURIComponent(heureDebut)}`
    : null;
  const { donnees: feuille, erreur, chargement } = useRequete(chemin);

  // Statuts relevés : ceux de la feuille chargée, puis les modifications de l'utilisateur
  const initiales = useMemo(
    () =>
      Object.fromEntries(
        (feuille?.eleves ?? []).map((e) => [
          e.id,
          { statut: e.statut, minutesRetard: e.minutesRetard },
        ]),
      ),
    [feuille],
  );
  const [modifications, setModifications] = useState({ feuille: null, valeurs: {} });
  const saisies =
    modifications.feuille === feuille ? { ...initiales, ...modifications.valeurs } : initiales;
  const modifier = (eleveId, saisie) =>
    setModifications((m) => ({
      feuille,
      valeurs: { ...(m.feuille === feuille ? m.valeurs : {}), [eleveId]: saisie },
    }));
  const [envoi, setEnvoi] = useState({ etat: null, message: null });

  const choisir = (cle, valeur) => {
    setEnvoi({ etat: null, message: null });
    setParametres(
      (p) =>
        new URLSearchParams({
          ...Object.fromEntries(p),
          ...(classeId && { classe: classeId }),
          date,
          heure: heureDebut,
          [cle]: valeur,
        }),
      { replace: true },
    );
  };

  const creneauChoisi = feuille?.creneaux?.find((c) => c.heureDebut === heureDebut);
  const manquants = Object.values(saisies).filter((s) => s.statut !== 'PRESENT').length;

  async function enregistrer() {
    setEnvoi({ etat: 'envoi', message: null });
    try {
      const resultat = await appelApi('/appels', {
        methode: 'PUT',
        corps: {
          classeId,
          date,
          heureDebut,
          // Cours de l'emploi du temps à cette heure : la matière lui est rattachée
          ...(creneauChoisi && { creneauId: creneauChoisi.id }),
          presences: Object.entries(saisies)
            .filter(([, s]) => s.statut !== 'PRESENT')
            .map(([eleveId, s]) => ({
              eleveId,
              statut: s.statut,
              ...(s.statut === 'RETARD' &&
                s.minutesRetard && { minutesRetard: Number(s.minutesRetard) }),
            })),
        },
      });
      setEnvoi({
        etat: 'ok',
        message:
          resultat.smsEnFile > 0
            ? `Appel enregistré. ${resultat.smsEnFile} SMS envoyé${resultat.smsEnFile > 1 ? 's' : ''} aux parents.`
            : 'Appel enregistré.',
      });
    } catch (err) {
      setEnvoi({ etat: 'erreur', message: err.message });
    }
  }

  return (
    <div className="space-y-6">
      <EnTetePage
        titre="Appel"
        description="Tous les élèves sont présents par défaut : signalez seulement les absences et les retards. Les parents sont prévenus par SMS."
        actions={
          !estEnseignant && (
            <Link
              to="/espace/absences"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-50"
            >
              Absences à justifier
            </Link>
          )
        }
      />

      <div className="entree grid gap-3 sm:grid-cols-3" style={{ '--delai': '60ms' }}>
        <select
          aria-label="Classe"
          value={classeId ?? ''}
          onChange={(e) => choisir('classe', e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold sm:text-sm"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="Date"
          value={date}
          max={aujourdhui()}
          onChange={(e) => e.target.value && choisir('date', e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base sm:text-sm"
        />
        <select
          aria-label="Heure de début du cours"
          value={heureDebut}
          onChange={(e) => choisir('heure', e.target.value)}
          className="chiffres rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base sm:text-sm"
        >
          {HEURES.map((h) => (
            <option key={h} value={h}>
              {h.replace(':', ' h ')}
            </option>
          ))}
        </select>
      </div>

      {classes.length === 0 && (toutes || miennes) && (
        <Alerte type="info">Aucune classe à afficher.</Alerte>
      )}
      {erreur && <Alerte type="erreur">{erreur.message}</Alerte>}
      {chargement && chemin && <Chargement />}
      {feuille && (
        <>
          {feuille.creneaux?.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="etiquette">Cours du jour</span>
              {feuille.creneaux.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => choisir('heure', c.heureDebut)}
                  className={`rounded-lg px-3 py-1.5 text-sm ring-1 transition ${
                    c.heureDebut === heureDebut
                      ? 'bg-encre text-white ring-encre'
                      : 'bg-white ring-slate-300 hover:ring-marque-500'
                  }`}
                >
                  <span className="chiffres">{c.heureDebut}</span> · {c.matiere}
                </button>
              ))}
            </div>
          )}
          {feuille.appelsDuJour.length > 0 && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              Appels du jour :
              {feuille.appelsDuJour.map((a) => (
                <button
                  key={a.heureDebut}
                  type="button"
                  onClick={() => choisir('heure', a.heureDebut)}
                  className={`chiffres rounded-full px-2.5 py-0.5 ring-1 ${
                    a.heureDebut === heureDebut
                      ? 'bg-encre text-white ring-encre'
                      : 'ring-slate-300'
                  }`}
                >
                  {a.heureDebut} · {a.absences}
                </button>
              ))}
            </p>
          )}
          {feuille.eleves.length ? (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              {feuille.eleves.map((e, i) => (
                <LigneEleve
                  key={e.id}
                  eleve={e}
                  index={i}
                  saisie={saisies[e.id] ?? { statut: 'PRESENT' }}
                  onChange={(s) => {
                    modifier(e.id, s);
                    setEnvoi({ etat: null, message: null });
                  }}
                />
              ))}
            </ul>
          ) : (
            <Alerte type="info">Aucun élève inscrit dans cette classe.</Alerte>
          )}

          <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t-2 border-slate-900 bg-slate-50/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:px-0">
            <p className="text-sm text-slate-600">
              <span className="chiffres text-lg font-semibold text-slate-900">
                {feuille.eleves.length - manquants}
              </span>{' '}
              présent{feuille.eleves.length - manquants > 1 ? 's' : ''} ·{' '}
              <span className="chiffres font-semibold text-rouge">{manquants}</span> absent
              {manquants > 1 ? 's' : ''} ou en retard
              {feuille.enregistre && feuille.faitPar && (
                <span className="block text-xs text-slate-500">
                  Appel déjà fait par {feuille.faitPar.prenoms} {feuille.faitPar.nom}
                </span>
              )}
            </p>
            <Bouton icone={Save} chargement={envoi.etat === 'envoi'} onClick={enregistrer}>
              {feuille.enregistre ? 'Mettre à jour l’appel' : 'Enregistrer l’appel'}
            </Bouton>
          </div>
          {envoi.etat === 'ok' && (
            <Alerte type="succes">
              <span className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4" /> {envoi.message}
              </span>
            </Alerte>
          )}
          {envoi.etat === 'erreur' && <Alerte type="erreur">{envoi.message}</Alerte>}
        </>
      )}
    </div>
  );
}
