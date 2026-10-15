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
const AnneeScolaire = lazy(() => import('./pages/espace/AnneeScolaire.jsx'));
const Classes = lazy(() => import('./pages/espace/Classes.jsx'));
const ClasseDetail = lazy(() => import('./pages/espace/ClasseDetail.jsx'));
const Eleves = lazy(() => import('./pages/espace/Eleves.jsx'));
const EleveDetail = lazy(() => import('./pages/espace/EleveDetail.jsx'));
const ImportEleves = lazy(() => import('./pages/espace/ImportEleves.jsx'));
const Comptes = lazy(() => import('./pages/espace/Comptes.jsx'));
const Notes = lazy(() => import('./pages/espace/Notes.jsx'));
const NotesEnseignement = lazy(() => import('./pages/espace/NotesEnseignement.jsx'));
const SaisieNotes = lazy(() => import('./pages/espace/SaisieNotes.jsx'));
const Resultats = lazy(() => import('./pages/espace/Resultats.jsx'));
const Cloture = lazy(() => import('./pages/espace/Cloture.jsx'));

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
              <Route path="comptes" element={<Comptes />} />
              <Route path="annee" element={<AnneeScolaire />} />
              <Route path="cloture" element={<Cloture />} />
            </Route>
            <Route element={<RouteProtegee roles={['ADMIN_ECOLE', 'SECRETARIAT', 'ENSEIGNANT']} />}>
              <Route path="classes" element={<Classes />} />
              <Route path="classes/:id" element={<ClasseDetail />} />
              <Route path="eleves" element={<Eleves />} />
              <Route path="eleves/:id" element={<EleveDetail />} />
              <Route path="resultats" element={<Resultats />} />
            </Route>
            <Route element={<RouteProtegee roles={['ADMIN_ECOLE', 'ENSEIGNANT']} />}>
              <Route path="notes" element={<Notes />} />
              <Route path="notes/:id" element={<NotesEnseignement />} />
              <Route path="notes/evaluation/:id" element={<SaisieNotes />} />
            </Route>
            <Route element={<RouteProtegee roles={['ADMIN_ECOLE', 'SECRETARIAT']} />}>
              <Route path="import" element={<ImportEleves />} />
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
