import { Check, X } from 'lucide-react';

// Frise du circuit de vérification d'un établissement.
const ETAPES = ['Dossier déposé', 'Examen par le ministère', 'Établissement vérifié'];

function indexEtape(statut) {
  return { EN_ATTENTE: 1, EN_EXAMEN: 1, VERIFIEE: 3, REJETEE: 1, SUSPENDUE: 3 }[statut] ?? 0;
}

export default function EtapesVerification({ statut }) {
  const courante = indexEtape(statut);
  const rejet = statut === 'REJETEE';
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Avancement de la vérification">
      {ETAPES.map((libelle, i) => {
        const faite = i < courante;
        const enCours = i === courante && !rejet;
        const echec = rejet && i === 1;
        return (
          <li key={libelle} className="space-y-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full origin-left rounded-full transition-transform duration-700 ${
                  echec ? 'bg-rouge' : 'bg-marque-500'
                } ${faite || echec ? 'scale-x-100' : enCours ? 'scale-x-50' : 'scale-x-0'}`}
                style={{ transitionDelay: `${i * 150}ms` }}
              />
            </div>
            <p
              className={`flex items-center gap-1 text-xs font-medium sm:text-sm ${faite ? 'text-marque-700' : echec ? 'text-rouge' : 'text-slate-500'}`}
            >
              {faite && <Check className="h-3.5 w-3.5 shrink-0" />}
              {echec && <X className="h-3.5 w-3.5 shrink-0" />}
              {echec ? 'Dossier rejeté' : libelle}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
