import { useParams } from 'react-router-dom';
import EnTetePage from '../../components/EnTetePage.jsx';
import SuiviScolarite from '../../components/SuiviScolarite.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { useRequete } from '../../hooks/useRequete.js';

export default function EnfantDetail() {
  const { id } = useParams();
  const { donnees: suivi, erreur, chargement } = useRequete(`/parent/enfants/${id}`);
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  return (
    <div className="space-y-6">
      <EnTetePage
        retour={{ vers: '/espace', libelle: 'Mes enfants' }}
        surtitre={[suivi.classe?.nom, suivi.anneeScolaire].filter(Boolean).join(' · ')}
        titre={`${suivi.eleve.prenoms} ${suivi.eleve.nom}`}
        description={suivi.ecole.nom}
      />
      <SuiviScolarite
        suivi={suivi}
        cheminPdf={(d) => `/parent/enfants/${id}/documents/${d.id}/pdf`}
      />
    </div>
  );
}
