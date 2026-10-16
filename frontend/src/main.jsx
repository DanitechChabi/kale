import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App.jsx';
import ErreurApplication from './components/ErreurApplication.jsx';
import { FournisseurAuth } from './contexte/Auth.jsx';
import './index.css';

// Routeur « hash » (#/chemin) pour un hébergement statique sans réécriture d'URL
// (aperçu, GitHub Pages) ; routeur classique sinon.
const Routeur = import.meta.env.VITE_ROUTEUR === 'hash' ? HashRouter : BrowserRouter;

// Après une mise à jour du site, une page restée ouverte peut demander un fichier qui
// n'existe plus : on recharge une seule fois pour obtenir la nouvelle version.
window.addEventListener('vite:preloadError', (evenement) => {
  try {
    if (sessionStorage.getItem('edureleve:rechargement')) return;
    sessionStorage.setItem('edureleve:rechargement', '1');
  } catch {
    return;
  }
  evenement.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('racine')).render(
  <StrictMode>
    <ErreurApplication>
      <Routeur>
        <FournisseurAuth>
          <App />
        </FournisseurAuth>
      </Routeur>
    </ErreurApplication>
  </StrictMode>,
);
