import { useState } from 'react';
import EnTetePage from '../../components/EnTetePage.jsx';
import ListeDevoirs from '../../components/ListeDevoirs.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import Onglets from '../../components/ui/Onglets.jsx';
import { useLectureHorsLigne } from '../../hooks/useLectureHorsLigne.js';
import { appelApi } from '../../lib/api.js';
import { dateLocale } from '../../lib/emploiDuTemps.js';
import { memoriser, mettreEnFile } from '../../lib/horsLigne.js';

/**
 * Cahier de textes de la classe. `basculer` : l'élève coche ses devoirs (même
 * hors connexion : la coche part au retour du réseau, l'API est idempotente).
 */
export function DevoirsClasse({ chemin, cheminFichier, basculer = false }) {
  const { donnees, erreur, chargement, horsLigne } = useLectureHorsLigne(chemin);
  const [faits, setFaits] = useState({}); // coches modifiées localement
  const [vue, setVue] = useState('aFaire');
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;

  const aujourdhui = dateLocale();
  const devoirs = donnees.devoirs.map((d) => ({ ...d, fait: faits[d.id] ?? d.fait }));
  const visibles = devoirs.filter((d) =>
    vue === 'aFaire' ? d.pourLe >= aujourdhui : d.pourLe < aujourdhui,
  );
  const aFaire = devoirs.filter((d) => d.pourLe >= aujourdhui && !d.fait).length;

  async function onBasculer(devoir) {
    const fait = !devoir.fait;
    setFaits((f) => ({ ...f, [devoir.id]: fait }));
    const envoi = { chemin: `/moi/devoirs/${devoir.id}/fait`, methode: 'PUT', corps: { fait } };
    // Copie locale à jour : la liste reste juste après une réouverture hors ligne
    memoriser(chemin, {
      devoirs: donnees.devoirs.map((d) => (d.id === devoir.id ? { ...d, fait } : d)),
    }).catch(() => {});
    try {
      await appelApi(envoi.chemin, { methode: envoi.methode, corps: envoi.corps });
    } catch (err) {
      if (err.code === 'RESEAU') {
        await mettreEnFile({
          ...envoi,
          cle: `devoir:${devoir.id}`,
          libelle: `Devoir « ${devoir.titre} »`,
        });
      } else {
        setFaits((f) => ({ ...f, [devoir.id]: !fait }));
      }
    }
  }

  return (
    <div className="space-y-4">
      {horsLigne && (
        <Alerte type="info">Hors connexion : cahier de textes enregistré sur ce téléphone.</Alerte>
      )}
      <Onglets
        onglets={[
          ['aFaire', 'À venir', aFaire],
          ['passes', 'Passés'],
        ]}
        actif={vue}
        onChange={setVue}
      />
      <ListeDevoirs
        devoirs={vue === 'passes' ? [...visibles].reverse() : visibles}
        cheminFichier={cheminFichier}
        onBasculer={basculer ? onBasculer : undefined}
      />
    </div>
  );
}

export default function MesDevoirs() {
  return (
    <div className="space-y-6">
      <EnTetePage
        titre="Devoirs"
        description="Le cahier de textes de votre classe. Cochez ce que vous avez fait."
      />
      <DevoirsClasse
        chemin="/moi/devoirs"
        cheminFichier={(d) => `/moi/devoirs/${d.id}/fichier`}
        basculer
      />
    </div>
  );
}
