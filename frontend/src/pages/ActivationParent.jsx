import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserRoundCheck } from 'lucide-react';
import Guilloche from '../components/Guilloche.jsx';
import Alerte from '../components/ui/Alerte.jsx';
import Bouton from '../components/ui/Bouton.jsx';
import { Champ, ChampMotDePasse, ChampSelection } from '../components/ui/Champ.jsx';
import { useAuth } from '../contexte/Auth.jsx';
import { erreursParChamp } from '../lib/api.js';
import { appelApi } from '../lib/api.js';

const VIDE = {
  identifiantEleve: '',
  dateNaissance: '',
  telephone: '',
  nom: '',
  prenoms: '',
  lien: 'MERE',
  motDePasse: '',
};

/** Le parent ouvre son compte seul, avec la fiche de connexion de son enfant. */
export default function ActivationParent() {
  const { connexion } = useAuth();
  const naviguer = useNavigate();
  const [donnees, setDonnees] = useState(VIDE);
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [dejaInscrit, setDejaInscrit] = useState(false);
  const modifier = (cle) => (e) => setDonnees((d) => ({ ...d, [cle]: e.target.value }));

  async function activer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreurs({});
    setErreur(null);
    try {
      const { compteExistant } = await appelApi('/public/parents/activation', {
        methode: 'POST',
        corps: donnees,
      });
      if (compteExistant) {
        setDejaInscrit(true);
      } else {
        await connexion(donnees.telephone, donnees.motDePasse);
        naviguer('/espace', { replace: true });
      }
    } catch (err) {
      setErreurs(erreursParChamp(err));
      setErreur(err.code === 'VALIDATION' ? 'Vérifiez les champs signalés.' : err.message);
    } finally {
      setEnvoi(false);
    }
  }

  if (dejaInscrit) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-16">
        <Alerte type="succes" titre="Enfant ajouté à votre compte">
          Vous aviez déjà un compte avec ce numéro : connectez-vous avec votre mot de passe
          habituel.
        </Alerte>
        <Link to="/connexion" className="font-semibold text-marque-700 hover:underline">
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-8 sm:py-12 lg:grid-cols-[1fr_1.2fr]">
      <div className="entree relative space-y-4 overflow-hidden">
        <p className="etiquette">Parents</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Suivre la scolarité de votre enfant
        </h1>
        <p className="text-slate-600">
          Notes au fil du trimestre, absences, bulletins : tout ce que l’établissement enregistre,
          sur votre téléphone. Vous êtes aussi prévenu par SMS.
        </p>
        <ol className="space-y-3 border-t-2 border-slate-900 pt-4 text-sm text-slate-700">
          <li>
            <span className="chiffres font-semibold text-marque-700">1.</span> L’identifiant
            EduRelevé de votre enfant figure sur sa fiche de connexion (10 caractères, par exemple
            R6CTD-1QEY2).
          </li>
          <li>
            <span className="chiffres font-semibold text-marque-700">2.</span> Utilisez le numéro de
            téléphone que vous avez donné à l’établissement.
          </li>
          <li>
            <span className="chiffres font-semibold text-marque-700">3.</span> Plusieurs enfants ?
            Recommencez avec chaque identifiant : ils s’ajoutent au même compte.
          </li>
        </ol>
        <Guilloche
          variante="bande"
          largeur={600}
          hauteur={80}
          lignes={9}
          anime
          className="h-16 w-full text-marque-500/30"
        />
      </div>

      <form
        onSubmit={activer}
        className="entree space-y-5"
        style={{ '--delai': '120ms' }}
        noValidate
      >
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        <fieldset className="space-y-4">
          <legend className="etiquette mb-3 block w-full border-b-2 border-slate-900 pb-2">
            Votre enfant
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ
              libelle="Identifiant EduRelevé"
              value={donnees.identifiantEleve}
              onChange={modifier('identifiantEleve')}
              erreur={erreurs.identifiantEleve}
              placeholder="XXXXX-XXXXX"
              autoComplete="off"
              autoCapitalize="characters"
              className="chiffres block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base uppercase sm:text-sm"
              obligatoire
            />
            <Champ
              libelle="Sa date de naissance"
              type="date"
              value={donnees.dateNaissance}
              onChange={modifier('dateNaissance')}
              erreur={erreurs.dateNaissance}
              obligatoire
            />
          </div>
        </fieldset>
        <fieldset className="space-y-4">
          <legend className="etiquette mb-3 block w-full border-b-2 border-slate-900 pb-2">
            Vous
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ
              libelle="Nom"
              value={donnees.nom}
              onChange={modifier('nom')}
              erreur={erreurs.nom}
              autoComplete="family-name"
              obligatoire
            />
            <Champ
              libelle="Prénoms"
              value={donnees.prenoms}
              onChange={modifier('prenoms')}
              erreur={erreurs.prenoms}
              autoComplete="given-name"
              obligatoire
            />
            <Champ
              libelle="Téléphone"
              type="tel"
              inputMode="tel"
              value={donnees.telephone}
              onChange={modifier('telephone')}
              erreur={erreurs.telephone}
              placeholder="01 97 00 00 00"
              aide="Il servira à vous connecter"
              autoComplete="tel"
              obligatoire
            />
            <ChampSelection
              libelle="Vous êtes"
              value={donnees.lien}
              onChange={modifier('lien')}
              options={[
                { valeur: 'MERE', libelle: 'Sa mère' },
                { valeur: 'PERE', libelle: 'Son père' },
                { valeur: 'TUTEUR', libelle: 'Son tuteur' },
                { valeur: 'AUTRE', libelle: 'Autre responsable' },
              ]}
              obligatoire
            />
          </div>
          <ChampMotDePasse
            libelle="Choisissez un mot de passe"
            value={donnees.motDePasse}
            onChange={modifier('motDePasse')}
            erreur={erreurs.motDePasse}
            aide="8 caractères au moins, avec une lettre et un chiffre"
            autoComplete="new-password"
            obligatoire
          />
        </fieldset>
        <Bouton
          type="submit"
          icone={UserRoundCheck}
          chargement={envoi}
          className="w-full sm:w-auto"
        >
          Ouvrir mon compte parent
        </Bouton>
        <p className="text-sm text-slate-600">
          Déjà un compte ?{' '}
          <Link to="/connexion" className="font-semibold text-marque-700 hover:underline">
            Se connecter
          </Link>
        </p>
      </form>
    </div>
  );
}
