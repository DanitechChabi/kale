import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Save, Trash2 } from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import GrilleEmploiDuTemps from '../../components/GrilleEmploiDuTemps.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { Champ, ChampSelection } from '../../components/ui/Champ.jsx';
import Dialogue from '../../components/ui/Dialogue.jsx';
import { useAuth } from '../../contexte/Auth.jsx';
import { useLectureHorsLigne } from '../../hooks/useLectureHorsLigne.js';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';
import { JOURS, enHeure, enMinutes } from '../../lib/emploiDuTemps.js';

/** Création ou modification d'un créneau. */
function DialogueCreneau({ initial, enseignements, onFermer, onEnregistre }) {
  const [valeurs, setValeurs] = useState(initial);
  const [etat, setEtat] = useState({ envoi: false, erreur: null });
  const modifier = (cle) => (e) => setValeurs((v) => ({ ...v, [cle]: e.target.value }));
  const nouveau = !initial.id;

  async function envoyer(e) {
    e.preventDefault();
    setEtat({ envoi: true, erreur: null });
    const corps = {
      enseignementId: valeurs.enseignementId,
      jour: Number(valeurs.jour),
      heureDebut: valeurs.heureDebut,
      heureFin: valeurs.heureFin,
      salle: valeurs.salle || null,
    };
    try {
      await appelApi(nouveau ? '/creneaux' : `/creneaux/${initial.id}`, {
        methode: nouveau ? 'POST' : 'PATCH',
        corps,
      });
      onEnregistre();
    } catch (err) {
      setEtat({ envoi: false, erreur: err.message });
    }
  }

  async function supprimer() {
    setEtat({ envoi: true, erreur: null });
    try {
      await appelApi(`/creneaux/${initial.id}`, { methode: 'DELETE' });
      onEnregistre();
    } catch (err) {
      setEtat({ envoi: false, erreur: err.message });
    }
  }

  return (
    <Dialogue ouvert onFermer={onFermer} titre={nouveau ? 'Ajouter un cours' : 'Modifier le cours'}>
      <form onSubmit={envoyer} className="space-y-4">
        <ChampSelection
          libelle="Matière"
          value={valeurs.enseignementId}
          onChange={modifier('enseignementId')}
          options={enseignements.map((e) => ({
            valeur: e.id,
            libelle: `${e.matiere.nom}${e.enseignant ? ` · ${e.enseignant.prenoms[0]}. ${e.enseignant.nom}` : ''}`,
          }))}
          placeholder="Choisir…"
          obligatoire
        />
        <ChampSelection
          libelle="Jour"
          value={String(valeurs.jour)}
          onChange={modifier('jour')}
          options={JOURS.map((j, i) => ({ valeur: String(i + 1), libelle: j }))}
          obligatoire
        />
        <div className="grid grid-cols-2 gap-4">
          <Champ
            libelle="Début"
            type="time"
            step="300"
            value={valeurs.heureDebut}
            onChange={modifier('heureDebut')}
            obligatoire
          />
          <Champ
            libelle="Fin"
            type="time"
            step="300"
            value={valeurs.heureFin}
            onChange={modifier('heureFin')}
            obligatoire
          />
        </div>
        <Champ
          libelle="Salle"
          value={valeurs.salle ?? ''}
          onChange={modifier('salle')}
          placeholder="Ex. : B12, labo"
        />
        {etat.erreur && <Alerte type="erreur">{etat.erreur}</Alerte>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {!nouveau ? (
            <Bouton
              variante="discret"
              icone={Trash2}
              onClick={supprimer}
              className="text-rouge hover:bg-red-50"
            >
              Retirer de l’emploi du temps
            </Bouton>
          ) : (
            <span />
          )}
          <Bouton
            type="submit"
            icone={Save}
            chargement={etat.envoi}
            disabled={!valeurs.enseignementId}
          >
            Enregistrer
          </Bouton>
        </div>
      </form>
    </Dialogue>
  );
}

/** Direction et secrétariat : emploi du temps de chaque classe, modifiable. */
function EditeurClasses() {
  const [parametres, setParametres] = useSearchParams();
  const { donnees: liste } = useRequete('/classes');
  const classes = liste?.classes ?? [];
  const classeId = parametres.get('classe') ?? classes[0]?.id;
  const { donnees, erreur, chargement, recharger } = useRequete(
    classeId ? `/emplois-du-temps/classes/${classeId}` : null,
  );
  const { donnees: detail } = useRequete(classeId ? `/classes/${classeId}` : null);
  const enseignements = detail?.classe?.enseignements ?? [];
  const [edition, setEdition] = useState(null);

  const total = (donnees?.creneaux ?? []).reduce(
    (s, c) => s + enMinutes(c.heureFin) - enMinutes(c.heureDebut),
    0,
  );

  return (
    <div className="space-y-6">
      <EnTetePage
        titre="Emplois du temps"
        description="Touchez une heure libre pour ajouter un cours. Les conflits de classe, d’enseignant et de salle sont refusés."
      />
      <div className="entree flex flex-wrap items-center gap-4" style={{ '--delai': '60ms' }}>
        <select
          aria-label="Classe"
          value={classeId ?? ''}
          onChange={(e) => setParametres({ classe: e.target.value }, { replace: true })}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold sm:w-48 sm:text-sm"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
        {donnees && (
          <p className="text-sm text-slate-600">
            <span className="chiffres font-semibold text-slate-900">
              {Math.floor(total / 60)} h{total % 60 ? ` ${total % 60}` : ''}
            </span>{' '}
            de cours par semaine
          </p>
        )}
      </div>
      {liste && !classes.length && <Alerte type="info">Créez d’abord vos classes.</Alerte>}
      {erreur && <Alerte type="erreur">{erreur.message}</Alerte>}
      {chargement && classeId && <Chargement />}
      {donnees && (
        <GrilleEmploiDuTemps
          creneaux={donnees.creneaux}
          onCaseVide={(jour, heure) =>
            setEdition({
              jour,
              heureDebut: heure,
              heureFin: enHeure(Math.min(enMinutes(heure) + 60, 19 * 60)),
              enseignementId: '',
              salle: '',
            })
          }
          onCreneau={(c) => setEdition({ ...c })}
        />
      )}
      {edition && (
        <DialogueCreneau
          initial={edition}
          enseignements={enseignements}
          onFermer={() => setEdition(null)}
          onEnregistre={() => {
            setEdition(null);
            recharger();
          }}
        />
      )}
    </div>
  );
}

/** Lecture seule : enseignant (ses cours) ou élève (sa classe). */
function Consultation({ chemin, titre, description, afficherClasse }) {
  const { donnees, erreur, chargement, horsLigne } = useLectureHorsLigne(chemin);
  return (
    <div className="space-y-6">
      <EnTetePage titre={titre} description={description} />
      {horsLigne && (
        <Alerte type="info">Hors connexion : dernière version enregistrée sur ce téléphone.</Alerte>
      )}
      {erreur && <Alerte type="erreur">{erreur.message}</Alerte>}
      {chargement && <Chargement />}
      {donnees && (
        <GrilleEmploiDuTemps creneaux={donnees.creneaux} afficherClasse={afficherClasse} />
      )}
    </div>
  );
}

export default function EmploiDuTemps() {
  const { utilisateur } = useAuth();
  if (utilisateur.role === 'ENSEIGNANT') {
    return (
      <Consultation
        chemin="/emplois-du-temps/moi"
        titre="Mon emploi du temps"
        description="Vos cours de la semaine, toutes classes confondues."
        afficherClasse
      />
    );
  }
  if (utilisateur.role === 'ELEVE') {
    return (
      <Consultation
        chemin="/moi/emploi-du-temps"
        titre="Emploi du temps"
        description="Les cours de votre classe pour la semaine."
      />
    );
  }
  return <EditeurClasses />;
}
