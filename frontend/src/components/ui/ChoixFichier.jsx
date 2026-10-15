import { useRef, useState } from 'react';
import { FileUp, Paperclip, Trash2 } from 'lucide-react';
import { controlerFichier, TYPES_ACCEPTES } from '../../lib/documents.js';
import { formaterTaille } from '../../lib/navigation.js';

/**
 * Sélecteur de fichier (PDF, JPEG, PNG ; 5 Mo). Le contrôle de format et de
 * taille est fait avant l'envoi pour éviter de consommer de la data pour rien.
 */
export default function ChoixFichier({ fichier, onChange, libelle, erreur }) {
  const entree = useRef(null);
  const [erreurLocale, setErreurLocale] = useState(null);
  const message = erreurLocale ?? erreur;

  function choisir(e) {
    const choisi = e.target.files[0];
    e.target.value = '';
    if (!choisi) return;
    const probleme = controlerFichier(choisi);
    setErreurLocale(probleme);
    if (!probleme) onChange(choisi);
  }

  return (
    <div className="space-y-2">
      <input
        ref={entree}
        type="file"
        accept={TYPES_ACCEPTES}
        className="sr-only"
        onChange={choisir}
        aria-label={libelle}
      />
      {fichier ? (
        <div className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
          <Paperclip className="h-4 w-4 shrink-0 text-marque-600" />
          <span className="min-w-0 flex-1 truncate text-sm">{fichier.name}</span>
          <span className="text-xs text-slate-500 tabular-nums">
            {formaterTaille(fichier.size)}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded p-1 text-slate-400 hover:text-rouge"
            aria-label="Retirer le fichier"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => entree.current.click()}
          className="flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg border-2 border-dashed border-slate-300 bg-white px-3 py-4 text-sm font-semibold text-slate-600 transition hover:border-marque-400 hover:bg-marque-50/50 hover:text-marque-700"
        >
          <FileUp className="h-5 w-5" /> Choisir un fichier
          <span className="font-normal text-slate-400">PDF, JPEG, PNG · 5 Mo</span>
        </button>
      )}
      {message && <p className="text-sm text-rouge">{message}</p>}
    </div>
  );
}
