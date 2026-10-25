import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, FlagTriangleRight, UserCog } from 'lucide-react';
import DialogueMotif from '../../components/edumail/DialogueMotif.jsx';
import EtatService from '../../components/edumail/EtatService.jsx';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import Onglets from '../../components/ui/Onglets.jsx';
import { useAuth } from '../../contexte/Auth.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';
import {
  CATEGORIES_SIGNALEMENT,
  LIBELLES_REEXAMEN,
  STATUTS_EDUMAIL,
  STATUTS_SIGNALEMENT,
} from '../../lib/edumail.js';
import { formaterDate } from '../../lib/navigation.js';

const ONGLETS = [
  ['attente', 'À instruire', ['A_VERIFIER', 'EN_ATTENTE_CONSENTEMENT', 'EN_ATTENTE_DECISION']],
  ['creation', 'À créer', ['APPROUVE', 'EN_COURS', 'ERREUR']],
  ['actifs', 'Actifs', ['ACTIF', 'SUSPENDU']],
  ['reexaminer', 'À réexaminer', null],
  ['termines', 'Refusés et clôturés', ['REFUSE', 'CLOTURE']],
  ['signalements', 'Signalements', null],
];

/** Réglage de la délégation des décisions au secrétariat (direction seulement). */
function Delegation({ active, onChange }) {
  const { utilisateur } = useAuth();
  const [envoi, setEnvoi] = useState(false);
  const direction = utilisateur.role === 'ADMIN_ECOLE';
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-start gap-3 text-sm">
        <UserCog className="mt-0.5 h-5 w-5 shrink-0 text-marque-600" />
        <div>
          <p className="font-semibold">
            Décisions du secrétariat : {active ? 'déléguées' : 'non déléguées'}
          </p>
          <p className="text-slate-600">
            {active
              ? 'Le secrétariat peut approuver ou refuser les demandes ; chaque décision est marquée « sur délégation » dans l’historique.'
              : 'Le secrétariat instruit les dossiers ; seule la direction approuve ou refuse.'}
          </p>
        </div>
      </div>
      {direction && (
        <Bouton
          variante="secondaire"
          chargement={envoi}
          onClick={async () => {
            setEnvoi(true);
            try {
              await appelApi('/edumail/ecole/delegation', {
                methode: 'PUT',
                corps: { secretariat: !active },
              });
              onChange();
            } finally {
              setEnvoi(false);
            }
          }}
        >
          {active ? 'Retirer la délégation' : 'Déléguer au secrétariat'}
        </Bouton>
      )}
    </section>
  );
}

