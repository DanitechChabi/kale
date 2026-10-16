import { useState } from 'react';
import EnTetePage from '../../components/EnTetePage.jsx';
import ListeCours from '../../components/ListeCours.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import Onglets from '../../components/ui/Onglets.jsx';
import { useLectureHorsLigne } from '../../hooks/useLectureHorsLigne.js';

/** Cours de la classe, filtrables par matière. Réutilisé par l'espace parent. */
export function CoursClasse({ chemin, cheminFichier }) {
  const { donnees, erreur, chargement, horsLigne } = useLectureHorsLigne(chemin);
  const [matiere, setMatiere] = useState('');
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  const matieres = [...new Set(donnees.cours.map((c) => c.matiere))].sort();
  const visibles = donnees.cours.filter((c) => !matiere || c.matiere === matiere);
  return (
    <div className="space-y-4">
      {horsLigne && (
        <Alerte type="info">Hors connexion : liste enregistrée sur ce téléphone.</Alerte>
      )}
      {matieres.length > 1 && (
        <Onglets
          onglets={[['', 'Toutes'], ...matieres.map((m) => [m, m])]}
          actif={matiere}
          onChange={setMatiere}
        />
      )}
      <ListeCours cours={visibles} cheminFichier={cheminFichier} afficherMatiere={!matiere} />
    </div>
  );
}

export default function MesCours() {
  return (
    <div className="space-y-6">
      <EnTetePage titre="Cours" description="Les supports publiés par vos professeurs." />
      <CoursClasse chemin="/moi/cours" cheminFichier={(c) => `/moi/cours/${c.id}/fichier`} />
    </div>
  );
}
