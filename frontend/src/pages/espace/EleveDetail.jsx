import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Copy, KeyRound, Pencil, Trash2 } from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import Guilloche from '../../components/Guilloche.jsx';
import FichesConnexion from '../../components/FichesConnexion.jsx';
import FormulaireEleve from '../../components/FormulaireEleve.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import Dialogue from '../../components/ui/Dialogue.jsx';
import { useAuth } from '../../contexte/Auth.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';
import { formaterDate, formaterTelephone } from '../../lib/navigation.js';
import { age, formaterIdentifiant } from '../../lib/scolarite.js';

const STATUTS = { INSCRIT: 'Inscrit', TRANSFERE: 'Transféré', ABANDON: 'Abandon', EXCLU: 'Exclu' };

function Identifiant({ valeur }) {
  const [copie, setCopie] = useState(false);
  async function copier() {
    try {
      await navigator.clipboard.writeText(formaterIdentifiant(valeur));
      setCopie(true);
      setTimeout(() => setCopie(false), 1500);
    } catch {
      /* presse-papiers indisponible : l'identifiant reste sélectionnable */
    }
  }
  return (
    <div
      className="entree rounded-2xl bg-gradient-to-br from-marque-700 to-marque-900 p-5 text-white shadow-md"
      style={{ '--delai': '80ms' }}
    >
      <p className="text-xs font-semibold tracking-wider text-marque-100 uppercase">
        Identifiant EduRelevé
      </p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="font-mono text-2xl font-bold tracking-widest select-all sm:text-3xl">
          {formaterIdentifiant(valeur)}
        </p>
        <button
          type="button"
          onClick={copier}
          className="rounded-lg p-2 text-marque-100 hover:bg-white/10"
          aria-label="Copier l’identifiant"
        >
          {copie ? <Check className="h-5 w-5 text-or" /> : <Copy className="h-5 w-5" />}
        </button>
      </div>
      <p className="mt-2 text-sm text-marque-100">
        Unique dans tout le pays, il suit l’élève d’un établissement à l’autre et lui sert
        d’identifiant de connexion.
      </p>
    </div>
  );
}

export default function EleveDetail() {
  const { id } = useParams();
  const naviguer = useNavigate();
  const { utilisateur } = useAuth();
  const { donnees, erreur, chargement, recharger } = useRequete(`/eleves/${id}`);
  const [edition, setEdition] = useState(false);
  const [fiche, setFiche] = useState(null);
  const [action, setAction] = useState({ envoi: false, erreur: null });
  const gestion = ['ADMIN_ECOLE', 'SECRETARIAT'].includes(utilisateur.role);

  if (chargement && !donnees) return <Chargement />;
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  const { eleve } = donnees;
  const courante = eleve.inscriptions.find((i) => i.anneeScolaire.estCourante);

  async function creerCompte() {
    setAction({ envoi: true, erreur: null });
    try {
      const { compte, motDePasseTemporaire } = await appelApi('/utilisateurs', {
        methode: 'POST',
        corps: { role: 'ELEVE', eleveId: eleve.id },
      });
      setFiche([
        {
          cle: compte.id,
          nom: eleve.nom,
          prenoms: eleve.prenoms,
          identifiant: eleve.identifiant,
          motDePasseTemporaire,
          detail: courante?.classe.nom,
        },
      ]);
      recharger();
      setAction({ envoi: false, erreur: null });
    } catch (err) {
      setAction({ envoi: false, erreur: err.message });
    }
  }

  async function supprimer() {
    setAction({ envoi: true, erreur: null });
    try {
      await appelApi(`/eleves/${eleve.id}`, { methode: 'DELETE' });
      naviguer('/espace/eleves', { replace: true });
    } catch (err) {
      setAction({ envoi: false, erreur: err.message });
    }
  }

  const infos = [
    ['Matricule', eleve.matricule],
    ['Sexe', eleve.sexe === 'F' ? 'Féminin' : 'Masculin'],
    [
      'Naissance',
      `${formaterDate(eleve.dateNaissance)}${eleve.lieuNaissance ? ` à ${eleve.lieuNaissance}` : ''} (${age(eleve.dateNaissance)} ans)`,
    ],
    ['NPI', eleve.npi],
    ['Parent ou tuteur', eleve.nomContactParent],
    ['Téléphone du parent', formaterTelephone(eleve.telephoneContactParent)],
  ].filter(([, v]) => v);

  return (
    <div className="space-y-6">
      <EnTetePage
        retour={{ vers: '/espace/eleves', libelle: 'Tous les élèves' }}
        surtitre={
          courante
            ? `${courante.classe.nom} · ${courante.anneeScolaire.libelle}`
            : 'Sans classe cette année'
        }
        titre={`${eleve.prenoms} ${eleve.nom}`}
        actions={
          gestion && (
            <Bouton variante="secondaire" icone={Pencil} onClick={() => setEdition(true)}>
              Modifier
            </Bouton>
          )
        }
      />
      <Identifiant valeur={eleve.identifiant} />
      {action.erreur && <Alerte type="erreur">{action.erreur}</Alerte>}

      <div className="grid gap-6 lg:grid-cols-3">
        <section
          className="entree rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-2"
          style={{ '--delai': '140ms' }}
        >
          <h2 className="mb-4 font-semibold">Fiche</h2>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {infos.map(([libelle, valeur]) => (
              <div key={libelle}>
                <dt className="text-slate-500">{libelle}</dt>
                <dd className="font-medium text-slate-900">{valeur}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section
          className="entree space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          style={{ '--delai': '180ms' }}
        >
          <h2 className="font-semibold">Compte élève</h2>
          {eleve.utilisateur ? (
            <p className="text-sm text-slate-600">
              {eleve.utilisateur.derniereConnexionLe
                ? `Dernière connexion le ${formaterDate(eleve.utilisateur.derniereConnexionLe, true)}`
                : 'Compte créé, jamais utilisé'}
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-600">L’élève n’a pas encore de compte.</p>
              {gestion && (
                <Bouton
                  variante="secondaire"
                  icone={KeyRound}
                  chargement={action.envoi}
                  onClick={creerCompte}
                >
                  Créer son compte
                </Bouton>
              )}
            </>
          )}
        </section>
      </div>

      <section
        className="entree rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
        style={{ '--delai': '220ms' }}
      >
        <h2 className="mb-3 font-semibold">Parcours</h2>
        {eleve.inscriptions.length ? (
          <ol className="relative space-y-3 border-l-2 border-marque-100 pl-5">
            {eleve.inscriptions.map((i) => (
              <li key={i.id} className="relative text-sm">
                <span
                  className="absolute top-1 -left-[1.6rem] h-3 w-3 rounded-full bg-marque-500 ring-4 ring-white"
                  aria-hidden="true"
                />
                <p className="font-semibold">
                  {i.anneeScolaire.libelle} · {i.classe.nom}
                </p>
                <p className="text-slate-500">
                  {STATUTS[i.statut]}
                  {i.redoublant && ' · redoublant'}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">Aucune inscription.</p>
        )}
      </section>

      {gestion && !eleve.utilisateur && (
        <div className="border-t border-slate-200 pt-4">
          <Bouton
            variante="discret"
            icone={Trash2}
            onClick={supprimer}
            chargement={action.envoi}
            className="text-rouge hover:bg-red-50"
          >
            Supprimer cette fiche (saisie par erreur)
          </Bouton>
        </div>
      )}

      <Dialogue ouvert={edition} onFermer={() => setEdition(false)} titre="Modifier la fiche" large>
        <FormulaireEleve
          eleve={eleve}
          onEnregistre={() => {
            setEdition(false);
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
