import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { appelApi, definirJetonAcces, rafraichirSession, surPerteDeSession } from '../lib/api.js';

// Contexte d'authentification : utilisateur connecté et actions de session.
const ContexteAuth = createContext(null);

export function FournisseurAuth({ children }) {
  const [etat, setEtat] = useState({ statut: 'chargement', utilisateur: null });

  const ouvrir = useCallback(({ jetonAcces, utilisateur }) => {
    definirJetonAcces(jetonAcces);
    setEtat({ statut: 'connecte', utilisateur });
    return utilisateur;
  }, []);

  const fermer = useCallback(() => {
    definirJetonAcces(null);
    setEtat({ statut: 'deconnecte', utilisateur: null });
  }, []);

  // Au chargement : reprise de la session existante grâce au cookie
  useEffect(() => {
    surPerteDeSession(fermer);
    rafraichirSession().then(ouvrir, fermer);
  }, [ouvrir, fermer]);

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
