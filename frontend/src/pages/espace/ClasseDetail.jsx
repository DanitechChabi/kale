import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { KeyRound, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import FichesConnexion from '../../components/FichesConnexion.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { Champ, ChampSelection } from '../../components/ui/Champ.jsx';
import Dialogue from '../../components/ui/Dialogue.jsx';
import Onglets from '../../components/ui/Onglets.jsx';
import { useAuth } from '../../contexte/Auth.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';
import { age, formaterIdentifiant } from '../../lib/scolarite.js';

/** Inscription d'un élève sans classe cette année. */
function InscrireEleve({ classeId, onInscrit }) {
  const [recherche, setRecherche] = useState('');
  const requete = new URLSearchParams({
    sansClasse: 'true',
    parPage: '20',
    ...(recherche && { recherche }),
  });
  const { donnees, chargement } = useRequete(`/eleves?${requete}`);
  const [erreur, setErreur] = useState(null);

  async function inscrire(eleveId) {
    setErreur(null);
    try {
      await appelApi('/inscriptions', { methode: 'POST', corps: { eleveId, classeId } });
      onInscrit();
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <label className="relative block">
        <span className="sr-only">Rechercher un élève</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Nom, matricule ou identifiant"
          className="w-full rounded-lg border border-slate-300 py-2.5 pr-3 pl-9 text-base focus:border-marque-500 focus:ring-2 focus:ring-marque-500/20 focus:outline-none sm:text-sm"
        />
      </label>
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {chargement && <Chargement />}
      {donnees && !donnees.eleves.length && (
        <p className="text-sm text-slate-500">
          Aucun élève sans classe.{' '}
          <Link to="/espace/eleves?nouveau=1" className="font-semibold text-marque-700 underline">
            Créer une fiche élève
          </Link>
        </p>
      )}
      <ul className="divide-y divide-slate-100">
        {donnees?.eleves.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="font-medium">
                {e.nom} {e.prenoms}
              </p>
              <p className="text-xs text-slate-500">
                {e.matricule} · {age(e.dateNaissance)} ans
              </p>
            </div>
            <Bouton
              variante="secondaire"
              icone={Plus}
              onClick={() => inscrire(e.id)}
              className="min-h-9 py-1.5"
            >
              Inscrire
            </Bouton>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OngletEleves({ classe, gestionEleves, recharger }) {
  const naviguer = useNavigate();
  const [inscription, setInscription] = useState(false);
  const [fiches, setFiches] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const sansCompte = classe.eleves.filter((e) => !e.utilisateurId).length;

  async function creerComptes() {
    setEnvoi(true);
    setErreur(null);
    try {
      const resultat = await appelApi('/utilisateurs/comptes-classe', {
        methode: 'POST',
        corps: { classeId: classe.id },
      });
      setFiches(resultat.fiches.map((f) => ({ ...f, cle: f.eleveId, detail: classe.nom })));
      recharger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="space-y-4">
      {gestionEleves && (
        <div className="flex flex-wrap gap-2">
          <Bouton variante="secondaire" icone={UserPlus} onClick={() => setInscription(true)}>
            Inscrire un élève
          </Bouton>
          {sansCompte > 0 && (
            <Bouton
              variante="secondaire"
              icone={KeyRound}
              chargement={envoi}
              onClick={creerComptes}
            >
              Créer les comptes élèves ({sansCompte})
            </Bouton>
          )}
        </div>
      )}
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {!classe.eleves.length ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          Aucun élève inscrit. Inscrivez des élèves un par un ou{' '}
          <Link to="/espace/import" className="font-semibold text-marque-700 underline">
            importez une liste
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">N°</th>
                <th className="px-3 py-2 font-semibold">Élève</th>
                <th className="px-3 py-2 font-semibold">Sexe</th>
                <th className="px-3 py-2 font-semibold">Identifiant</th>
                <th className="px-3 py-2 font-semibold">Compte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {classe.eleves.map((e, i) => (
                <tr
                  key={e.id}
                  onClick={() => naviguer(`/espace/eleves/${e.id}`)}
                  className="cursor-pointer hover:bg-marque-50/40"
                >
                  <td className="px-3 py-2.5 text-slate-500 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-medium">{e.nom}</span> {e.prenoms}
                    <span className="block text-xs text-slate-500">{e.matricule}</span>
                  </td>
                  <td className="px-3 py-2.5">{e.sexe}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {formaterIdentifiant(e.identifiant)}
                  </td>
                  <td className="px-3 py-2.5">
                    {e.utilisateurId ? (
                      <span className="text-marque-700">Actif</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialogue
        ouvert={inscription}
        onFermer={() => setInscription(false)}
        titre={`Inscrire en ${classe.nom}`}
      >
        <InscrireEleve
          classeId={classe.id}
          onInscrit={() => {
            setInscription(false);
            recharger();
          }}
        />
      </Dialogue>
      <Dialogue
        ouvert={Boolean(fiches)}
        onFermer={() => setFiches(null)}
        titre="Fiches de connexion"
        large
      >
        {fiches && <FichesConnexion fiches={fiches} titre={classe.nom} />}
      </Dialogue>
    </div>
  );
}

function LigneEnseignement({ enseignement, enseignants, gestion, onChange }) {
  const [coefficient, setCoefficient] = useState(String(enseignement.coefficient));
  const [erreur, setErreur] = useState(null);

  async function enregistrer(corps) {
    setErreur(null);
    try {
      await appelApi(`/enseignements/${enseignement.id}`, { methode: 'PATCH', corps });
      onChange();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function retirer() {
    setErreur(null);
    try {
      await appelApi(`/enseignements/${enseignement.id}`, { methode: 'DELETE' });
      onChange();
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{enseignement.matiere.nom}</p>
          <p className="text-xs text-slate-500">
            {enseignement.groupeOption && `Au choix (${enseignement.groupeOption}) · `}
            {enseignement.estFacultative ? 'Facultative' : 'Obligatoire'}
            {!gestion &&
              enseignement.enseignant &&
              ` · ${enseignement.enseignant.prenoms} ${enseignement.enseignant.nom}`}
          </p>
        </div>
        {gestion ? (
          <>
            <label className="flex shrink-0 items-center gap-2 text-sm">
              <span className="text-slate-500">Coef.</span>
              <input
                type="number"
                min="1"
                max="20"
                inputMode="numeric"
                value={coefficient}
                onChange={(e) => setCoefficient(e.target.value)}
                onBlur={() =>
                  Number(coefficient) !== enseignement.coefficient &&
                  enregistrer({ coefficient: Number(coefficient) })
                }
                className="w-14 rounded-lg border border-slate-300 px-2 py-1.5 text-center tabular-nums focus:border-marque-500 focus:ring-2 focus:ring-marque-500/20 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={retirer}
              className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-rouge"
              aria-label={`Retirer ${enseignement.matiere.nom}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        ) : (
          <p className="shrink-0 text-sm text-slate-600">
            Coef. <strong>{enseignement.coefficient}</strong>
          </p>
        )}
      </div>
      {gestion && (
        <select
          aria-label={`Enseignant de ${enseignement.matiere.nom}`}
          value={enseignement.enseignant?.id ?? ''}
          onChange={(e) => enregistrer({ enseignantId: e.target.value || null })}
          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
        >
          <option value="">Enseignant non désigné</option>
          {enseignants.map((u) => (
            <option key={u.id} value={u.id}>
              {u.prenoms} {u.nom}
            </option>
          ))}
        </select>
      )}
      {erreur && <p className="text-sm text-rouge">{erreur}</p>}
    </li>
  );
}

function AjouterMatiere({ classe, onAjoutee }) {
  const { donnees } = useRequete('/matieres');
  const [matiereId, setMatiereId] = useState('');
  const [nouvelle, setNouvelle] = useState({ code: '', nom: '' });
  const [coefficient, setCoefficient] = useState('1');
  const [facultative, setFacultative] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const deja = new Set(classe.enseignements.map((e) => e.matiere.id));
  const disponibles = donnees?.matieres.filter((m) => m.actif && !deja.has(m.id)) ?? [];

  async function ajouter(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      let id = matiereId;
      if (id === 'nouvelle') {
        id = (await appelApi('/matieres', { methode: 'POST', corps: nouvelle })).matiere.id;
      }
      await appelApi(`/classes/${classe.id}/enseignements`, {
        methode: 'POST',
        corps: { matiereId: id, coefficient: Number(coefficient), estFacultative: facultative },
      });
      onAjoutee();
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={ajouter} className="space-y-4">
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      <ChampSelection
        libelle="Matière"
        value={matiereId}
        onChange={(e) => setMatiereId(e.target.value)}
        placeholder="Choisir…"
        options={[
          ...disponibles.map((m) => ({ valeur: m.id, libelle: m.nom })),
          { valeur: 'nouvelle', libelle: 'Nouvelle matière de l’établissement…' },
        ]}
        obligatoire
      />
      {matiereId === 'nouvelle' && (
        <div className="entree grid gap-4 sm:grid-cols-3">
          <Champ
            libelle="Code"
            value={nouvelle.code}
            onChange={(e) => setNouvelle((n) => ({ ...n, code: e.target.value }))}
            placeholder="INFO"
            obligatoire
          />
          <div className="sm:col-span-2">
            <Champ
              libelle="Nom"
              value={nouvelle.nom}
              onChange={(e) => setNouvelle((n) => ({ ...n, nom: e.target.value }))}
              placeholder="Informatique"
              obligatoire
            />
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ
          libelle="Coefficient"
          type="number"
          min="1"
          max="20"
          inputMode="numeric"
          value={coefficient}
          onChange={(e) => setCoefficient(e.target.value)}
          obligatoire
        />
        <label className="flex items-center gap-3 self-end rounded-lg bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200">
          <input
            type="checkbox"
            checked={facultative}
            onChange={(e) => setFacultative(e.target.checked)}
            className="h-4 w-4 accent-marque-600"
          />
          Matière facultative (bonus)
        </label>
      </div>
      <Bouton
        type="submit"
        icone={Plus}
        chargement={envoi}
        disabled={!matiereId}
        className="w-full"
      >
        Ajouter à la classe
      </Bouton>
    </form>
  );
}

function OngletMatieres({ classe, gestion, recharger }) {
  const { donnees } = useRequete(gestion ? '/utilisateurs?role=ENSEIGNANT' : null);
  const [ajout, setAjout] = useState(false);
  const total = classe.enseignements
    .filter((e) => !e.estFacultative && !e.groupeOption)
    .reduce((t, e) => t + e.coefficient, 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {classe.enseignements.length} matières · total des coefficients obligatoires :{' '}
          <strong className="tabular-nums">{total}</strong>
        </p>
        {gestion && (
          <Bouton variante="secondaire" icone={Plus} onClick={() => setAjout(true)}>
            Ajouter une matière
          </Bouton>
        )}
      </div>
      <ul className="divide-y divide-slate-100 rounded-xl bg-white px-4 ring-1 ring-slate-200">
        {classe.enseignements.map((e) => (
          <LigneEnseignement
            key={`${e.id}-${e.coefficient}`}
            enseignement={e}
            enseignants={donnees?.comptes ?? []}
            gestion={gestion}
            onChange={recharger}
          />
        ))}
      </ul>
      <Dialogue ouvert={ajout} onFermer={() => setAjout(false)} titre="Ajouter une matière">
        <AjouterMatiere
          classe={classe}
          onAjoutee={() => {
            setAjout(false);
            recharger();
          }}
        />
      </Dialogue>
    </div>
  );
}

export default function ClasseDetail() {
  const { id } = useParams();
  const { utilisateur } = useAuth();
  const { donnees, erreur, chargement, recharger } = useRequete(`/classes/${id}`);
  const [onglet, setOnglet] = useState('eleves');

  if (chargement && !donnees) return <Chargement />;
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  const { classe } = donnees;
  const gestion = utilisateur.role === 'ADMIN_ECOLE';
  const gestionEleves = ['ADMIN_ECOLE', 'SECRETARIAT'].includes(utilisateur.role);

  return (
    <div className="space-y-6">
      <EnTetePage
        retour={{ vers: '/espace/classes', libelle: 'Toutes les classes' }}
        surtitre={`${classe.anneeScolaire.libelle}${classe.serie ? ` · Série ${classe.serie.code} — ${classe.serie.libelle}` : ''}`}
        titre={classe.nom}
        description={`${classe.eleves.length} élève${classe.eleves.length > 1 ? 's' : ''}${
          classe.professeurPrincipal
            ? ` · Professeur principal : ${classe.professeurPrincipal.prenoms} ${classe.professeurPrincipal.nom}`
            : ''
        }`}
      />
      <Onglets
        onglets={[
          ['eleves', 'Élèves', classe.eleves.length],
          ['matieres', 'Matières', classe.enseignements.length],
        ]}
        actif={onglet}
        onChange={setOnglet}
      />
      <div key={onglet} className="entree">
        {onglet === 'eleves' ? (
          <OngletEleves classe={classe} gestionEleves={gestionEleves} recharger={recharger} />
        ) : (
          <OngletMatieres classe={classe} gestion={gestion} recharger={recharger} />
        )}
      </div>
    </div>
  );
}
