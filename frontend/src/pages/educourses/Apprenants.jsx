import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronRight, Plus, Trash2, UserRoundPlus } from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { Champ, ChampSelection } from '../../components/ui/Champ.jsx';
import Dialogue from '../../components/ui/Dialogue.jsx';
import Apparition from '../../components/animation/Apparition.jsx';
import { useAuth } from '../../contexte/Auth.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi, erreursParChamp } from '../../lib/api.js';
import {
  cheminProfil,
  classeProfil,
  LIBELLES_NIVEAUX,
  NIVEAUX,
  SECOND_CYCLE,
} from '../../lib/educourses.js';

/** Fiche d'un apprenant : initiale, prénom, classe. */
function FicheApprenant({ profil, delai, onSupprimer }) {
  return (
    <Apparition as="li" delai={delai} className="group relative">
      <Link
        to={cheminProfil(profil.id)}
        className="cahier marge-rouge flex min-h-28 items-center gap-4 rounded-lg py-4 pr-4 pl-12 ring-1 ring-slate-200 transition hover:ring-marque-400 focus-visible:outline-2 focus-visible:outline-marque-600"
      >
        <span
          className="chiffres flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-encre text-lg font-semibold text-encre"
          aria-hidden="true"
        >
          {profil.prenom[0]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-bold tracking-tight">{profil.prenom}</span>
          <span className="chiffres text-sm text-slate-600">
            {classeProfil(profil)}
            {profil.classe && ` · ${profil.classe}`}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-marque-700" />
      </Link>
      {onSupprimer && !profil.relieAEleve && (
        <button
          type="button"
          onClick={() => onSupprimer(profil)}
          className="absolute top-2 right-2 rounded-md p-1.5 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-rouge focus-visible:opacity-100"
          aria-label={`Retirer ${profil.prenom}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </Apparition>
  );
}

/** Ajout d'un apprenant scolarisé hors EduRelevé : prénom, niveau, série. */
function DialogueApprenant({ ouvert, onFermer, onAjoute, series }) {
  const [donnees, setDonnees] = useState({ prenom: '', niveau: 'SIXIEME', serie: '' });
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const modifier = (cle) => (e) => setDonnees((d) => ({ ...d, [cle]: e.target.value }));
  const avecSerie = SECOND_CYCLE.includes(donnees.niveau);

  async function ajouter(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreurs({});
    setErreur(null);
    try {
      await appelApi('/educourses/profils', {
        methode: 'POST',
        corps: {
          prenom: donnees.prenom,
          niveau: donnees.niveau,
          serie: avecSerie ? donnees.serie : undefined,
        },
      });
      setDonnees({ prenom: '', niveau: 'SIXIEME', serie: '' });
      onAjoute();
    } catch (err) {
      setErreurs(erreursParChamp(err));
      setErreur(err.code === 'VALIDATION' ? 'Vérifiez les champs signalés.' : err.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Dialogue ouvert={ouvert} onFermer={onFermer} titre="Ajouter un apprenant">
      <form onSubmit={ajouter} className="space-y-4" noValidate>
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        <Champ
          libelle="Prénom"
          value={donnees.prenom}
          onChange={modifier('prenom')}
          erreur={erreurs.prenom}
          autoComplete="off"
          obligatoire
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampSelection
            libelle="Classe"
            value={donnees.niveau}
            onChange={modifier('niveau')}
            options={NIVEAUX.map(([valeur]) => ({ valeur, libelle: LIBELLES_NIVEAUX[valeur] }))}
          />
          {avecSerie && (
            <ChampSelection
              libelle="Série"
              value={donnees.serie}
              onChange={modifier('serie')}
              erreur={erreurs.serie}
              placeholder="Choisir"
              options={series.map((s) => ({ valeur: s.code, libelle: `${s.code} — ${s.libelle}` }))}
              obligatoire
            />
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Bouton variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" chargement={envoi} icone={Plus}>
            Ajouter
          </Bouton>
        </div>
      </form>
    </Dialogue>
  );
}

/**
 * Entrée d'EduCourses. L'élève va directement à ses matières ; le parent choisit
 * l'enfant qui travaille (ou en ajoute un).
 */
export default function Apprenants() {
  const { utilisateur } = useAuth();
  const { donnees, erreur, chargement, recharger } = useRequete('/educourses/profils');
  const { donnees: catalogue } = useRequete(
    utilisateur.role === 'PARENT' ? '/educourses/catalogue' : null,
  );
  const [dialogue, setDialogue] = useState(false);
  const [action, setAction] = useState(null);

  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  if (utilisateur.role === 'ELEVE' && donnees.profils[0]) {
    return <Navigate to={cheminProfil(donnees.profils[0].id)} replace />;
  }

  async function relier(suggestion) {
    setAction({ cle: suggestion.eleveId });
    try {
      await appelApi('/educourses/profils', {
        methode: 'POST',
        corps: { eleveId: suggestion.eleveId },
      });
      recharger();
      setAction(null);
    } catch (err) {
      setAction({ erreur: err.message });
    }
  }

  async function supprimer(profil) {
    if (!window.confirm(`Retirer ${profil.prenom} et son avancement ?`)) return;
    try {
      await appelApi(`/educourses/profils/${profil.id}`, { methode: 'DELETE' });
      recharger();
    } catch (err) {
      setAction({ erreur: err.message });
    }
  }

  return (
    <div className="space-y-8">
      <EnTetePage
        surtitre="EduCourses"
        titre="Qui travaille aujourd’hui ?"
        description="Cours complets de la 6e à la Terminale, avec exercices corrigés et quiz. Chaque enfant garde son propre avancement."
        actions={
          <Bouton icone={UserRoundPlus} onClick={() => setDialogue(true)}>
            Ajouter un apprenant
          </Bouton>
        }
      />
      {action?.erreur && <Alerte type="erreur">{action.erreur}</Alerte>}

      {donnees.suggestions.length > 0 && (
        <section className="space-y-3">
          <h2 className="etiquette">Vos enfants inscrits sur EduRelevé</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {donnees.suggestions.map((s) => (
              <li
                key={s.eleveId}
                className="flex items-center justify-between gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-white p-4"
              >
                <span>
                  <span className="block font-semibold">{s.prenom}</span>
                  <span className="chiffres text-sm text-slate-600">
                    {classeProfil(s)} · {s.classe}
                  </span>
                </span>
                <Bouton
                  variante="secondaire"
                  icone={Plus}
                  chargement={action?.cle === s.eleveId}
                  onClick={() => relier(s)}
                >
                  Suivre les cours
                </Bouton>
              </li>
            ))}
          </ul>
        </section>
      )}

      {donnees.profils.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {donnees.profils.map((p, i) => (
            <FicheApprenant key={p.id} profil={p} delai={i * 70} onSupprimer={supprimer} />
          ))}
        </ul>
      ) : (
        donnees.suggestions.length === 0 && (
          <div className="cahier marge-rouge rounded-lg py-10 pr-6 pl-12 ring-1 ring-slate-200">
            <p className="text-lg font-semibold">Aucun apprenant pour l’instant.</p>
            <p className="mt-1 text-slate-600">
              Ajoutez votre enfant avec sa classe : il retrouvera toutes les matières de son
              programme, leçon par leçon.
            </p>
          </div>
        )
      )}

      <DialogueApprenant
        ouvert={dialogue}
        onFermer={() => setDialogue(false)}
        series={catalogue?.series ?? []}
        onAjoute={() => {
          setDialogue(false);
          recharger();
        }}
      />
    </div>
  );
}
