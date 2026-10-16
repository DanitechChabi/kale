import { Component } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';

/**
 * Filet de sécurité : une erreur d'affichage ne laisse jamais un écran blanc.
 * Les saisies en cours (brouillons) restent sur l'appareil ; le message technique
 * est affiché pour pouvoir être transmis au support.
 */
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
          onClick={() => window.location.reload()}
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-marque-600 px-5 text-sm font-semibold text-white hover:bg-marque-700"
        >
          <RotateCcw className="h-4 w-4" /> Recharger la page
        </button>
        <p className="chiffres rounded-lg bg-slate-100 p-3 text-xs break-words text-slate-600">
          {navigator.userAgent}
          <br />
          {erreur.message}
        </p>
      </div>
    );
  }
}
