import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { appelApi, definirJetonAcces, rafraichirSession, surPerteDeSession } from '../lib/api.js';
import { memoriser, relire, viderCopies } from '../lib/horsLigne.js';

// Profil gardé sur le téléphone : l'application s'ouvre même sans réseau
const CLE_PROFIL = 'session:profil';

// Contexte d'authentification : utilisateur connecté et actions de session.
const ContexteAuth = createContext(null);

export function FournisseurAuth({ children }) {
  const [etat, setEtat] = useState({ statut: 'chargement', utilisateur: null });

  const ouvrir = useCallback(({ jetonAcces, utilisateur }) => {
    definirJetonAcces(jetonAcces);
    setEtat({ statut: 'connecte', utilisateur, horsLigne: false });
    memoriser(CLE_PROFIL, utilisateur).catch(() => {});
    return utilisateur;
  }, []);

  const fermer = useCallback(() => {
    definirJetonAcces(null);
    setEtat({ statut: 'deconnecte', utilisateur: null });
  }, []);

  // Au chargement : reprise de la session grâce au cookie ; sans réseau,
  // ouverture avec le dernier profil connu (les données viennent des copies locales)
  useEffect(() => {
    surPerteDeSession(fermer);
    rafraichirSession().then(ouvrir, async (erreur) => {
      const profil = erreur.code === 'RESEAU' ? await relire(CLE_PROFIL).catch(() => null) : null;
      if (profil) setEtat({ statut: 'connecte', utilisateur: profil.donnees, horsLigne: true });
      else fermer();
    });
  }, [ouvrir, fermer]);

  // Session ouverte hors ligne : renouvelée dès le retour du réseau
  useEffect(() => {
    if (!etat.horsLigne) return undefined;
    const reprendre = () =>
      rafraichirSession().then(ouvrir, (e) => e.code !== 'RESEAU' && fermer());
    window.addEventListener('online', reprendre);
    return () => window.removeEventListener('online', reprendre);
  }, [etat.horsLigne, ouvrir, fermer]);

  const valeur = useMemo(
    () => ({
      ...etat,
      connexion: async (identifiant, motDePasse) =>
        ouvrir(
          await appelApi('/auth/connexion', {
            methode: 'POST',
            corps: { identifiant, motDePasse },
          }),
        ),
      deconnexion: async () => {
        await appelApi('/auth/deconnexion', { methode: 'POST' }).catch(() => {});
        await viderCopies().catch(() => {});
        fermer();
      },
      mettreAJourUtilisateur: (utilisateur) => setEtat((e) => ({ ...e, utilisateur })),
    }),
    [etat, ouvrir, fermer],
  );

  return <ContexteAuth.Provider value={valeur}>{children}</ContexteAuth.Provider>;
}

export function useAuth() {
  const contexte = useContext(ContexteAuth);
  if (!contexte) throw new Error('useAuth doit être utilisé dans <FournisseurAuth>');
  return contexte;
}

/** Libellés des rôles pour l'interface */
export const LIBELLES_ROLES = {
  SUPER_ADMIN: 'Administrateur de la plateforme',
  MINISTERE: 'Ministère',
  ADMIN_ECOLE: 'Responsable d’établissement',
  SECRETARIAT: 'Secrétariat',
  ENSEIGNANT: 'Enseignant',
  ELEVE: 'Élève',
  PARENT: 'Parent',
};
