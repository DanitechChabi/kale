import { useState } from 'react';
import { KeyRound, Power, UserPlus } from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import FichesConnexion from '../../components/FichesConnexion.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { Champ, ChampSelection } from '../../components/ui/Champ.jsx';
import Dialogue from '../../components/ui/Dialogue.jsx';
import Onglets from '../../components/ui/Onglets.jsx';
import { LIBELLES_ROLES, useAuth } from '../../contexte/Auth.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi, erreursParChamp } from '../../lib/api.js';
import { formaterDate, formaterTelephone } from '../../lib/navigation.js';

const ONGLETS = [
  ['ENSEIGNANT', 'Enseignants'],
  ['SECRETARIAT', 'Secrétariat'],
  ['ADMIN_ECOLE', 'Responsables'],
  ['ELEVE', 'Élèves'],
  ['PARENT', 'Parents'],
];

const ficheDepuis = (compte, motDePasseTemporaire) => ({
  cle: compte.id,
  nom: compte.nom,
  prenoms: compte.prenoms,
  identifiant: compte.identifiantEleve ?? formaterTelephone(compte.telephone) ?? compte.email,
  motDePasseTemporaire,
  detail: LIBELLES_ROLES[compte.role],
});

function NouveauCompte({ onCree }) {
  const [champs, setChamps] = useState({
    role: 'ENSEIGNANT',
    nom: '',
    prenoms: '',
    telephone: '',
    email: '',
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const erreurs = erreursParChamp(erreur);
  const modifier = (cle) => (e) => setChamps((c) => ({ ...c, [cle]: e.target.value }));

  async function creer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const corps = Object.fromEntries(Object.entries(champs).filter(([, v]) => v));
    try {
      const { compte, motDePasseTemporaire } = await appelApi('/utilisateurs', {
        methode: 'POST',
        corps,
      });
      onCree(compte, motDePasseTemporaire);
    } catch (err) {
      setErreur(err);
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={creer} className="space-y-4" noValidate>
      {erreur && !Object.keys(erreurs).length && <Alerte type="erreur">{erreur.message}</Alerte>}
      <ChampSelection
        libelle="Rôle"
        value={champs.role}
        onChange={modifier('role')}
        options={['ENSEIGNANT', 'SECRETARIAT', 'ADMIN_ECOLE'].map((r) => ({
          valeur: r,
          libelle: LIBELLES_ROLES[r],
        }))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ
          libelle="Nom"
          value={champs.nom}
          onChange={modifier('nom')}
          erreur={erreurs.nom}
          obligatoire
        />
        <Champ
          libelle="Prénoms"
          value={champs.prenoms}
          onChange={modifier('prenoms')}
          erreur={erreurs.prenoms}
          obligatoire
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ
          libelle="Téléphone"
          type="tel"
          inputMode="tel"
          value={champs.telephone}
          onChange={modifier('telephone')}
          erreur={erreurs.telephone}
          placeholder="01 97 00 00 00"
          aide="Servira d’identifiant"
        />
        <Champ
          libelle="E-mail"
          type="email"
          value={champs.email}
          onChange={modifier('email')}
          erreur={erreurs.email}
        />
      </div>
      <Bouton type="submit" icone={UserPlus} chargement={envoi} className="w-full">
        Créer le compte
      </Bouton>
    </form>
  );
}

function LigneCompte({ compte, moi, onFiche, onChange }) {
  const [action, setAction] = useState(null);
  const [erreur, setErreur] = useState(null);

  async function executer(type) {
    setAction(type);
    setErreur(null);
    try {
      if (type === 'mdp') {
        const { motDePasseTemporaire } = await appelApi(
          `/utilisateurs/${compte.id}/reinitialiser-mot-de-passe`,
          { methode: 'POST' },
        );
        onFiche(ficheDepuis(compte, motDePasseTemporaire));
      } else {
        await appelApi(`/utilisateurs/${compte.id}/statut`, {
          methode: 'PATCH',
          corps: { actif: !compte.actif },
        });
      }
      onChange();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setAction(null);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className={compte.actif ? '' : 'text-slate-400'}>
          <span className="font-semibold">{compte.nom}</span> {compte.prenoms}
          {!compte.actif && (
            <span className="ml-2 text-xs font-semibold text-slate-500">désactivé</span>
          )}
        </p>
        <p className="truncate text-xs text-slate-500">
          {[formaterTelephone(compte.telephone), compte.email].filter(Boolean).join(' · ') ||
            'Identifiant élève'}{' '}
          ·{' '}
          {compte.derniereConnexionLe
            ? `vu le ${formaterDate(compte.derniereConnexionLe)}`
            : 'jamais connecté'}
        </p>
        {erreur && <p className="text-xs text-rouge">{erreur}</p>}
      </div>
      {compte.id !== moi && (
        <div className="flex gap-1">
          <Bouton
            variante="discret"
            icone={KeyRound}
            chargement={action === 'mdp'}
            onClick={() => executer('mdp')}
            className="min-h-9 py-1.5"
          >
            Nouveau mot de passe
          </Bouton>
          {compte.role !== 'PARENT' && (
            <Bouton
              variante="discret"
              icone={Power}
              chargement={action === 'statut'}
              onClick={() => executer('statut')}
              className={`min-h-9 py-1.5 ${compte.actif ? 'text-rouge hover:bg-red-50' : ''}`}
            >
              {compte.actif ? 'Désactiver' : 'Réactiver'}
            </Bouton>
          )}
        </div>
      )}
    </li>
  );
}

export default function Comptes() {
  const { utilisateur } = useAuth();
  const [role, setRole] = useState('ENSEIGNANT');
  const { donnees, erreur, chargement, recharger } = useRequete(`/utilisateurs?role=${role}`);
  const [creation, setCreation] = useState(false);
  const [fiche, setFiche] = useState(null);

  return (
    <div className="space-y-6">
      <EnTetePage
        surtitre="Établissement"
        titre="Comptes"
        description="Chaque compte reçoit un mot de passe provisoire à changer à la première connexion."
        actions={
          <Bouton icone={UserPlus} onClick={() => setCreation(true)}>
            Nouveau compte
          </Bouton>
        }
      />
      <Onglets onglets={ONGLETS} actif={role} onChange={setRole} />
      {role === 'ELEVE' && (
        <Alerte type="info">
          Les comptes élèves se créent depuis chaque classe, avec des fiches de connexion à
          imprimer.
        </Alerte>
      )}
      {erreur && <Alerte type="erreur">{erreur.message}</Alerte>}
      {chargement ? (
        <Chargement />
      ) : donnees?.comptes.length ? (
        <ul
          key={role}
          className="entree divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
        >
          {donnees.comptes.map((c) => (
            <LigneCompte
              key={c.id}
              compte={c}
              moi={utilisateur.id}
              onFiche={(f) => setFiche([f])}
              onChange={recharger}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          Aucun compte dans cette catégorie.
        </div>
      )}
      <Dialogue ouvert={creation} onFermer={() => setCreation(false)} titre="Nouveau compte">
        <NouveauCompte
          onCree={(compte, motDePasse) => {
            setCreation(false);
            setRole(compte.role);
            setFiche([ficheDepuis(compte, motDePasse)]);
            recharger();
          }}
        />
      </Dialogue>
      <Dialogue
        ouvert={Boolean(fiche)}
        onFermer={() => setFiche(null)}
        titre="Fiche de connexion"
        large
      >
        {fiche && <FichesConnexion fiches={fiche} />}
      </Dialogue>
    </div>
  );
}
