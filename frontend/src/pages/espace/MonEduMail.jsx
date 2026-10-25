import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Gift, KeyRound, Mail, MessageSquareWarning, Send } from 'lucide-react';
import MotDePasseTemporaire from '../../components/edumail/MotDePasseTemporaire.jsx';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { ChampMotDePasse, ChampSelection } from '../../components/ui/Champ.jsx';
import Dialogue from '../../components/ui/Dialogue.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';
import {
  CATEGORIES_SIGNALEMENT,
  EXPLICATIONS_STATUT,
  STATUTS_EDUMAIL,
  STATUTS_SIGNALEMENT,
} from '../../lib/edumail.js';
import { formaterDate } from '../../lib/navigation.js';

/** Réinitialisation : le mot de passe EduRelevé est redemandé, jamais l'adresse EduMail. */
function DialogueReinitialisation({ ouvert, onFermer }) {
  const [motDePasse, setMotDePasse] = useState('');
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const fermer = () => {
    setResultat(null);
    setMotDePasse('');
    setErreur(null);
    onFermer();
  };
  return (
    <Dialogue ouvert={ouvert} onFermer={fermer} titre="Réinitialiser l’accès à EduMail">
      {resultat ? (
        <MotDePasseTemporaire valeur={resultat.motDePasseTemporaire} simule={resultat.simule} />
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setEnvoi(true);
            setErreur(null);
            try {
              setResultat(
                await appelApi('/edumail/moi/reinitialisation', {
                  methode: 'POST',
                  corps: { motDePasse },
                }),
              );
            } catch (err) {
              setErreur(err.message);
            } finally {
              setMotDePasse('');
              setEnvoi(false);
            }
          }}
        >
          <p className="text-sm text-slate-600">
            Pour confirmer qu’il s’agit bien de vous, saisissez votre mot de passe EduRelevé. Un mot
            de passe temporaire de messagerie vous sera remis une seule fois.
          </p>
          <ChampMotDePasse
            libelle="Mot de passe EduRelevé"
            autoComplete="current-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            obligatoire
          />
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Bouton variante="secondaire" onClick={fermer}>
              Annuler
            </Bouton>
            <Bouton type="submit" chargement={envoi} icone={KeyRound}>
              Réinitialiser
            </Bouton>
          </div>
        </form>
      )}
    </Dialogue>
  );
}

function DialogueSignalement({ ouvert, onFermer, onEnvoye }) {
  const [categorie, setCategorie] = useState('IDENTITE');
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  return (
    <Dialogue ouvert={ouvert} onFermer={onFermer} titre="Signaler une erreur">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setEnvoi(true);
          setErreur(null);
          try {
            await appelApi('/edumail/moi/signalements', {
              methode: 'POST',
              corps: { categorie, message: message.trim() },
            });
            setMessage('');
            onEnvoye();
          } catch (err) {
            setErreur(err.message);
          } finally {
            setEnvoi(false);
          }
        }}
      >
        <p className="text-sm text-slate-600">
          Le secrétariat de votre établissement examinera votre message et corrigera votre fiche si
          nécessaire.
        </p>
        <ChampSelection
          libelle="Nature du problème"
          value={categorie}
          onChange={(e) => setCategorie(e.target.value)}
          options={Object.entries(CATEGORIES_SIGNALEMENT).map(([valeur, libelle]) => ({
            valeur,
            libelle,
          }))}
        />
        <textarea
          aria-label="Votre message"
          required
          maxLength={1000}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ex. : mon deuxième prénom est mal orthographié."
          className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-marque-500 focus:ring-2 focus:ring-marque-500/20 focus:outline-none sm:text-sm"
        />
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Bouton variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" chargement={envoi} disabled={!message.trim()} icone={Send}>
            Envoyer
          </Bouton>
        </div>
      </form>
    </Dialogue>
  );
}

function FicheCompte({ compte, service, onReinitialiser }) {
  const lignes = [
    ['Adresse', compte.adresse && <span className="chiffres break-all">{compte.adresse}</span>],
    ['Demandé le', formaterDate(compte.demandeLe)],
    ['Ouvert le', compte.activeLe && formaterDate(compte.activeLe)],
    [
      'Dernière vérification',
      compte.derniereVerificationLe && formaterDate(compte.derniereVerificationLe),
    ],
    [
      'Consentement',
      compte.consentement?.requis &&
        (compte.consentement.obtenu ? 'Obtenu' : 'En attente du représentant légal'),
    ],
    ['Motif', compte.motifDecision ?? compte.motifSuspension],
  ].filter(([, v]) => v);
  return (
    <section className="cahier marge-rouge space-y-3 rounded-2xl py-4 pr-4 pl-10 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center gap-2">
        <Badge statut={compte.statut} table={STATUTS_EDUMAIL} />
        {compte.simule && (
          <span className="text-xs font-semibold text-amber-800">Compte simulé (test)</span>
        )}
      </div>
      <p className="text-sm text-slate-700">{EXPLICATIONS_STATUT[compte.statut]}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 text-sm leading-7">
        {lignes.map(([libelle, valeur]) => (
          <div key={libelle} className="contents">
            <dt className="text-slate-500">{libelle}</dt>
            <dd className="min-w-0 font-medium">{valeur}</dd>
          </div>
        ))}
      </dl>
      {compte.statut === 'ACTIF' && (
        <div className="flex flex-wrap gap-2 pt-1">
          {service.urlWebmail && !compte.simule && (
            <a
              href={service.urlWebmail}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-marque-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-marque-700"
            >
              <ExternalLink className="h-4 w-4" /> Ouvrir la messagerie
            </a>
          )}
          <Bouton variante="secondaire" icone={KeyRound} onClick={onReinitialiser}>
            Réinitialiser l’accès
          </Bouton>
        </div>
      )}
    </section>
  );
}

