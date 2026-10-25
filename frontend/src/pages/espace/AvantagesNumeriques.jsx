import { ExternalLink } from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { useRequete } from '../../hooks/useRequete.js';

/**
 * Services éducatifs accessibles aux élèves : liens officiels uniquement, conditions
 * d'accès fixées par chaque service. Aucun partenariat n'est revendiqué.
 */
export default function AvantagesNumeriques() {
  const { donnees, erreur, chargement } = useRequete('/edumail/avantages');
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  return (
    <div className="space-y-6">
      <EnTetePage
        retour={{ vers: '/espace/edumail', libelle: 'Mon compte EduMail' }}
        titre="Avantages numériques"
        description="Des services éducatifs que vous pouvez découvrir. Chacun fixe ses propres conditions d’accès."
      />
      <Alerte type="info">{donnees.avertissement}</Alerte>
      <ul className="grid gap-4 sm:grid-cols-2">
        {donnees.services.map((s) => (
          <li
            key={s.id}
            className="flex flex-col gap-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200"
          >
            <div>
              <h2 className="font-semibold">{s.nom}</h2>
              <p className="text-xs text-slate-500">
                {s.categorie} · vérification : {s.verification.toLowerCase()}
              </p>
            </div>
            <p className="text-sm text-slate-700">{s.description}</p>
            {s.conditions && (
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">Conditions : </span>
                {s.conditions}
              </p>
            )}
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-marque-700 hover:underline"
            >
              Site officiel <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
