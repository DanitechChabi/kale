import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, FileText, ImagePlus, Send, X } from 'lucide-react';
import Alerte from './ui/Alerte.jsx';
import Bouton from './ui/Bouton.jsx';
import Dialogue from './ui/Dialogue.jsx';
import { appelApi } from '../lib/api.js';
import { compresserImage } from '../lib/images.js';
import { formaterTaille } from '../lib/navigation.js';

const PAGES_MAX = 5;
const TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

/** Aperçu d'une page choisie (miniature pour une photo, icône pour un PDF). */
function Apercu({ fichier, numero, onRetirer }) {
  // Adresse locale de la miniature, libérée quand la page est retirée
  const url = useMemo(
    () => (fichier.type.startsWith('image/') ? URL.createObjectURL(fichier) : null),
    [fichier],
  );
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  return (
    <li className="relative overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
      {url ? (
        <img src={url} alt={`Page ${numero}`} className="h-28 w-full object-cover" />
      ) : (
        <span className="flex h-28 flex-col items-center justify-center gap-1 text-slate-500">
          <FileText className="h-8 w-8" /> <span className="text-xs">PDF</span>
        </span>
      )}
      <span className="chiffres absolute bottom-1 left-1 rounded bg-encre/80 px-1.5 text-xs text-white">
        {numero} · {formaterTaille(fichier.size)}
      </span>
      <button
        type="button"
        onClick={onRetirer}
        className="absolute top-1 right-1 rounded-full bg-white/90 p-1 text-slate-700 shadow"
        aria-label={`Retirer la page ${numero}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

/** L'élève rend sa copie : photos des pages (appareil photo) ou PDF. */
export default function DialogueCopie({ devoir, onFermer, onRendu }) {
  const [pages, setPages] = useState([]);
  const [commentaire, setCommentaire] = useState('');
  const [etat, setEtat] = useState({ envoi: false, erreur: null, preparation: false });
  const photo = useRef(null);
  const fichiers = useRef(null);

  async function ajouter(liste) {
    const choisis = [...liste].filter((f) => TYPES.includes(f.type));
    if (choisis.length < liste.length) {
      setEtat((e) => ({ ...e, erreur: 'Seuls les photos (JPEG, PNG) et les PDF sont acceptés' }));
    }
    setEtat((e) => ({ ...e, preparation: true }));
    const prets = await Promise.all(choisis.map(compresserImage));
    setPages((p) => [...p, ...prets].slice(0, PAGES_MAX));
    setEtat((e) => ({ ...e, preparation: false }));
  }

  async function envoyer() {
    setEtat({ envoi: true, erreur: null, preparation: false });
    const formulaire = new FormData();
    pages.forEach((f, i) => formulaire.append('pages', f, f.name || `page-${i + 1}`));
    if (commentaire.trim()) formulaire.append('commentaire', commentaire.trim());
    try {
      const { rendu } = await appelApi(`/moi/devoirs/${devoir.id}/copie`, {
        methode: 'PUT',
        corps: formulaire,
      });
      onRendu(rendu);
    } catch (err) {
      setEtat({
        envoi: false,
        preparation: false,
        erreur:
          err.code === 'RESEAU'
            ? 'Pas de connexion : réessayez quand le réseau revient (vos pages restent ici).'
            : err.message,
      });
    }
  }

  const total = pages.reduce((s, f) => s + f.size, 0);
  return (
    <Dialogue ouvert onFermer={onFermer} titre="Rendre ma copie">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{devoir.titre}</span>
          {devoir.rendu && ' · ce nouvel envoi remplacera la copie déjà rendue.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Bouton
            variante="secondaire"
            icone={Camera}
            disabled={pages.length >= PAGES_MAX}
            onClick={() => photo.current?.click()}
          >
            Photographier
          </Bouton>
          <Bouton
            variante="secondaire"
            icone={ImagePlus}
            disabled={pages.length >= PAGES_MAX}
            onClick={() => fichiers.current?.click()}
          >
            Choisir
          </Bouton>
          <input
            ref={photo}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label="Photographier une page"
            onChange={(e) => {
              ajouter(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={fichiers}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            multiple
            className="sr-only"
            aria-label="Choisir des photos ou un PDF"
            onChange={(e) => {
              ajouter(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
        {pages.length > 0 ? (
          <ol className="grid grid-cols-3 gap-2">
            {pages.map((f, i) => (
              <Apercu
                key={`${f.name}-${i}`}
                fichier={f}
                numero={i + 1}
                onRetirer={() => setPages((p) => p.filter((_, k) => k !== i))}
              />
            ))}
          </ol>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-sm text-slate-500">
            Photographiez chaque page de votre cahier, dans l’ordre (5 pages au plus).
          </p>
        )}
        <textarea
          aria-label="Message au professeur"
          rows={2}
          maxLength={500}
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          placeholder="Un mot pour le professeur (facultatif)"
          className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base sm:text-sm"
        />
        {etat.erreur && <Alerte type="erreur">{etat.erreur}</Alerte>}
        <div className="flex items-center justify-between gap-3">
          <span className="chiffres text-xs text-slate-500">
            {pages.length}/{PAGES_MAX} · {formaterTaille(total || 1)}
          </span>
          <Bouton
            icone={Send}
            chargement={etat.envoi || etat.preparation}
            disabled={!pages.length}
            onClick={envoyer}
          >
            Envoyer
          </Bouton>
        </div>
      </div>
    </Dialogue>
  );
}
