import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CircleCheck, Lock, RotateCcw, X } from 'lucide-react';
import 'katex/dist/katex.min.css';
import './lecon.css';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';
import { cheminLecon, cheminProgramme, duree, LIBELLES_NIVEAUX } from '../../lib/educourses.js';

// Le HTML des leçons est produit et nettoyé par le serveur (liste blanche, sans liens)
const Html = ({ html, className = '' }) => (
  <div className={`texte-lecon ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
);

const NIVEAUX_EXERCICE = {
  facile: 'Facile',
  moyen: 'Moyen',
  approfondissement: 'Pour aller plus loin',
};

function Exercices({ exercices }) {
  return (
    <section className="space-y-4" aria-labelledby="titre-exercices">
      <h2 id="titre-exercices" className="etiquette border-b-2 border-slate-900 pb-2">
        Exercices
      </h2>
      <ol className="space-y-4">
        {exercices.map((e, i) => (
          <li key={i} className="rounded-lg bg-white p-4 ring-1 ring-slate-200 sm:p-5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-bold tracking-tight">{e.titre}</h3>
              <span className="etiquette">{NIVEAUX_EXERCICE[e.niveau] ?? e.niveau}</span>
            </div>
            <Html html={e.enonceHtml} />
            <details className="corrige mt-3 border-t border-dashed border-slate-300 pt-3">
              <summary className="cursor-pointer text-sm font-semibold text-marque-700">
                Voir le corrigé
              </summary>
              <Html html={e.corrigeHtml} className="mt-3" />
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Quiz : la correction (bonnes réponses, explications) vient du serveur. */
function Quiz({ lecon, profilId, onProgression }) {
  const [reponses, setReponses] = useState(() => lecon.quiz.map(() => null));
  const [correction, setCorrection] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const complet = reponses.every((r) => r !== null);

  async function corriger(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const resultat = await appelApi(`/educourses/lecons/${lecon.id}/quiz`, {
        methode: 'POST',
        corps: { profilId, reponses },
      });
      setCorrection(resultat);
      if (resultat.progression) onProgression(resultat.progression);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  function recommencer() {
    setReponses(lecon.quiz.map(() => null));
    setCorrection(null);
  }

  return (
    <section className="space-y-4" aria-labelledby="titre-quiz">
      <h2 id="titre-quiz" className="etiquette border-b-2 border-slate-900 pb-2">
        Quiz — vérifie que tu as compris
      </h2>
      <form onSubmit={corriger} className="space-y-4">
        {lecon.quiz.map((q, i) => {
          const c = correction?.corrections[i];
          return (
            <fieldset key={i} className="rounded-lg bg-white p-4 ring-1 ring-slate-200 sm:p-5">
              <legend className="sr-only">Question {i + 1}</legend>
              <div className="flex gap-3">
                <span className="chiffres pt-0.5 text-sm font-semibold text-rouge">{i + 1}.</span>
                <Html html={q.question} className="flex-1 font-medium" />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.choix.map((choix, j) => {
                  const choisi = reponses[i] === j;
                  const etat = c ? (j === c.bonne ? 'bonne' : choisi ? 'fausse' : 'neutre') : null;
                  return (
                    <label
                      key={j}
                      className={`choix-quiz flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ring-1 transition ${
                        etat === 'bonne'
                          ? 'bg-marque-50 ring-marque-400'
                          : etat === 'fausse'
                            ? 'bg-red-50 ring-rouge/50'
                            : choisi
                              ? 'bg-marque-50/50 ring-marque-500'
                              : 'ring-slate-200 hover:ring-slate-400'
                      } ${c ? 'cursor-default' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`question-${i}`}
                        checked={choisi}
                        disabled={Boolean(c)}
                        onChange={() => setReponses((r) => r.map((v, k) => (k === i ? j : v)))}
                        className="h-4 w-4 accent-marque-600"
                      />
                      <Html html={choix} className="flex-1 text-sm" />
                      {etat === 'bonne' && <Check className="h-4 w-4 text-marque-700" />}
                      {etat === 'fausse' && <X className="h-4 w-4 text-rouge" />}
                    </label>
                  );
                })}
              </div>
              {c?.explication && (
                <div className="mt-3 border-l-2 border-sceau pl-3 text-sm text-slate-700">
                  <Html html={c.explication} />
                </div>
              )}
            </fieldset>
          );
        })}
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        {correction ? (
          <div className="flex flex-wrap items-center gap-4" role="status">
            <span
              className={`tampon-encre tampon-frappe text-base ${
                correction.score >= 70 ? 'text-marque-700' : 'text-rouge'
              }`}
            >
              <span className="chiffres">{correction.score} %</span>
              {correction.score >= 70 ? 'Acquis' : 'À revoir'}
            </span>
            <Bouton variante="secondaire" icone={RotateCcw} onClick={recommencer}>
              Recommencer
            </Bouton>
          </div>
        ) : (
          <Bouton type="submit" disabled={!complet} chargement={envoi}>
            Corriger mes réponses
          </Bouton>
        )}
      </form>
    </section>
  );
}

