import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

// Routeur « hash » (#/chemin) pour un hébergement statique sans réécriture d'URL
// (aperçu, GitHub Pages) ; routeur classique sinon.
const Routeur = import.meta.env.VITE_ROUTEUR === 'hash' ? HashRouter : BrowserRouter;

createRoot(document.getElementById('racine')).render(
  <StrictMode>
    <Routeur>
      <App />
    </Routeur>
  </StrictMode>,
);
