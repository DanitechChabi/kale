import { useState } from 'react';
import { CircleAlert, CircleCheck, Lock, TriangleAlert } from 'lucide-react';
import Apparition from '../../components/animation/Apparition.jsx';
import ChoixPeriode from '../../components/ChoixPeriode.jsx';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { Cadre } from '../../components/ui/Champ.jsx';
import Dialogue from '../../components/ui/Dialogue.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';
import { formaterNote, libellePeriode, periodeParDefaut } from '../../lib/notes.js';

const TYPES_ANOMALIES = {
  ECART_PERSONNEL: 'Note très éloignée des autres notes de l’élève',
  SAUT_PERIODE: 'Moyenne très différente de la période précédente',
  EVALUATION_ATYPIQUE: 'Évaluation à la moyenne inhabituelle',
  NOTES_IDENTIQUES: 'Notes identiques pour presque toute la classe',
  MODIFICATION: 'Note modifiée plusieurs fois ou après la fin de la période',
};

function Confirmation({ periode, pret, onClos }) {
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function cloturer() {
    setEnvoi(true);
    setErreur(null);
    try {
      await appelApi(`/periodes/${periode.id}/cloture`, {
        methode: 'POST',
        corps: pret ? {} : { forcer: true, motif: motif.trim() },
      });
      onClos();
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700">
        La clôture du <strong>{libellePeriode(periode).toLowerCase()}</strong> est{' '}
        <strong>définitive</strong> : plus aucune note de cette période ne pourra être ajoutée,
        modifiée ou supprimée, par personne. Les bulletins pourront ensuite être générés et
        archivés.
      </p>
      {!pret && (
        <Cadre id="motif-cloture" libelle="Des notes manquent : motif de la clôture" obligatoire>
          <textarea
            id="motif-cloture"
            rows={3}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Exemple : conseil de classe du 20 décembre, notes manquantes justifiées"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-marque-500 focus:ring-2 focus:ring-marque-500/20 focus:outline-none sm:text-sm"
          />
        </Cadre>
      )}
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      <Bouton
        variante="danger"
        icone={Lock}
        chargement={envoi}
        disabled={!pret && motif.trim().length < 5}
        onClick={cloturer}
        className="w-full"
      >
        Clôturer définitivement
      </Bouton>
    </div>
  );
}

export default function Cloture() {
  const { donnees: listeAnnees } = useRequete('/annees');
  const annee = listeAnnees?.annees.find((a) => a.estCourante);
  const [choix, setChoix] = useState(null);
  const periodeId = choix ?? (annee && periodeParDefaut(annee.periodes)?.id);
  const {
    donnees: controle,
    erreur,
    chargement,
    recharger,
  } = useRequete(periodeId ? `/periodes/${periodeId}/controle` : null);
  const [confirmation, setConfirmation] = useState(false);

  if (!annee) return <Chargement />;
  const periode = annee.periodes.find((p) => p.id === periodeId);

  return (
    <div className="space-y-6">
      <EnTetePage
        retour={{ vers: '/espace/resultats', libelle: 'Résultats' }}
        surtitre={annee.libelle}
        titre="Contrôle et clôture"
        description="Avant de figer les notes : vérifier qu’elles sont complètes et examiner les notes inhabituelles."
      />
      <div className="max-w-md">
        <ChoixPeriode periodes={annee.periodes} valeur={periodeId} onChange={setChoix} />
      </div>
      {erreur && <Alerte type="erreur">{erreur.message}</Alerte>}
      {chargement && <Chargement texte="Contrôle des notes de toutes les classes…" />}
      {controle && !chargement && (
        <>
          {controle.periode.estCloturee ? (
            <Alerte type="succes" titre={`${libellePeriode(controle.periode)} clôturé`}>
              Les notes de cette période sont définitives.
            </Alerte>
          ) : controle.pret ? (
            <Alerte type="succes" titre="Toutes les notes sont saisies">
              {controle.totalAnomalies
                ? `${controle.totalAnomalies} note${controle.totalAnomalies > 1 ? 's' : ''} inhabituelle${controle.totalAnomalies > 1 ? 's' : ''} à examiner avant la clôture.`
                : 'Aucune anomalie détectée.'}
            </Alerte>
          ) : (
            <Alerte type="attention" titre="Des notes manquent encore">
              La clôture reste possible, avec un motif qui sera conservé dans le journal.
            </Alerte>
          )}

          <ul className="space-y-3">
            {controle.classes.map((c, i) => {
              const complete = !c.sansEvaluation.length && !c.notesManquantes;
              return (
                <Apparition
                  as="li"
                  key={c.classe.id}
                  delai={i * 50}
                  className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    {complete ? (
                      <CircleCheck className="h-5 w-5 text-marque-600" />
                    ) : (
                      <CircleAlert className="h-5 w-5 text-amber-600" />
                    )}
                    <h2 className="flex-1 font-bold">{c.classe.nom}</h2>
                    <span className="chiffres text-sm text-slate-500">
                      {c.effectif} élèves · moy. {formaterNote(c.moyenneClasse)}
                    </span>
                  </div>
                  {!complete && (
                    <p className="mt-2 text-sm text-slate-600">
                      {c.sansEvaluation.length > 0 && (
                        <>Sans évaluation : {c.sansEvaluation.join(', ')}. </>
                      )}
                      {c.notesManquantes > 0 && (
                        <>
                          {c.notesManquantes} note{c.notesManquantes > 1 ? 's' : ''} manquante
                          {c.notesManquantes > 1 ? 's' : ''}.
                        </>
                      )}
                    </p>
                  )}
                  {c.anomalies.length > 0 && (
                    <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                      {c.anomalies.map((a, j) => (
                        <li key={j} className="flex gap-2 text-sm">
                          <TriangleAlert
                            className={`mt-0.5 h-4 w-4 shrink-0 ${a.gravite === 'attention' ? 'text-amber-600' : 'text-slate-400'}`}
                          />
                          <span>
                            <span className="block text-xs font-semibold text-slate-500">
                              {TYPES_ANOMALIES[a.type]}
                            </span>
                            {a.message}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Apparition>
              );
            })}
          </ul>

          {!controle.periode.estCloturee && controle.classes.length > 0 && (
            <div className="border-t border-slate-200 pt-5">
              <Bouton variante="danger" icone={Lock} onClick={() => setConfirmation(true)}>
                Clôturer le {libellePeriode(controle.periode).toLowerCase()}
              </Bouton>
            </div>
          )}
        </>
      )}
      <Dialogue
        ouvert={confirmation}
        onFermer={() => setConfirmation(false)}
        titre="Clôture définitive"
      >
        {periode && controle && (
          <Confirmation
            periode={periode}
            pret={controle.pret}
            onClos={() => {
              setConfirmation(false);
              recharger();
            }}
          />
        )}
      </Dialogue>
    </div>
  );
}
