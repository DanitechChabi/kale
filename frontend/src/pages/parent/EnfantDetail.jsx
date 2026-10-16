import { useParams, useSearchParams } from 'react-router-dom';
import EnTetePage from '../../components/EnTetePage.jsx';
import GrilleEmploiDuTemps from '../../components/GrilleEmploiDuTemps.jsx';
import SuiviScolarite from '../../components/SuiviScolarite.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import Onglets from '../../components/ui/Onglets.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { CoursClasse } from '../espace/MesCours.jsx';
import { DevoirsClasse } from '../espace/MesDevoirs.jsx';

function EmploiDuTempsEnfant({ id }) {
  const { donnees, erreur, chargement } = useRequete(`/parent/enfants/${id}/emploi-du-temps`);
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  return <GrilleEmploiDuTemps creneaux={donnees.creneaux} />;
}

/** Fiche d'un enfant : résultats, emploi du temps, devoirs et cours. */
export default function EnfantDetail() {
  const { id } = useParams();
  const [parametres, setParametres] = useSearchParams();
  const onglet = parametres.get('onglet') ?? 'suivi';
  const { donnees: suivi, erreur, chargement } = useRequete(`/parent/enfants/${id}`);
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  const base = `/parent/enfants/${id}`;
  return (
    <div className="space-y-6">
      <EnTetePage
        retour={{ vers: '/espace', libelle: 'Mes enfants' }}
        surtitre={[suivi.classe?.nom, suivi.anneeScolaire].filter(Boolean).join(' · ')}
        titre={`${suivi.eleve.prenoms} ${suivi.eleve.nom}`}
        description={suivi.ecole.nom}
      />
      <Onglets
        onglets={[
          ['suivi', 'Résultats'],
          ['devoirs', 'Devoirs'],
          ['emploi', 'Emploi du temps'],
          ['cours', 'Cours'],
        ]}
        actif={onglet}
        onChange={(v) => setParametres({ onglet: v }, { replace: true })}
      />
      {onglet === 'suivi' && (
        <SuiviScolarite suivi={suivi} cheminPdf={(d) => `${base}/documents/${d.id}/pdf`} />
      )}
      {onglet === 'devoirs' && (
        <DevoirsClasse
          chemin={`${base}/devoirs`}
          cheminFichier={(d) => `${base}/devoirs/${d.id}/fichier`}
        />
      )}
      {onglet === 'emploi' && <EmploiDuTempsEnfant id={id} />}
      {onglet === 'cours' && (
        <CoursClasse
          chemin={`${base}/cours`}
          cheminFichier={(c) => `${base}/cours/${c.id}/fichier`}
        />
      )}
    </div>
  );
}
