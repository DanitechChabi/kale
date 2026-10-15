import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Boîte de dialogue modale (élément <dialog> natif : focus, Échap et
 * accessibilité gérés par le navigateur). Plein écran sur téléphone.
 */
export default function Dialogue({ ouvert, onFermer, titre, children, large = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialogue = ref.current;
    if (!dialogue) return;
    if (ouvert && !dialogue.open) dialogue.showModal?.();
    if (!ouvert && dialogue.open) dialogue.close?.();
  }, [ouvert]);

  if (!ouvert) return null;
  return (
    <dialog
      ref={ref}
      open={
        typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal
          ? true
          : undefined
      }
      onClose={onFermer}
      onCancel={(e) => {
        e.preventDefault();
        onFermer();
      }}
      className={`dialogue m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-white p-0 text-slate-900 backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm sm:m-auto sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl sm:shadow-2xl ${
        large ? 'sm:max-w-3xl' : 'sm:max-w-lg'
      }`}
      aria-labelledby="titre-dialogue"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
        <h2 id="titre-dialogue" className="text-lg font-semibold">
          {titre}
        </h2>
        <button
          type="button"
          onClick={onFermer}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
