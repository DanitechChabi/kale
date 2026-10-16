import EnTetePage from '../../components/EnTetePage.jsx';
import SuiviScolarite from '../../components/SuiviScolarite.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { useRequete } from '../../hooks/useRequete.js';

/** L'élève suit ses notes, moyennes et absences. */
export default function MesNotes() {
  const { donnees: suivi, erreur, chargement } = useRequete('/moi/suivi');
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  return (
    <div className="space-y-6">
      <EnTetePage
        surtitre={[suivi.classe?.nom, suivi.anneeScolaire].filter(Boolean).join(' · ')}
        titre="Mes notes"
        description="Chaque note saisie par vos professeurs, vos moyennes et vos absences."
      />
      <SuiviScolarite suivi={suivi} cheminPdf={(d) => `/releves/mes-documents/${d.id}/pdf`} />
    </div>
  );
}
