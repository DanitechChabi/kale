import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexte/Auth.jsx';
import Chargement from './ui/Chargement.jsx';

/**
 * Protège un groupe de routes : connexion obligatoire, rôles autorisés,
 * et passage forcé par le changement de mot de passe temporaire.
 */
export default function RouteProtegee({ roles }) {
  const { statut, utilisateur } = useAuth();
  const location = useLocation();

  if (statut === 'chargement') return <Chargement plein texte="Ouverture de votre espace…" />;
  if (statut !== 'connecte') {
    return <Navigate to="/connexion" replace state={{ depuis: location.pathname }} />;
  }
  if (utilisateur.doitChangerMotDePasse && location.pathname !== '/espace/mot-de-passe') {
    return <Navigate to="/espace/mot-de-passe" replace />;
  }
  if (roles && !roles.includes(utilisateur.role)) return <Navigate to="/espace" replace />;
  return <Outlet />;
}
