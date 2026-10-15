import { useState } from 'react';
import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { useConnexion } from '../hooks/useConnexion.js';

/** Pastille d'en-tête : hors connexion, envois en attente ou en erreur. */
export default function EtatSynchronisation() {
  const { enLigne, enAttente, enErreur, synchroniser } = useConnexion();
  const [envoi, setEnvoi] = useState(false);
  if (enLigne && !enAttente) return null;

  async function relancer() {
    setEnvoi(true);
    await synchroniser().catch(() => {});
    setEnvoi(false);
  }

  const couleur = enErreur
    ? 'bg-red-50 text-red-800 ring-red-200'
    : !enLigne
      ? 'bg-slate-900 text-white ring-slate-900'
      : 'bg-amber-50 text-amber-900 ring-amber-200';
  const Icone = enErreur ? TriangleAlert : !enLigne ? CloudOff : RefreshCw;
  const texte = !enLigne
    ? `Hors connexion${enAttente ? ` · ${enAttente} en attente` : ''}`
    : enErreur
      ? `${enErreur} envoi${enErreur > 1 ? 's' : ''} refusé${enErreur > 1 ? 's' : ''}`
      : `${enAttente} envoi${enAttente > 1 ? 's' : ''} en attente`;

  return (
    <button
      type="button"
      onClick={relancer}
      disabled={!enLigne || envoi}
      className={`entree inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ${couleur}`}
      title={`${texte}. ${enLigne ? 'Toucher pour envoyer maintenant.' : 'Envoi automatique au retour du réseau.'}`}
      aria-label={texte}
    >
      <Icone className={`h-3.5 w-3.5 ${envoi ? 'animate-spin' : ''}`} aria-hidden="true" />
      {/* Téléphone : icône et nombre ; écran large : texte complet */}
      <span className="chiffres sm:hidden">{enAttente || ''}</span>
      <span className="hidden sm:inline">{texte}</span>
    </button>
  );
}
