// Pastilles de statut (vérification des établissements, documents).
const COULEURS = {
  gris: 'bg-slate-100 text-slate-700 ring-slate-200',
  bleu: 'bg-sky-50 text-sky-800 ring-sky-200',
  vert: 'bg-marque-50 text-marque-700 ring-marque-200',
  ambre: 'bg-amber-50 text-amber-800 ring-amber-200',
  rouge: 'bg-red-50 text-red-700 ring-red-200',
};

export const STATUTS_ECOLE = {
  EN_ATTENTE: ['En attente', 'ambre'],
  EN_EXAMEN: ['En examen', 'bleu'],
  VERIFIEE: ['Vérifié', 'vert'],
  REJETEE: ['Rejeté', 'rouge'],
  SUSPENDUE: ['Suspendu', 'gris'],
};

export const STATUTS_DOCUMENT = {
  EN_ATTENTE: ['À examiner', 'ambre'],
  ACCEPTE: ['Accepté', 'vert'],
  REFUSE: ['Refusé', 'rouge'],
};

export default function Badge({ statut, table }) {
  const [libelle, couleur] = table[statut] ?? [statut, 'gris'];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ${COULEURS[couleur]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {libelle}
    </span>
  );
}