function ListeDossiers({ dossiers }) {
  if (!dossiers.length) return <Alerte type="info">Aucun dossier dans cette catégorie.</Alerte>;
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
      {dossiers.map((d) => (
        <li key={d.id}>
          <Link
            to={`/espace/edumail/dossiers/${d.id}`}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50 sm:grid-cols-[1fr_14rem_8rem_auto]"
          >
            <div className="min-w-0">
              <p className="truncate">
                <span className="font-semibold">{d.eleve.nom}</span> {d.eleve.prenoms}
              </p>
              <p className="chiffres text-xs text-slate-500">{d.eleve.matricule}</p>
            </div>
            <p className="chiffres hidden truncate text-sm text-slate-600 sm:block">
              {d.adresse ?? '—'}
              {d.simule && <span className="ml-1 text-xs text-amber-800">(simulé)</span>}
            </p>
            <p className="hidden text-sm text-slate-500 sm:block">{formaterDate(d.demandeLe)}</p>
            <div className="flex items-center gap-2">
              {d.aReexaminer && (
                <FlagTriangleRight
                  className="h-4 w-4 text-rouge"
                  aria-label={LIBELLES_REEXAMEN[d.aReexaminer]}
                />
              )}
              <Badge statut={d.statut} table={STATUTS_EDUMAIL} />
              <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Signalements des élèves : traités par le secrétariat ou la direction. */
export function ListeSignalements({ signalements, onTraite }) {
  const [enCours, setEnCours] = useState(null);
  if (!signalements.length) return <Alerte type="info">Aucun signalement ouvert.</Alerte>;
  return (
    <>
      <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
        {signalements.map((s) => (
          <li key={s.id} className="space-y-2 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                {s.eleve && (
                  <span className="font-semibold">
                    {s.eleve.nom} {s.eleve.prenoms} ·{' '}
                  </span>
                )}
                {CATEGORIES_SIGNALEMENT[s.categorie]}
              </p>
              <Badge statut={s.statut} table={STATUTS_SIGNALEMENT} />
            </div>
            <p className="text-slate-700">{s.message}</p>
            {s.reponse && <p className="text-slate-500">Réponse : {s.reponse}</p>}
            <p className="text-xs text-slate-500">{formaterDate(s.creeLe, true)}</p>
            {s.statut === 'OUVERT' && (
              <div className="flex flex-wrap gap-2">
                <Bouton variante="secondaire" onClick={() => setEnCours({ s, statut: 'TRAITE' })}>
                  Marquer traité
                </Bouton>
                <Bouton variante="discret" onClick={() => setEnCours({ s, statut: 'REJETE' })}>
                  Rejeter
                </Bouton>
              </div>
            )}
          </li>
        ))}
      </ul>
      <DialogueMotif
        ouvert={Boolean(enCours)}
        onFermer={() => setEnCours(null)}
        titre={enCours?.statut === 'TRAITE' ? 'Signalement traité' : 'Rejeter le signalement'}
        explication="L’élève verra cette réponse dans son espace EduMail."
        libelle="Réponse à l’élève"
        bouton="Enregistrer"
        onValider={async (reponse) => {
          await appelApi(`/edumail/ecole/signalements/${enCours.s.id}`, {
            methode: 'PATCH',
            corps: { statut: enCours.statut, reponse },
          });
          setEnCours(null);
          onTraite();
        }}
      />
    </>
  );
}

function OngletSignalements() {
  const { donnees, erreur, chargement, recharger } = useRequete(
    '/edumail/ecole/signalements?statut=OUVERT',
  );
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  return <ListeSignalements signalements={donnees.signalements} onTraite={recharger} />;
}

/** Établissement : demandes EduMail, délégation, signalements. */
export default function EduMailEcole() {
  const [parametres, setParametres] = useSearchParams();
  const onglet = parametres.get('onglet') ?? 'attente';
  const { donnees, erreur, chargement, recharger } = useRequete('/edumail/ecole');

  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  const { statistiques, dossiers } = donnees;
  const total = (statuts) => statuts.reduce((n, s) => n + (statistiques.parStatut[s] ?? 0), 0);
  const definition = ONGLETS.find(([v]) => v === onglet) ?? ONGLETS[0];
  const filtres =
    onglet === 'reexaminer'
      ? dossiers.filter((d) => d.aReexaminer)
      : dossiers.filter((d) => definition[2]?.includes(d.statut));

  return (
    <div className="space-y-6">
      <EnTetePage
        surtitre="Messagerie scolaire"
        titre="EduMail"
        description="Demandes des élèves du secondaire : vérification de l’inscription, consentement du représentant légal, décision, création et suivi des comptes."
      />
      <EtatService service={donnees.service} />
      <Delegation active={donnees.delegationSecretariat} onChange={recharger} />
      <Onglets
        onglets={ONGLETS.map(([valeur, libelle, statuts]) => [
          valeur,
          libelle,
          valeur === 'reexaminer'
            ? statistiques.aReexaminer
            : valeur === 'signalements'
              ? statistiques.signalementsOuverts
              : total(statuts),
        ])}
        actif={onglet}
        onChange={(v) => setParametres({ onglet: v }, { replace: true })}
      />
      {onglet === 'signalements' ? <OngletSignalements /> : <ListeDossiers dossiers={filtres} />}
    </div>
  );
}
