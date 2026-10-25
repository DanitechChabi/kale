import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Ban,
  Check,
  CircleCheck,
  FileText,
  KeyRound,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import DialogueMotif from '../../components/edumail/DialogueMotif.jsx';
import EtatService from '../../components/edumail/EtatService.jsx';
import MotDePasseTemporaire from '../../components/edumail/MotDePasseTemporaire.jsx';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { Champ, ChampSelection } from '../../components/ui/Champ.jsx';
import ChoixFichier from '../../components/ui/ChoixFichier.jsx';
import Dialogue from '../../components/ui/Dialogue.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';
import { ouvrirDocument } from '../../lib/documents.js';
import {
  LIBELLES_EVENEMENT,
  LIBELLES_REEXAMEN,
  LIENS_REPRESENTANT,
  STATUTS_EDUMAIL,
} from '../../lib/edumail.js';
import { formaterDate } from '../../lib/navigation.js';
import { ListeSignalements } from './EduMailEcole.jsx';

const EN_ATTENTE = ['A_VERIFIER', 'EN_ATTENTE_CONSENTEMENT', 'EN_ATTENTE_DECISION'];
const MOTIFS_SITUATION = {
  INSCRIPTION_A_VERIFIER: 'Aucune inscription « inscrit » pour l’année en cours',
  SANS_COMPTE: 'Fiche élève sans compte de connexion',
  ECOLE_NON_VERIFIEE: 'Établissement non vérifié',
};

function Section({ titre, children, actions }) {
  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{titre}</h2>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function Lignes({ lignes }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 text-sm leading-7">
      {lignes
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([libelle, valeur]) => (
          <div key={libelle} className="contents">
            <dt className="text-slate-500">{libelle}</dt>
            <dd className="min-w-0 font-medium break-words">{valeur}</dd>
          </div>
        ))}
    </dl>
  );
}

/** Saisie d'une attestation écrite signée : la pièce justificative est obligatoire. */
function DialogueAttestation({ ouvert, onFermer, id, onEnregistre }) {
  const [champs, setChamps] = useState({
    representantNom: '',
    representantLien: 'MERE',
    signeLe: '',
  });
  const [fichier, setFichier] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = (cle) => (e) => setChamps((c) => ({ ...c, [cle]: e.target.value }));
  return (
    <Dialogue ouvert={ouvert} onFermer={onFermer} titre="Attestation écrite du représentant légal">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setEnvoi(true);
          setErreur(null);
          const formulaire = new FormData();
          for (const [k, v] of Object.entries(champs)) formulaire.append(k, v);
          formulaire.append('fichier', fichier);
          try {
            onEnregistre(
              await appelApi(`/edumail/ecole/dossiers/${id}/consentements`, {
                methode: 'POST',
                corps: formulaire,
              }),
            );
          } catch (err) {
            setErreur(err.message);
          } finally {
            setEnvoi(false);
          }
        }}
      >
        <p className="text-sm text-slate-600">
          Joignez le document signé par le représentant légal (scan ou photo lisible). Il devra être
          vérifié par une autre personne de l’établissement avant d’être pris en compte.
        </p>
        <Champ
          libelle="Nom du représentant légal"
          value={champs.representantNom}
          onChange={maj('representantNom')}
          maxLength={200}
          obligatoire
        />
        <ChampSelection
          libelle="Lien avec l’élève"
          value={champs.representantLien}
          onChange={maj('representantLien')}
          options={LIENS_REPRESENTANT}
        />
        <Champ
          type="date"
          libelle="Date de signature"
          value={champs.signeLe}
          max={new Date().toISOString().slice(0, 10)}
          onChange={maj('signeLe')}
          obligatoire
        />
        <ChoixFichier fichier={fichier} onChange={setFichier} libelle="Document signé" />
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Bouton variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" chargement={envoi} disabled={!fichier} icone={Upload}>
            Enregistrer l’attestation
          </Bouton>
        </div>
      </form>
    </Dialogue>
  );
}

