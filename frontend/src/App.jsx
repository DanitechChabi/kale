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
const DemandeDuplicata = lazy(() => import('./pages/DemandeDuplicata.jsx'));
const SuiviDuplicata = lazy(() => import('./pages/SuiviDuplicata.jsx'));
const ActivationParent = lazy(() => import('./pages/ActivationParent.jsx'));
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
const Bulletins = lazy(() => import('./pages/espace/Bulletins.jsx'));
const Duplicatas = lazy(() => import('./pages/espace/Duplicatas.jsx'));
const DuplicataDetail = lazy(() => import('./pages/espace/DuplicataDetail.jsx'));
const MesDocuments = lazy(() => import('./pages/espace/MesDocuments.jsx'));
const MesNotes = lazy(() => import('./pages/espace/MesNotes.jsx'));
const Appel = lazy(() => import('./pages/espace/Appel.jsx'));
const Absences = lazy(() => import('./pages/espace/Absences.jsx'));
const Notifications = lazy(() => import('./pages/espace/Notifications.jsx'));
const Ussd = lazy(() => import('./pages/espace/Ussd.jsx'));
const EnfantDetail = lazy(() => import('./pages/parent/EnfantDetail.jsx'));
const Messages = lazy(() => import('./pages/parent/Messages.jsx'));
const EmploiDuTemps = lazy(() => import('./pages/espace/EmploiDuTemps.jsx'));
const CoursEnseignant = lazy(() => import('./pages/espace/CoursEnseignant.jsx'));
const MesCours = lazy(() => import('./pages/espace/MesCours.jsx'));
const MesDevoirs = lazy(() => import('./pages/espace/MesDevoirs.jsx'));
const PresentationEduCourses = lazy(() => import('./pages/educourses/Presentation.jsx'));
const Apprenants = lazy(() => import('./pages/educourses/Apprenants.jsx'));
const TableauApprenant = lazy(() => import('./pages/educourses/TableauApprenant.jsx'));
const ProgrammeEduCourses = lazy(() => import('./pages/educourses/Programme.jsx'));
const Lecon = lazy(() => import('./pages/educourses/Lecon.jsx'));
const TableauMinistere = lazy(() => import('./pages/espace/TableauMinistere.jsx'));
const MonEduMail = lazy(() => import('./pages/espace/MonEduMail.jsx'));
const AvantagesNumeriques = lazy(() => import('./pages/espace/AvantagesNumeriques.jsx'));
const EduMailEcole = lazy(() => import('./pages/espace/EduMailEcole.jsx'));
const EduMailDossier = lazy(() => import('./pages/espace/EduMailDossier.jsx'));
const EduMailNational = lazy(() => import('./pages/espace/EduMailNational.jsx'));

// Table des routes de l'application.
export default function App() {
  return (
    <Suspense fallback={<Chargement plein />}>
      <Routes>
        <Route element={<Gabarit />}>
          <Route index element={<Accueil />} />
          <Route path="inscription-ecole" element={<InscriptionEcole />} />
          <Route path="duplicata" element={<DemandeDuplicata />} />
          <Route path="duplicata/suivi" element={<SuiviDuplicata />} />
          <Route path="parents" element={<ActivationParent />} />
          <Route path="educourses" element={<PresentationEduCourses />} />
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
              <Route path="bulletins" element={<Bulletins />} />
              <Route path="duplicatas" element={<Duplicatas />} />
              <Route path="duplicatas/:id" element={<DuplicataDetail />} />
              <Route path="edumail/etablissement" element={<EduMailEcole />} />
              <Route path="edumail/dossiers/:id" element={<EduMailDossier />} />
            </Route>
            <Route element={<RouteProtegee roles={['ELEVE']} />}>
              <Route path="mes-documents" element={<MesDocuments />} />
              <Route path="mes-notes" element={<MesNotes />} />
              <Route path="mes-cours" element={<MesCours />} />
              <Route path="devoirs" element={<MesDevoirs />} />
              <Route path="edumail" element={<MonEduMail />} />
              <Route path="avantages-numeriques" element={<AvantagesNumeriques />} />
            </Route>
            <Route element={<RouteProtegee roles={['ELEVE', 'PARENT']} />}>
              <Route path="educourses" element={<Apprenants />} />
              <Route path="educourses/:profilId" element={<TableauApprenant />} />
              <Route
                path="educourses/:profilId/programmes/:programmeId"
                element={<ProgrammeEduCourses />}
              />
              <Route path="educourses/:profilId/lecons/:leconId" element={<Lecon />} />
            </Route>
            <Route element={<RouteProtegee roles={['PARENT']} />}>
              <Route path="enfants/:id" element={<EnfantDetail />} />
              <Route path="messages" element={<Messages />} />
            </Route>
            <Route element={<RouteProtegee roles={['ADMIN_ECOLE', 'SECRETARIAT', 'ENSEIGNANT']} />}>
              <Route path="appel" element={<Appel />} />
            </Route>
            <Route
              element={
                <RouteProtegee roles={['ADMIN_ECOLE', 'SECRETARIAT', 'ENSEIGNANT', 'ELEVE']} />
              }
            >
              <Route path="emploi-du-temps" element={<EmploiDuTemps />} />
            </Route>
            <Route element={<RouteProtegee roles={['ENSEIGNANT']} />}>
              <Route path="cours" element={<CoursEnseignant />} />
            </Route>
            <Route element={<RouteProtegee roles={['ADMIN_ECOLE', 'SECRETARIAT']} />}>
              <Route path="absences" element={<Absences />} />
              <Route path="sms" element={<Notifications />} />
            </Route>
            <Route element={<RouteProtegee roles={['SUPER_ADMIN']} />}>
              <Route path="ussd" element={<Ussd />} />
            </Route>
            <Route element={<RouteProtegee roles={['SUPER_ADMIN', 'MINISTERE']} />}>
              <Route path="tableau-de-bord" element={<TableauMinistere />} />
              <Route path="edumail/national" element={<EduMailNational />} />
              <Route path="verification" element={<Verification />} />
              <Route path="verification/:id" element={<VerificationDetail />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