/** Espace élève : demande, suivi et gestion du compte EduMail. */
export default function MonEduMail() {
  const { donnees, erreur, chargement, recharger } = useRequete('/edumail/moi');
  const [dialogue, setDialogue] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreurDemande, setErreurDemande] = useState(null);
  const [signale, setSignale] = useState(false);

  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  const { service, eligibilite, compte, signalements } = donnees;
  const peutDemander =
    eligibilite.statut !== 'NON_ELIGIBLE' && (!compte || compte.statut === 'REFUSE');

  async function demander() {
    setEnvoi(true);
    setErreurDemande(null);
    try {
      await appelApi('/edumail/moi/demande', { methode: 'POST' });
      recharger();
    } catch (err) {
      setErreurDemande(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="space-y-6">
      <EnTetePage
        surtitre="Messagerie scolaire"
        titre="Mon compte EduMail"
        description="Une adresse de messagerie fournie par votre établissement, pour vos échanges scolaires et l’accès à certains services éducatifs."
        actions={
          <Link
            to="/espace/avantages-numeriques"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-marque-700 hover:bg-marque-50"
          >
            <Gift className="h-4 w-4" /> Avantages numériques
          </Link>
        }
      />

      {service.simulation && (
        <Alerte type="attention" titre="Service en simulation">
          Aucun fournisseur de messagerie réel n’est raccordé : les adresses affichées sont des
          adresses de test et ne reçoivent aucun message.
        </Alerte>
      )}
      {!service.creationActivee && !service.simulation && (
        <Alerte type="info" titre="Service pas encore disponible">
          Votre établissement n’a pas encore ouvert la messagerie. Vous pouvez déjà déposer votre
          demande : la boîte sera créée lorsque le service sera configuré.
        </Alerte>
      )}

      {eligibilite.statut === 'NON_ELIGIBLE' && (
        <Alerte type="attention">{eligibilite.message}</Alerte>
      )}

      {compte && compte.statut !== 'REFUSE' ? (
        <FicheCompte
          compte={compte}
          service={service}
          onReinitialiser={() => setDialogue('reinitialiser')}
        />
      ) : (
        <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          {compte?.statut === 'REFUSE' && (
            <Alerte type="erreur" titre="Demande précédente refusée">
              {compte.motifDecision}
            </Alerte>
          )}
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-marque-600" />
            <div className="space-y-1 text-sm text-slate-700">
              <p>
                Votre adresse sera un identifiant neutre (par exemple{' '}
                <span className="chiffres">k7m2q9x4bd@{service.domaine ?? 'domaine-scolaire'}</span>
                ) : elle ne contient ni votre nom, ni votre téléphone, ni votre numéro d’élève.
              </p>
              <p>
                Votre demande sera examinée par la direction de votre établissement
                {service.consentement.politique !== 'jamais' &&
                  ', après l’accord de votre parent ou représentant légal'}
                .
              </p>
            </div>
          </div>
          {erreurDemande && <Alerte type="erreur">{erreurDemande}</Alerte>}
          {peutDemander && (
            <Bouton onClick={demander} chargement={envoi} icone={Send}>
              Demander mon compte EduMail
            </Bouton>
          )}
        </section>
      )}

      {eligibilite.statut === 'A_VERIFIER' && compte?.statut !== 'A_VERIFIER' && (
        <Alerte type="info">{eligibilite.message}</Alerte>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Une erreur dans vos informations ?</h2>
          <Bouton
            variante="secondaire"
            icone={MessageSquareWarning}
            onClick={() => setDialogue('signaler')}
            disabled={eligibilite.statut === 'NON_ELIGIBLE' && !compte}
          >
            Signaler une erreur
          </Bouton>
        </div>
        {signale && <Alerte type="succes">Votre signalement a été transmis au secrétariat.</Alerte>}
        {signalements.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
            {signalements.map((s) => (
              <li key={s.id} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{CATEGORIES_SIGNALEMENT[s.categorie]}</span>
                  <Badge statut={s.statut} table={STATUTS_SIGNALEMENT} />
                </div>
                <p className="text-slate-600">{s.message}</p>
                {s.reponse && (
                  <p className="text-slate-800">
                    <span className="font-semibold">Réponse : </span>
                    {s.reponse}
                  </p>
                )}
                <p className="text-xs text-slate-500">{formaterDate(s.creeLe)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Votre compte EduRelevé reste indépendant : en cas de perte de l’accès à EduMail, vous vous
        connectez toujours à EduRelevé avec votre identifiant et votre mot de passe habituels.
      </p>

      <DialogueReinitialisation
        ouvert={dialogue === 'reinitialiser'}
        onFermer={() => setDialogue(null)}
      />
      <DialogueSignalement
        ouvert={dialogue === 'signaler'}
        onFermer={() => setDialogue(null)}
        onEnvoye={() => {
          setDialogue(null);
          setSignale(true);
          recharger();
        }}
      />
    </div>
  );
}