function Consentements({ detail, onMaj, executer }) {
  const { consentement, dossier, droits } = detail;
  const [ajout, setAjout] = useState(false);
  const [retrait, setRetrait] = useState(null);
  const base = `/edumail/ecole/dossiers/${dossier.id}/consentements`;
  return (
    <Section
      titre="Consentement du représentant légal"
      actions={
        !['REFUSE', 'CLOTURE'].includes(dossier.statut) && (
          <Bouton variante="secondaire" icone={Upload} onClick={() => setAjout(true)}>
            Attestation écrite
          </Bouton>
        )
      }
    >
      <p className="text-sm text-slate-700">
        {consentement.requis
          ? consentement.obtenu
            ? 'Requis et obtenu.'
            : 'Requis, pas encore obtenu.'
          : 'Non requis par la politique de l’établissement.'}
      </p>
      {consentement.liste.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
          {consentement.liste.map((c) => (
            <li key={c.id} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {c.mode === 'ESPACE_PARENT'
                    ? `Accord en ligne de ${c.parent?.nom ?? 'un parent relié'}`
                    : `Attestation écrite de ${c.representantNom}`}
                </p>
                <span
                  className={`text-xs font-semibold ${c.valable ? 'text-marque-700' : c.retireLe ? 'text-slate-500' : 'text-amber-800'}`}
                >
                  {c.retireLe ? 'Retiré' : c.valable ? 'Valable' : 'À vérifier'}
                </span>
              </div>
              <p className="text-slate-600">
                {c.mode === 'ATTESTATION_ECRITE' &&
                  `Signée le ${formaterDate(c.signeLe)} · saisie par ${c.recueilliPar?.nom ?? '—'} le ${formaterDate(c.creeLe)}`}
                {c.mode === 'ESPACE_PARENT' && `Donné le ${formaterDate(c.creeLe, true)}`}
                {c.validePar && ` · vérifiée par ${c.validePar.nom} le ${formaterDate(c.valideLe)}`}
              </p>
              {c.retireLe && (
                <p className="text-slate-500">
                  Retiré le {formaterDate(c.retireLe)}
                  {c.retirePar && ` par ${c.retirePar.nom}`}
                  {c.motifRetrait && ` : ${c.motifRetrait}`}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {c.preuve && (
                  <Bouton
                    variante="discret"
                    icone={FileText}
                    onClick={() => ouvrirDocument(`${base}/${c.id}/preuve`)}
                  >
                    Voir la pièce
                  </Bouton>
                )}
                {c.mode === 'ATTESTATION_ECRITE' &&
                  !c.valideLe &&
                  !c.retireLe &&
                  c.recueilliParId !== droits.utilisateurId && (
                    <Bouton
                      variante="secondaire"
                      icone={CircleCheck}
                      onClick={() => executer(`${base}/${c.id}/validation`).catch(() => {})}
                    >
                      Pièce vérifiée
                    </Bouton>
                  )}
                {!c.retireLe && (
                  <Bouton variante="discret" icone={X} onClick={() => setRetrait(c)}>
                    Retirer
                  </Bouton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <DialogueAttestation
        ouvert={ajout}
        onFermer={() => setAjout(false)}
        id={dossier.id}
        onEnregistre={(d) => {
          setAjout(false);
          onMaj(d);
        }}
      />
      <DialogueMotif
        ouvert={Boolean(retrait)}
        onFermer={() => setRetrait(null)}
        titre="Retirer ce consentement"
        explication="Le consentement reste dans l’historique avec la date et le motif du retrait. Un compte déjà ouvert n’est pas suspendu automatiquement : il sera signalé à réexaminer."
        bouton="Retirer"
        variante="danger"
        onValider={async (motif) => {
          await executer(`${base}/${retrait.id}/retrait`, { motif });
          setRetrait(null);
        }}
      />
    </Section>
  );
}

/** Établissement : instruction et suivi d'un dossier EduMail. */
export default function EduMailDossier() {
  const { id } = useParams();
  const { donnees, erreur, chargement } = useRequete(`/edumail/ecole/dossiers/${id}`);
  const [maj, setMaj] = useState(null);
  const [erreurAction, setErreurAction] = useState(null);
  const [enCours, setEnCours] = useState(null);
  const [dialogue, setDialogue] = useState(null);
  const [secret, setSecret] = useState(null);

  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  const detail = maj ?? donnees;
  const { dossier, eleve, situation, droits, evenements, signalements } = detail;
  const base = `/edumail/ecole/dossiers/${id}`;

  async function executer(chemin, corps, cle = chemin) {
    setEnCours(cle);
    setErreurAction(null);
    try {
      const r = await appelApi(chemin, { methode: 'POST', corps });
      setMaj(r);
      if (r.creation?.erreur)
        setErreurAction(`La création a échoué (${r.creation.erreur.code}). Vous pouvez relancer.`);
      return r;
    } catch (err) {
      setErreurAction(err.message);
      throw err;
    } finally {
      setEnCours(null);
    }
  }
  const action = (a) => async (motif) => {
    await executer(`${base}/action`, { action: a, motif });
    setDialogue(null);
  };

  const peutRefuser =
    droits.decider &&
    [...EN_ATTENTE, 'APPROUVE', 'ERREUR'].includes(dossier.statut) &&
    !dossier.referenceFournisseur;

  return (
    <div className="space-y-6">
      <EnTetePage
        retour={{ vers: '/espace/edumail/etablissement', libelle: 'EduMail' }}
        surtitre="Dossier EduMail"
        titre={eleve ? `${eleve.prenoms} ${eleve.nom}` : 'Élève'}
        actions={<Badge statut={dossier.statut} table={STATUTS_EDUMAIL} />}
      />
      <EtatService service={detail.service} />
      {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}
      {dossier.aReexaminer && (
        <Alerte type="attention" titre={`À réexaminer : ${LIBELLES_REEXAMEN[dossier.aReexaminer]}`}>
          Aucune mesure n’a été prise automatiquement. Examinez la situation, puis suspendez ou
          clôturez le compte si nécessaire, ou terminez le réexamen.
          {droits.decider && (
            <div className="pt-2">
              <Bouton variante="secondaire" onClick={() => setDialogue('reexamen')}>
                Terminer le réexamen
              </Bouton>
            </div>
          )}
        </Alerte>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          titre="Situation scolaire"
          actions={
            EN_ATTENTE.includes(dossier.statut) && (
              <Bouton
                variante="secondaire"
                icone={RefreshCw}
                chargement={enCours === 'verification'}
                onClick={() => executer(`${base}/verification`, undefined, 'verification')}
              >
                Revérifier
              </Bouton>
            )
          }
        >
          <Lignes
            lignes={[
              ['Né(e) le', eleve?.dateNaissance && formaterDate(eleve.dateNaissance)],
              ['Classe', situation.inscription?.classe],
              ['Année', situation.inscription?.anneeScolaire],
              ['Inscription', situation.inscription?.statut ?? 'Aucune cette année'],
              [
                'Éligibilité',
                situation.statut === 'ELIGIBLE' ? 'Éligible' : MOTIFS_SITUATION[situation.motif],
              ],
            ]}
          />
        </Section>
        <Section titre="Compte">
          <Lignes
            lignes={[
              [
                'Adresse',
                dossier.adresse ? (
                  <span className="chiffres">{dossier.adresse}</span>
                ) : (
                  <span className="text-slate-500">
                    prévue : <span className="chiffres">{dossier.adressePrevue}@…</span>
                  </span>
                ),
              ],
              [
                'Fournisseur',
                dossier.fournisseur && `${dossier.fournisseur}${dossier.simule ? ' (simulé)' : ''}`,
              ],
              ['Demandé le', formaterDate(dossier.demandeLe, true)],
              ['Ouvert le', dossier.activeLe && formaterDate(dossier.activeLe, true)],
              [
                'Décision',
                dossier.decision &&
                  `${dossier.decision.par?.nom ?? '—'}, le ${formaterDate(dossier.decision.le)}${dossier.decision.parDelegation ? ' (sur délégation)' : ''}`,
              ],
              ['Motif', dossier.decision?.motif ?? dossier.motifSuspension ?? dossier.motifCloture],
              ['Tentatives de création', dossier.tentatives || null],
              ['Dernière erreur', dossier.derniereErreur],
            ]}
          />
        </Section>
      </div>

      <Consentements detail={detail} onMaj={setMaj} executer={executer} />

      <Section titre="Décision et actions">
        {!droits.decider && EN_ATTENTE.includes(dossier.statut) && (
          <p className="text-sm text-slate-600">
            Vous pouvez instruire ce dossier ; la décision revient à la direction.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {droits.decider && dossier.statut === 'EN_ATTENTE_DECISION' && (
            <Bouton
              icone={Check}
              chargement={enCours === 'approuver'}
              onClick={() =>
                executer(`${base}/decision`, { decision: 'APPROUVER' }, 'approuver').catch(() => {})
              }
            >
              Approuver
            </Bouton>
          )}
          {peutRefuser && (
            <Bouton variante="secondaire" icone={Ban} onClick={() => setDialogue('refuser')}>
              Refuser
            </Bouton>
          )}
          {droits.decider && ['APPROUVE', 'ERREUR'].includes(dossier.statut) && (
            <Bouton
              icone={RotateCcw}
              chargement={enCours === 'creation'}
              onClick={() => executer(`${base}/creation`, undefined, 'creation').catch(() => {})}
            >
              {dossier.statut === 'ERREUR' ? 'Relancer la création' : 'Créer la boîte'}
            </Bouton>
          )}
          {droits.decider && dossier.statut === 'ACTIF' && (
            <Bouton
              variante="secondaire"
              icone={KeyRound}
              chargement={enCours === 'reinit'}
              onClick={async () => {
                setEnCours('reinit');
                setErreurAction(null);
                try {
                  setSecret(await appelApi(`${base}/reinitialisation`, { methode: 'POST' }));
                } catch (err) {
                  setErreurAction(err.message);
                } finally {
                  setEnCours(null);
                }
              }}
            >
              Réinitialiser l’accès
            </Bouton>
          )}
          {droits.direction && dossier.statut === 'ACTIF' && (
            <Bouton variante="secondaire" icone={Pause} onClick={() => setDialogue('suspendre')}>
              Suspendre
            </Bouton>
          )}
          {droits.direction && dossier.statut === 'SUSPENDU' && (
            <Bouton variante="secondaire" icone={Play} onClick={() => setDialogue('reactiver')}>
              Réactiver
            </Bouton>
          )}
          {droits.direction &&
            ['ACTIF', 'SUSPENDU', 'APPROUVE', 'ERREUR'].includes(dossier.statut) && (
              <Bouton variante="danger" icone={X} onClick={() => setDialogue('cloturer')}>
                Clôturer
              </Bouton>
            )}
        </div>
      </Section>

      {signalements.length > 0 && (
        <Section titre="Signalements de l’élève">
          <ListeSignalements
            signalements={signalements}
            onTraite={() => appelApi(base).then(setMaj, (err) => setErreurAction(err.message))}
          />
        </Section>
      )}

      <Section titre="Historique">
        <ol className="marge-rouge space-y-2 py-1 pl-10 text-sm">
          {evenements.map((e) => (
            <li key={e.id}>
              <p className="font-medium">{LIBELLES_EVENEMENT[e.type] ?? e.type}</p>
              <p className="text-slate-500">
                {formaterDate(e.le, true)}
                {e.auteur && ` · ${e.auteur.nom}`}
                {e.statutApres &&
                  e.statutApres !== e.statutAvant &&
                  ` · ${STATUTS_EDUMAIL[e.statutApres]?.[0] ?? e.statutApres}`}
              </p>
              {e.motif && <p className="text-slate-700">{e.motif}</p>}
            </li>
          ))}
        </ol>
      </Section>

      <DialogueMotif
        ouvert={dialogue === 'refuser'}
        onFermer={() => setDialogue(null)}
        titre="Refuser la demande"
        explication="L’élève verra ce motif. Il pourra déposer une nouvelle demande après correction."
        bouton="Refuser"
        variante="danger"
        onValider={async (motif) => {
          await executer(`${base}/decision`, { decision: 'REFUSER', motif });
          setDialogue(null);
        }}
      />
      <DialogueMotif
        ouvert={dialogue === 'suspendre'}
        onFermer={() => setDialogue(null)}
        titre="Suspendre le compte"
        explication="La boîte est désactivée chez le fournisseur ; l’adresse est conservée."
        bouton="Suspendre"
        variante="danger"
        onValider={action('SUSPENDRE')}
      />
      <DialogueMotif
        ouvert={dialogue === 'reactiver'}
        onFermer={() => setDialogue(null)}
        titre="Réactiver le compte"
        bouton="Réactiver"
        onValider={action('REACTIVER')}
      />
      <DialogueMotif
        ouvert={dialogue === 'cloturer'}
        onFermer={() => setDialogue(null)}
        titre="Clôturer le compte"
        explication="Décision définitive : la boîte est désactivée (jamais supprimée) et l’adresse ne sera jamais réattribuée à un autre élève."
        bouton="Clôturer"
        variante="danger"
        onValider={action('CLOTURER')}
      />
      <DialogueMotif
        ouvert={dialogue === 'reexamen'}
        onFermer={() => setDialogue(null)}
        titre="Terminer le réexamen"
        libelle="Conclusion"
        bouton="Enregistrer"
        onValider={async (note) => {
          await executer(`${base}/reexamen`, { note });
          setDialogue(null);
        }}
      />
      <Dialogue ouvert={Boolean(secret)} onFermer={() => setSecret(null)} titre="Nouvel accès">
        {secret && (
          <MotDePasseTemporaire valeur={secret.motDePasseTemporaire} simule={secret.simule} />
        )}
      </Dialogue>
    </div>
  );
}
