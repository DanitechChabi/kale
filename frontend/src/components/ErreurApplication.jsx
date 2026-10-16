import { Component } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';

/**
 * Filet de sécurité : une erreur d'affichage ne laisse jamais un écran blanc.
 * Les saisies en cours (brouillons) restent sur l'appareil ; le message technique
 * est affiché pour pouvoir être transmis au support.
 */
/** Premier emplacement de la pile (fichier:ligne:colonne), pour situer l'erreur. */
function origineErreur(erreur) {
  const ligne = (erreur?.stack ?? '')
    .split('\n')
    .map((l) => /([^/\s(]+\.m?jsx?(?:\?[^:]*)?:\d+:\d+)/.exec(l)?.[1])
    .find(Boolean);
  return ligne ?? '';
}

/**
 * Recharge en repartant d'une version propre : désinscrit le service worker et vide
 * le cache des fichiers de l'application (une version ancienne restée sur le
 * téléphone peut se mélanger à la nouvelle après une mise à jour). Les brouillons
 * et la file d'envoi (IndexedDB) ne sont pas touchés.
 */
async function reparerEtRecharger() {
  try {
    const inscriptions = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(inscriptions.map((i) => i.unregister()));
    const caches = window.caches ? await window.caches.keys() : [];
    await Promise.all(caches.map((cle) => window.caches.delete(cle)));
  } catch {
    // Rien à nettoyer ou accès refusé : le rechargement simple reste possible
  }
  window.location.reload();
}

export default class ErreurApplication extends Component {
  state = { erreur: null };

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur, info) {
    console.error('Erreur d’affichage', erreur, info?.componentStack);
  }

  render() {
    const { erreur } = this.state;
    if (!erreur) return this.props.children;
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-6 py-12">
        <TriangleAlert className="h-10 w-10 text-sceau" aria-hidden="true" />
        <h1 className="text-2xl font-bold tracking-tight">Un problème d’affichage est survenu</h1>
        <p className="text-slate-600">
          Vos informations déjà saisies sont conservées sur cet appareil. Rechargez la page pour
          reprendre où vous en étiez.
        </p>
        <button
          type="button"
          onClick={reparerEtRecharger}
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-marque-600 px-5 text-sm font-semibold text-white hover:bg-marque-700"
        >
          <RotateCcw className="h-4 w-4" /> Recharger la page
        </button>
        <p className="chiffres rounded-lg bg-slate-100 p-3 text-xs break-words text-slate-600">
          {window.location.pathname}
          <br />
          {erreur.message}
          <br />
          {origineErreur(erreur)}
          <br />
          {navigator.userAgent}
        </p>
      </div>
    );
  }
}