/** Leçon complète : cours, exercices corrigés, quiz, et « J'ai terminé ». */
export default function Lecon() {
  const { profilId, leconId } = useParams();
  const { donnees, erreur, chargement } = useRequete(
    `/educourses/lecons/${leconId}?profil=${profilId}`,
  );
  // Avancement modifié pendant la visite (quiz, « terminé ») ; null : celui chargé
  const [progressionLocale, setProgressionLocale] = useState({ leconId: null, valeur: null });
  const [envoi, setEnvoi] = useState(false);
  const [erreurAction, setErreurAction] = useState(null);

  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  const { lecon } = donnees;
  const progression =
    progressionLocale.leconId === leconId ? progressionLocale.valeur : donnees.progression;
  const majProgression = (valeur) => setProgressionLocale({ leconId, valeur });
  const programme = lecon.programme;

  async function terminer(terminee) {
    setEnvoi(true);
    setErreurAction(null);
    try {
      const r = await appelApi(`/educourses/lecons/${lecon.id}/terminee`, {
        methode: 'PUT',
        corps: { profilId, terminee },
      });
      majProgression(r.progression);
    } catch (err) {
      setErreurAction(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <EnTetePage
        retour={{ vers: cheminProgramme(profilId, programme.id), libelle: programme.nomMatiere }}
        surtitre={`${LIBELLES_NIVEAUX[programme.niveau]} · Chapitre ${lecon.chapitre.ordre} — ${lecon.chapitre.titre}`}
        titre={lecon.titre}
        description={lecon.duree ? `Environ ${duree(lecon.duree)} de travail` : undefined}
      />

      {!lecon.libre ? (
        <Alerte type="info" titre="Leçon réservée aux abonnés">
          <span className="inline-flex items-center gap-1">
            <Lock className="h-4 w-4" /> La première leçon de chaque chapitre reste libre.
          </span>
        </Alerte>
      ) : !lecon.redigee ? (
        <Alerte type="info" titre="Leçon en cours de rédaction">
          Elle sera disponible prochainement. Objectifs : {lecon.objectifs.join(' ; ')}.
        </Alerte>
      ) : (
        <>
          <div className="cahier-lecon marge-rouge rounded-lg bg-white py-6 pr-5 pl-12 ring-1 ring-slate-200 sm:pr-8 sm:pl-14">
            <Html html={lecon.contenuHtml} />
          </div>
          {lecon.exercices.length > 0 && <Exercices exercices={lecon.exercices} />}
          {lecon.quiz.length > 0 && (
            <Quiz key={lecon.id} lecon={lecon} profilId={profilId} onProgression={majProgression} />
          )}

          <div className="flex flex-wrap items-center gap-3 border-t-2 border-slate-900 pt-5">
            {progression?.terminee ? (
              <>
                <span className="tampon-encre tampon-frappe text-marque-700">
                  <CircleCheck className="h-4 w-4" /> Leçon terminée
                </span>
                <Bouton variante="discret" chargement={envoi} onClick={() => terminer(false)}>
                  Annuler
                </Bouton>
              </>
            ) : (
              <Bouton icone={CircleCheck} chargement={envoi} onClick={() => terminer(true)}>
                J’ai terminé cette leçon
              </Bouton>
            )}
            {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}
          </div>
        </>
      )}

      <nav className="grid gap-3 sm:grid-cols-2" aria-label="Leçons voisines">
        {lecon.precedente ? (
          <Link
            to={cheminLecon(profilId, lecon.precedente.id)}
            className="flex items-center gap-2 rounded-lg bg-white p-3 text-sm ring-1 ring-slate-200 hover:ring-marque-400"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="truncate">{lecon.precedente.titre}</span>
          </Link>
        ) : (
          <span />
        )}
        {lecon.suivante && (
          <Link
            to={cheminLecon(profilId, lecon.suivante.id)}
            className="flex items-center justify-end gap-2 rounded-lg bg-white p-3 text-right text-sm ring-1 ring-slate-200 hover:ring-marque-400"
          >
            <span className="truncate">{lecon.suivante.titre}</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Link>
        )}
      </nav>
    </article>
  );
}
