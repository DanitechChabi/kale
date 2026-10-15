import { Eye, FileText, Image } from 'lucide-react';
import Badge, { STATUTS_DOCUMENT } from './ui/Badge.jsx';
import { LIBELLES_PIECES, ouvrirDocument } from '../lib/documents.js';
import { formaterDate, formaterTaille } from '../lib/navigation.js';

/**
 * Liste des pièces d'un dossier. `actions(document)` permet d'ajouter des
 * boutons (examen par le ministère).
 */
export default function ListeDocuments({ documents, cheminFichier, actions }) {
  if (!documents.length) return <p className="text-sm text-slate-500">Aucun document déposé.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {documents.map((document) => {
        const IconeFichier = document.typeMime === 'application/pdf' ? FileText : Image;
        return (
          <li
            key={document.id}
            className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex min-w-0 gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <IconeFichier className="h-5 w-5" />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-slate-900">{LIBELLES_PIECES[document.type]}</p>
                <p className="truncate text-sm text-slate-500">
                  {document.nomFichier} · {formaterTaille(document.tailleOctets)} · déposé le{' '}
                  {formaterDate(document.deposeLe)}
                </p>
                {document.referenceActe && (
                  <p className="text-sm text-slate-500">
                    Réf. {document.referenceActe}
                    {document.dateActe && ` du ${formaterDate(document.dateActe)}`}
                  </p>
                )}
                {document.commentaire && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                    {document.commentaire}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              <Badge statut={document.statut} table={STATUTS_DOCUMENT} />
              <button
                type="button"
                onClick={() => ouvrirDocument(cheminFichier(document.id))}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-marque-700 hover:bg-marque-50"
              >
                <Eye className="h-4 w-4" /> Consulter
              </button>
              {actions?.(document)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
