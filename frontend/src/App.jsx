import { Route, Routes } from 'react-router-dom';
import Gabarit from './components/Gabarit.jsx';
import Accueil from './pages/Accueil.jsx';
import PageIntrouvable from './pages/PageIntrouvable.jsx';

// Table des routes de l'application.
// Phases suivantes : /connexion, /ecole, /eleve, /parent, /ministere, /verifier/:numero…
export default function App() {
  return (
    <Routes>
      <Route element={<Gabarit />}>
        <Route index element={<Accueil />} />
        <Route path="*" element={<PageIntrouvable />} />
      </Route>
    </Routes>
  );
}
