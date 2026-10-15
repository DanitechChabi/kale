import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, X } from 'lucide-react';
import EtapesVerification from '../../components/EtapesVerification.jsx';
import ListeDocuments from '../../components/ListeDocuments.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Badge, { STATUTS_ECOLE } from '../../components/ui/Badge.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { Cadre } from '../../components/ui/Champ.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';
import { LIBELLES_PIECES } from '../../lib/documents.js';
import { formaterDate, formaterTelephone } from '../../lib/navigation.js';

const LIBELLES_DECISIONS = {
  EN_EXAMEN: ['Prendre en charge', 'secondaire'],
  VERIFIEE: ['Valider l’établissement', 'principal'],
  REJETEE: ['Rejeter le dossier', 'danger'],
  SUSPENDUE: ['Suspendre l’accès', 'danger'],
};

const STATUTS_JURIDIQUES = {
  PUBLIC: 'Public',
  PRIVE_LAIC: 'Privé laïc',
  PRIVE_CONFESSIONNEL: 'Privé confessionnel',
};
const TYPES = {
  CEG: 'CEG',
  LYCEE: 'Lycée',
  LYCEE_TECHNIQUE: 'Lycée technique',
  COMPLEXE_SCOLAIRE: 'Complexe scolaire',
};

/** Accepter ou refuser une pièce ; un refus demande une explication. */
function ExamenDocument({ document, onExamine }) {
  const [refus, setRefus] = useState(false);
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  if (document.statut !== 'EN_ATTENTE' && !refus) return null;

  async function examiner(statut) {
    setEnvoi(true);
    setErreur(null);
    try {
      await appelApi(`/verification/documents/${document.id}`, {
        methode: 'PATCH',
        corps: { statut, ...(statut === 'REFUSE' && { commentaire }) },
      });
      onExamine();
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  if (refus) {
    return (
      <div className="w-full space-y-2 sm:w-72">
        <textarea
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          rows={2}
          placeholder="Motif du refus (visible par l’établissement)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-marque-500 focus:ring-2 focus:ring-marque-500/20 focus:outline-none"
          autoFocus
        />
        {erreur && <p className="text-sm text-rouge">{erreur}</p>}
        <div className="flex gap-2">
          <Bouton
            variante="danger"
            chargement={envoi}
            disabled={commentaire.trim().length < 5}
            onClick={() => examiner('REFUSE')}
            className="flex-1"
          >
            Refuser
          </Bouton>
          <Bouton variante="secondaire" onClick={() => setRefus(false)}>
            Annuler
          </Bouton>
        </div>
      </div>
    );
  }

  return (
    <>
      <Bouton
        variante="secondaire"
        icone={Check}
        chargement={envoi}
        onClick={() => examiner('ACCEPTE')}
        className="min-h-9 py-1.5"
      >
        Accepter
      </Bouton>
      <Bouton
        variante="discret"
        icone={X}
        onClick={() => setRefus(true)}
        className="min-h-9 py-1.5 text-rouge hover:bg-red-50"
      >
        Refuser
      </Bouton>
      {erreur && <p className="w-full text-sm text-rouge">{erreur}</p>}
    </>
  );
}

function Decision({ ecoleId, decisions, piecesNonAcceptees, onDecide }) {
  const [choix, setChoix] = useState(null);
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  if (!decisions.length) return null;
  const motifRequis = ['REJETEE', 'SUSPENDUE'].includes(choix);

  async function decider(statut) {
    setEnvoi(true);
    setErreur(null);
    try {
      await appelApi(`/verification/ecoles/${ecoleId}/decision`, {
        methode: 'POST',
        corps: { statut, ...(motif.trim() && { motif: motif.trim() }) },
      });
      setChoix(null);
      setMotif('');
      onDecide();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <section
      className="entree space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
      style={{ '--delai': '240ms' }}
    >
      <h2 className="font-semibold">Décision</h2>
      {decisions.includes('VERIFIEE') && piecesNonAcceptees.length > 0 && (
        <Alerte type="attention" titre="Validation possible après acceptation de :">
          <ul className="list-inside list-disc">
            {piecesNonAcceptees.map((t) => (
              <li key={t}>{LIBELLES_PIECES[t]}</li>
            ))}
          </ul>
        </Alerte>
      )}
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {motifRequis ? (
        <div className="space-y-3">
          <Cadre id="motif" libelle="Motif communiqué à l’établissement" obligatoire>
            <textarea
              id="motif"
              rows={3}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-marque-500 focus:ring-2 focus:ring-marque-500/20 focus:outline-none sm:text-sm"
              autoFocus
            />
          </Cadre>
          <div className="flex flex-wrap gap-2">
            <Bouton
              variante="danger"
              chargement={envoi}
              disabled={motif.trim().length < 5}
              onClick={() => decider(choix)}
            >
              {LIBELLES_DECISIONS[choix][0]}
            </Bouton>
            <Bouton variante="secondaire" onClick={() => setChoix(null)}>
              Annuler
            </Bouton>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {decisions.map((statut) => {
            const [libelle, variante] = LIBELLES_DECISIONS[statut];
            const bloque = statut === 'VERIFIEE' && piecesNonAcceptees.length > 0;
            return (
              <Bouton
                key={statut}
                variante={variante}
                chargement={envoi && !['REJETEE', 'SUSPENDUE'].includes(statut)}
                disabled={bloque}
                onClick={() =>
                  ['REJETEE', 'SUSPENDUE'].includes(statut) ? setChoix(statut) : decider(statut)
                }
              >
                {libelle}
              </Bouton>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function VerificationDetail() {
  const { id } = useParams();
  const { donnees, erreur, chargement, recharger } = useRequete(`/verification/ecoles/${id}`);

  if (chargement && !donnees) return <Chargement />;
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;

  const { ecole, responsables, documents, piecesNonAcceptees, decisionsPossibles } = donnees;
  const examinable = ['EN_ATTENTE', 'EN_EXAMEN'].includes(ecole.statutVerification);

  const infos = [
    ['Code officiel', ecole.code],
    ['Statut', STATUTS_JURIDIQUES[ecole.statut]],
    ['Type', TYPES[ecole.type]],
    [
      'Ordres d’enseignement',
      ecole.ordres.map((o) => (o === 'GENERAL' ? 'Général' : 'Technique')).join(', '),
    ],
    ['Chef d’établissement', ecole.nomChefEtablissement],
    ['Localisation', `${ecole.commune}, ${ecole.departement}`],
    ['Adresse', ecole.adresse],
    ['Téléphone', formaterTelephone(ecole.telephone)],
    ['E-mail', ecole.email],
    ['Découpage de l’année', ecole.typePeriode === 'SEMESTRE' ? 'Semestres' : 'Trimestres'],
    ['Dossier déposé le', formaterDate(ecole.creeLe, true)],
  ].filter(([, valeur]) => valeur);

  return (
    <div className="space-y-6">
      <Link
        to="/espace/verification"
        className="entree inline-flex items-center gap-1 text-sm font-semibold text-marque-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Tous les dossiers
      </Link>

      <div
        className="entree flex flex-wrap items-start justify-between gap-3"
        style={{ '--delai': '60ms' }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{ecole.nom}</h1>
          {ecole.sigle && <p className="text-sm text-slate-500">{ecole.sigle}</p>}
        </div>
        <Badge statut={ecole.statutVerification} table={STATUTS_ECOLE} />
      </div>

      <section
        className="entree space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
        style={{ '--delai': '100ms' }}
      >
        <EtapesVerification statut={ecole.statutVerification} />
        {ecole.motifDecision && (
          <Alerte type="attention" titre="Motif de la dernière décision">
            {ecole.motifDecision}
          </Alerte>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section
          className="entree rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-2"
          style={{ '--delai': '140ms' }}
        >
          <h2 className="mb-4 font-semibold">Établissement</h2>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {infos.map(([libelle, valeur]) => (
              <div key={libelle} className="min-w-0">
                <dt className="text-slate-500">{libelle}</dt>
                <dd className="font-medium break-words text-slate-900">{valeur}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section
          className="entree rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          style={{ '--delai': '180ms' }}
        >
          <h2 className="mb-4 font-semibold">Responsable du compte</h2>
          {responsables.map((r) => (
            <div key={r.id} className="space-y-1 text-sm">
              <p className="font-medium text-slate-900">
                {r.prenoms} {r.nom}
              </p>
              <p className="text-slate-600 tabular-nums">{formaterTelephone(r.telephone)}</p>
              {r.email && <p className="break-all text-slate-600">{r.email}</p>}
            </div>
          ))}
        </section>
      </div>

      <section
        className="entree rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
        style={{ '--delai': '220ms' }}
      >
        <h2 className="font-semibold">Pièces justificatives</h2>
        <ListeDocuments
          documents={documents}
          cheminFichier={(docId) => `/verification/documents/${docId}/fichier`}
          actions={
            examinable
              ? (document) => <ExamenDocument document={document} onExamine={recharger} />
              : undefined
          }
        />
      </section>

      <Decision
        ecoleId={ecole.id}
        decisions={decisionsPossibles}
        piecesNonAcceptees={piecesNonAcceptees}
        onDecide={recharger}
      />
    </div>
  );
}
