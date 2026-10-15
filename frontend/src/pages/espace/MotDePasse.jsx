import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, KeyRound } from 'lucide-react';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import { ChampMotDePasse } from '../../components/ui/Champ.jsx';
import { useAuth } from '../../contexte/Auth.jsx';
import { appelApi, erreursParChamp } from '../../lib/api.js';
import { accueilSelonRole } from '../../lib/navigation.js';

const REGLES = [
  ['8 caractères au moins', (m) => m.length >= 8],
  ['Une lettre', (m) => /\p{L}/u.test(m)],
  ['Un chiffre', (m) => /\d/.test(m)],
];

export default function MotDePasse() {
  const { utilisateur, mettreAJourUtilisateur } = useAuth();
  const naviguer = useNavigate();
  const [champs, setChamps] = useState({ ancien: '', nouveau: '', confirmation: '' });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(false);
  const impose = utilisateur.doitChangerMotDePasse;

  const regleOk = REGLES.every(([, test]) => test(champs.nouveau));
  const confirmationOk = champs.nouveau === champs.confirmation;
  const modifier = (cle) => (e) => setChamps((c) => ({ ...c, [cle]: e.target.value }));

  async function soumettre(e) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      const { utilisateur: misAJour } = await appelApi('/auth/changer-mot-de-passe', {
        methode: 'POST',
        corps: { ancien: champs.ancien, nouveau: champs.nouveau },
      });
      mettreAJourUtilisateur(misAJour);
      setSucces(true);
      if (impose) naviguer(accueilSelonRole(misAJour), { replace: true });
      setChamps({ ancien: '', nouveau: '', confirmation: '' });
    } catch (err) {
      setErreur(err);
    } finally {
      setEnvoi(false);
    }
  }

  const erreurs = erreursParChamp(erreur);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="entree space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {impose ? 'Choisissez votre mot de passe' : 'Changer de mot de passe'}
        </h1>
        <p className="text-sm text-slate-600">
          {impose
            ? 'Votre compte a été créé avec un mot de passe temporaire. Remplacez-le par un mot de passe personnel pour continuer.'
            : 'Les autres appareils connectés à votre compte seront déconnectés.'}
        </p>
      </div>

      {succes && !impose && <Alerte type="succes" titre="Mot de passe modifié" />}
      {erreur && !Object.keys(erreurs).length && <Alerte type="erreur">{erreur.message}</Alerte>}

      <form
        onSubmit={soumettre}
        className="entree space-y-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"
        style={{ '--delai': '100ms' }}
        noValidate
      >
        <ChampMotDePasse
          libelle={impose ? 'Mot de passe temporaire' : 'Mot de passe actuel'}
          autoComplete="current-password"
          value={champs.ancien}
          onChange={modifier('ancien')}
          erreur={erreur?.code === 'MOT_DE_PASSE_INCORRECT' ? erreur.message : erreurs.ancien}
          obligatoire
        />
        <ChampMotDePasse
          libelle="Nouveau mot de passe"
          autoComplete="new-password"
          value={champs.nouveau}
          onChange={modifier('nouveau')}
          erreur={erreurs.nouveau}
          obligatoire
        />
        <ul className="grid grid-cols-3 gap-2 text-xs" aria-label="Règles du mot de passe">
          {REGLES.map(([libelle, test]) => {
            const ok = test(champs.nouveau);
            return (
              <li
                key={libelle}
                className={`flex items-center gap-1 transition-colors ${ok ? 'text-marque-700' : 'text-slate-500'}`}
              >
                <Check
                  className={`h-3.5 w-3.5 transition-transform ${ok ? 'scale-100' : 'scale-0'}`}
                  aria-hidden="true"
                />
                {libelle}
              </li>
            );
          })}
        </ul>
        <ChampMotDePasse
          libelle="Confirmation"
          autoComplete="new-password"
          value={champs.confirmation}
          onChange={modifier('confirmation')}
          erreur={
            champs.confirmation && !confirmationOk
              ? 'Les deux mots de passe ne correspondent pas'
              : undefined
          }
          obligatoire
        />
        <Bouton
          type="submit"
          icone={KeyRound}
          chargement={envoi}
          disabled={!champs.ancien || !regleOk || !confirmationOk}
          className="w-full"
        >
          Enregistrer le mot de passe
        </Bouton>
      </form>
    </div>
  );
}
