import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import Alerte from '../ui/Alerte.jsx';

/**
 * Mot de passe temporaire remis une seule fois par le fournisseur. Il n'est conservé
 * que dans l'état de la page : il disparaît à la fermeture.
 */
export default function MotDePasseTemporaire({ valeur, simule }) {
  const [copie, setCopie] = useState(false);
  return (
    <div className="space-y-3">
      <Alerte type="attention" titre="Notez-le maintenant">
        Ce mot de passe temporaire ne sera plus affiché. Changez-le dès votre première connexion à
        la messagerie.
      </Alerte>
      {simule && (
        <Alerte type="info">
          Service en simulation : ce mot de passe n’ouvre aucune boîte réelle.
        </Alerte>
      )}
      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-3 ring-1 ring-slate-200">
        <code className="chiffres min-w-0 flex-1 text-lg break-all">{valeur}</code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(valeur);
            setCopie(true);
          }}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-200"
          aria-label="Copier le mot de passe temporaire"
        >
          {copie ? <Check className="h-4 w-4 text-marque-700" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
