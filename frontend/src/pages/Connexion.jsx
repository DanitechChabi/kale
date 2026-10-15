import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, ShieldCheck } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import Alerte from '../components/ui/Alerte.jsx';
import Bouton from '../components/ui/Bouton.jsx';
import { Champ, ChampMotDePasse } from '../components/ui/Champ.jsx';
import { useAuth } from '../contexte/Auth.jsx';
import { accueilSelonRole } from '../lib/navigation.js';

export default function Connexion() {
  const { connexion, statut, utilisateur } = useAuth();
  const naviguer = useNavigate();
  const { state } = useLocation();
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  if (statut === 'connecte') return <Navigate to={accueilSelonRole(utilisateur)} replace />;

  async function soumettre(e) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      const compte = await connexion(identifiant, motDePasse);
      const destination = compte.doitChangerMotDePasse
        ? accueilSelonRole(compte)
        : (state?.depuis ?? accueilSelonRole(compte));
      naviguer(destination, { replace: true });
    } catch (err) {
      setErreur(err);
      setEnvoi(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Panneau de marque (ordinateur) */}
      <aside className="relative isolate hidden overflow-hidden bg-gradient-to-br from-marque-700 via-marque-600 to-marque-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="aurore aurore-1" />
          <div className="aurore aurore-2" />
          <div className="quadrillage absolute inset-0" />
        </div>
        <Link to="/" aria-label="EduRelevé — accueil" className="entree">
          <Logo inverse />
        </Link>
        <div className="max-w-md space-y-4">
          <p
            className="entree text-3xl leading-tight font-bold tracking-tight"
            style={{ '--delai': '150ms' }}
          >
            Chaque relevé archivé, <span className="text-or">vérifiable partout.</span>
          </p>
          <p className="entree text-marque-100" style={{ '--delai': '300ms' }}>
            Établissements, enseignants, élèves, parents et ministère travaillent sur les mêmes
            données, chacun dans son espace.
          </p>
        </div>
        <p
          className="entree flex items-center gap-2 text-sm text-marque-100"
          style={{ '--delai': '450ms' }}
        >
          <ShieldCheck className="h-4 w-4 text-or" /> Connexion chiffrée, sessions protégées
        </p>
      </aside>

      <main className="flex flex-col justify-center px-4 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <Link to="/" aria-label="EduRelevé — accueil" className="entree inline-block lg:hidden">
            <Logo />
          </Link>
          <div className="entree space-y-2" style={{ '--delai': '80ms' }}>
            <h1 className="text-2xl font-bold tracking-tight">Connexion</h1>
            <p className="text-sm text-slate-600">
              Utilisez l’e-mail ou le numéro de téléphone communiqué par votre établissement.
            </p>
          </div>

          {erreur && (
            <Alerte
              type="erreur"
              titre={
                erreur.statut === 401
                  ? 'Identifiant ou mot de passe incorrect'
                  : 'Connexion impossible'
              }
            >
              {erreur.statut === 401 ? 'Vérifiez votre saisie et réessayez.' : erreur.message}
            </Alerte>
          )}

          <form
            onSubmit={soumettre}
            className="entree space-y-5"
            style={{ '--delai': '160ms' }}
            noValidate
          >
            <Champ
              libelle="E-mail ou téléphone"
              name="identifiant"
              autoComplete="username"
              inputMode="email"
              placeholder="01 97 00 00 00 ou nom@exemple.bj"
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              obligatoire
            />
            <ChampMotDePasse
              name="motDePasse"
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              obligatoire
            />
            <Bouton
              type="submit"
              icone={LogIn}
              chargement={envoi}
              className="w-full"
              disabled={!identifiant || !motDePasse}
            >
              Se connecter
            </Bouton>
          </form>

          <p className="entree text-center text-sm text-slate-600" style={{ '--delai': '240ms' }}>
            Votre établissement n’est pas encore inscrit ?{' '}
            <Link to="/inscription-ecole" className="font-semibold text-marque-700 hover:underline">
              Déposer un dossier
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
