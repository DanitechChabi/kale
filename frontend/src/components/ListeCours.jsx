import { ExternalLink, FileText, Link2, PlayCircle, Trash2 } from 'lucide-react';
import { ouvrirDocument } from '../lib/documents.js';
import { formaterDate, formaterTaille } from '../lib/navigation.js';

const ICONES = { DOCUMENT: FileText, VIDEO: PlayCircle, LIEN: Link2 };

/**
 * Supports de cours. `cheminFichier(cours)` : adresse API du document selon
 * l'espace ; `onRetirer` : bouton de retrait (enseignant).
 */
export default function ListeCours({ cours, cheminFichier, onRetirer, afficherMatiere = true }) {
  if (!cours.length) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">Aucun cours publié pour le moment.</p>
    );
  }
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
      {cours.map((c, i) => {
        const Icone = ICONES[c.type];
        return (
          <li
            key={c.id}
            className="ligne-note flex gap-3 px-4 py-3"
            style={{ '--delai': `${Math.min(i, 20) * 30}ms` }}
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-marque-50 text-marque-700">
              <Icone className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="font-semibold">{c.titre}</p>
              <p className="text-xs text-slate-500">
                {afficherMatiere && c.matiere && `${c.matiere} · `}
                {formaterDate(c.publieLe)}
                {c.auteur && ` · ${c.auteur.prenoms[0]}. ${c.auteur.nom}`}
                {c.fichier && ` · ${formaterTaille(c.fichier.tailleOctets)}`}
              </p>
              {c.description && (
                <p className="text-sm whitespace-pre-line text-slate-600">{c.description}</p>
              )}
            </div>
            <div className="flex shrink-0 items-start gap-1">
              {c.type === 'DOCUMENT' ? (
                <button
                  type="button"
                  onClick={() => ouvrirDocument(cheminFichier(c))}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-marque-700 hover:bg-marque-50"
                >
                  <FileText className="h-4 w-4" /> Ouvrir
                </button>
              ) : (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-marque-700 hover:bg-marque-50"
                >
                  <ExternalLink className="h-4 w-4" /> {c.type === 'VIDEO' ? 'Regarder' : 'Ouvrir'}
                </a>
              )}
              {onRetirer && (
                <button
                  type="button"
                  onClick={() => onRetirer(c)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-rouge"
                  aria-label={`Retirer ${c.titre}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
