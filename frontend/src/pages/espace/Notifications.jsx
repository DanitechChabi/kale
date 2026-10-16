import { useState } from 'react';
import { CalendarCheck, RotateCcw } from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import Onglets from '../../components/ui/Onglets.jsx';
import { useAuth } from '../../contexte/Auth.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';
import { formaterDate, formaterTelephone } from '../../lib/navigation.js';

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
/** « 2026-10 » → « octobre 2026 » */
const nomMois = (mois) => `${MOIS[Number(mois.slice(5, 7)) - 1]} ${mois.slice(0, 4)}`;

const STATUTS = {
  EN_ATTENTE: ['En file', 'ambre'],
  ENVOI: ['Envoi', 'bleu'],
  ENVOYEE: ['Envoyé', 'vert'],
  JOURNALISEE: ['Enregistré', 'gris'],
  ECHEC: ['Échec', 'rouge'],
};

function Interrupteur({ libelle, description, actif, onChange, desactive }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block font-medium">{libelle}</span>
        <span className="block text-sm text-slate-500">{description}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={actif}
        disabled={desactive}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-marque-500 ${
          actif ? 'bg-marque-600' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            actif ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </label>
  );
}

export default function Notifications() {
  const { utilisateur } = useAuth();
  const estDirection = utilisateur.role === 'ADMIN_ECOLE';
  const [statut, setStatut] = useState('');
  const { donnees: config, recharger: rechargerConfig } = useRequete('/notifications/reglages');
  const { donnees, erreur, chargement, recharger } = useRequete(
    `/notifications${statut ? `?statut=${statut}` : ''}`,
  );
  const [erreurAction, setErreurAction] = useState(null);

  async function regler(champ, valeur) {
    setErreurAction(null);
    try {
      await appelApi('/notifications/reglages', { methode: 'PATCH', corps: { [champ]: valeur } });
      rechargerConfig();
    } catch (err) {
      setErreurAction(err.message);
    }
  }
  const [recap, setRecap] = useState({ envoi: false, resultat: null });
  async function envoyerRecapitulatif() {
    setRecap({ envoi: true, resultat: null });
    setErreurAction(null);
    try {
      const resultat = await appelApi('/notifications/recapitulatif', {
        methode: 'POST',
        corps: { mois: config.moisRecapitulatif },
      });
      setRecap({ envoi: false, resultat });
      recharger();
    } catch (err) {
      setRecap({ envoi: false, resultat: null });
      setErreurAction(err.message);
    }
  }

  async function relancer(id) {
    await appelApi(`/notifications/${id}/relance`, { methode: 'POST' }).catch((err) =>
      setErreurAction(err.message),
    );
    recharger();
  }

  const c = donnees?.compteurs ?? {};
  return (
    <div className="space-y-6">
      <EnTetePage
        titre="SMS aux parents"
        description="Absences, notes du mois et bulletins sont signalés aux parents par SMS, même sans smartphone ni compte."
      />

      {config && (
        <section className="entree grid gap-6 lg:grid-cols-[1fr_1fr]" style={{ '--delai': '60ms' }}>
          <div className="divide-y divide-slate-100 rounded-2xl bg-white px-5 ring-1 ring-slate-200">
            <Interrupteur
              libelle="Absences et retards"
              description="Un SMS dès qu’une absence ou un retard est relevé à l’appel."
              actif={config.reglages.smsAbsences}
              desactive={!estDirection}
              onChange={(v) => regler('smsAbsences', v)}
            />
            <Interrupteur
              libelle="Récapitulatif mensuel des notes"
              description="Au début de chaque mois, les notes du mois écoulé par matière et la moyenne à ce jour."
              actif={config.reglages.smsRecapNotes}
              desactive={!estDirection}
              onChange={(v) => regler('smsRecapNotes', v)}
            />
            <Interrupteur
              libelle="Bulletins disponibles"
              description="Un SMS avec la moyenne, le rang et le numéro de vérification."
              actif={config.reglages.smsBulletins}
              desactive={!estDirection}
              onChange={(v) => regler('smsBulletins', v)}
            />
          </div>
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              Destinataires : le téléphone du parent enregistré sur la fiche de l’élève et les
              comptes parents reliés. Un même événement ne produit jamais deux SMS.
            </p>
            {estDirection && config.reglages.smsRecapNotes && (
              <div className="flex flex-wrap items-center gap-3">
                <Bouton
                  variante="secondaire"
                  icone={CalendarCheck}
                  chargement={recap.envoi}
                  onClick={envoyerRecapitulatif}
                >
                  Envoyer le récapitulatif de {nomMois(config.moisRecapitulatif)}
                </Bouton>
                {recap.resultat && (
                  <span className="text-sm text-marque-700">
                    {recap.resultat.smsEnFile
                      ? `${recap.resultat.smsEnFile} SMS préparés`
                      : 'Déjà envoyé à tous les parents'}
                  </span>
                )}
              </div>
            )}
            {config.fournisseur === 'journal' && (
              <Alerte type="info" titre="Aucun opérateur SMS raccordé">
                Les messages sont préparés et enregistrés ci-dessous, mais pas encore transmis : ils
                partiront dès le raccordement d’un opérateur.
              </Alerte>
            )}
          </div>
        </section>
      )}
      {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}

      <Onglets
        onglets={[
          ['', 'Tous', donnees?.total],
          ['ENVOYEE', config?.fournisseur === 'journal' ? 'Traités' : 'Envoyés', c.ENVOYEE ?? 0],
          ['EN_ATTENTE', 'En file', c.EN_ATTENTE ?? 0],
          ['ECHEC', 'Échecs', c.ECHEC ?? 0],
        ]}
        actif={statut}
        onChange={setStatut}
      />
      {erreur && <Alerte type="erreur">{erreur.message}</Alerte>}
      {chargement && <Chargement />}
      {donnees &&
        (donnees.notifications.length ? (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {donnees.notifications.map((n, i) => (
              <li
                key={n.id}
                className="ligne-note space-y-1 px-4 py-3"
                style={{ '--delai': `${Math.min(i, 25) * 20}ms` }}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-semibold">{n.eleve}</span>
                  <span className="chiffres text-slate-500">{formaterTelephone(n.telephone)}</span>
                  <span className="text-slate-400">
                    {formaterDate(n.envoyeeLe ?? n.creeLe, true)}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <Badge statut={n.statut} table={STATUTS} />
                    {n.statut === 'ECHEC' && estDirection && (
                      <button
                        type="button"
                        onClick={() => relancer(n.id)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                        aria-label="Relancer l’envoi"
                        title={n.derniereErreur}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{n.message}</p>
              </li>
            ))}
          </ul>
        ) : (
          <Alerte type="info">Aucun SMS pour le moment.</Alerte>
        ))}
    </div>
  );
}
