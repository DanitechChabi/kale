import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Gabarit from './components/Gabarit.jsx';
import RouteProtegee from './components/RouteProtegee.jsx';
import Chargement from './components/ui/Chargement.jsx';
import Accueil from './pages/Accueil.jsx';
import Connexion from './pages/Connexion.jsx';
import PageIntrouvable from './pages/PageIntrouvable.jsx';

// Pages chargées à la demande : la page d'accueil reste légère (data mobile chère)
const InscriptionEcole = lazy(() => import('./pages/InscriptionEcole.jsx'));
const EspaceGabarit = lazy(() => import('./components/EspaceGabarit.jsx'));
const TableauDeBord = lazy(() => import('./pages/espace/TableauDeBord.jsx'));
const MotDePasse = lazy(() => import('./pages/espace/MotDePasse.jsx'));
const Dossier = lazy(() => import('./pages/espace/Dossier.jsx'));
const Verification = lazy(() => import('./pages/espace/Verification.jsx'));
const VerificationDetail = lazy(() => import('./pages/espace/VerificationDetail.jsx'));

// Table des routes de l'application.
export default function App() {
  return (
    <Suspense fallback={<Chargement plein />}>
      <Routes>
        <Route element={<Gabarit />}>
          <Route index element={<Accueil />} />
          <Route path="inscription-ecole" element={<InscriptionEcole />} />
          <Route path="*" element={<PageIntrouvable />} />
        </Route>
        <Route path="connexion" element={<Connexion />} />

        {/* Espace connecté */}
        <Route path="espace" element={<RouteProtegee />}>
          <Route element={<EspaceGabarit />}>
            <Route index element={<TableauDeBord />} />
            <Route path="mot-de-passe" element={<MotDePasse />} />
            <Route element={<RouteProtegee roles={['ADMIN_ECOLE']} />}>
              <Route path="dossier" element={<Dossier />} />
            </Route>
            <Route element={<RouteProtegee roles={['SUPER_ADMIN', 'MINISTERE']} />}>
              <Route path="verification" element={<Verification />} />
              <Route path="verification/:id" element={<VerificationDetail />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
