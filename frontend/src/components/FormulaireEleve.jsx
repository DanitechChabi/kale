import { useState } from 'react';
import { Save } from 'lucide-react';
import Alerte from './ui/Alerte.jsx';
import Bouton from './ui/Bouton.jsx';
import { Champ, ChampSelection } from './ui/Champ.jsx';
import { appelApi, erreursParChamp } from '../lib/api.js';

const VIDE = {
  nom: '',
  prenoms: '',
  sexe: '',
  dateNaissance: '',
  lieuNaissance: '',
  matricule: '',
  npi: '',
  nomContactParent: '',
  telephoneContactParent: '',
  classeId: '',
};

/** Création ou modification d'une fiche élève. */
export default function FormulaireEleve({ eleve, classes, onEnregistre }) {
  const [champs, setChamps] = useState(() =>
    eleve
      ? Object.fromEntries(
          Object.keys(VIDE).map((cle) => [
            cle,
            cle === 'dateNaissance' ? eleve.dateNaissance.slice(0, 10) : (eleve[cle] ?? ''),
          ]),
        )
      : VIDE,
  );
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const erreurs = erreursParChamp(erreur);
  const modifier = (cle) => (e) => setChamps((c) => ({ ...c, [cle]: e.target.value }));

  async function enregistrer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const { classeId, ...donnees } = champs;
    try {
      const resultat = eleve
        ? await appelApi(`/eleves/${eleve.id}`, { methode: 'PATCH', corps: donnees })
        : await appelApi('/eleves', {
            methode: 'POST',
            corps: { ...donnees, classeId: classeId || null },
          });
      onEnregistre(resultat.eleve);
    } catch (err) {
      setErreur(err);
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={enregistrer} className="space-y-4" noValidate>
      {erreur && !Object.keys(erreurs).length && <Alerte type="erreur">{erreur.message}</Alerte>}
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
      <div className="grid gap-4 sm:grid-cols-3">
        <ChampSelection
          libelle="Sexe"
          value={champs.sexe}
          onChange={modifier('sexe')}
          placeholder="Choisir…"
          options={[
            { valeur: 'F', libelle: 'Féminin' },
            { valeur: 'M', libelle: 'Masculin' },
          ]}
          erreur={erreurs.sexe}
          obligatoire
        />
        <Champ
          libelle="Date de naissance"
          type="date"
          value={champs.dateNaissance}
          onChange={modifier('dateNaissance')}
          erreur={erreurs.dateNaissance}
          obligatoire
        />
        <Champ
          libelle="Lieu de naissance"
          value={champs.lieuNaissance}
          onChange={modifier('lieuNaissance')}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ
          libelle="Matricule"
          value={champs.matricule}
          onChange={modifier('matricule')}
          aide={eleve ? undefined : 'Laissez vide pour une numérotation automatique'}
          erreur={erreurs.matricule}
        />
        <Champ
          libelle="NPI"
          inputMode="numeric"
          value={champs.npi}
          onChange={modifier('npi')}
          aide="Numéro personnel d’identification, si connu"
          erreur={erreurs.npi}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ
          libelle="Parent ou tuteur"
          value={champs.nomContactParent}
          onChange={modifier('nomContactParent')}
          erreur={erreurs.nomContactParent}
        />
        <Champ
          libelle="Téléphone du parent"
          type="tel"
          inputMode="tel"
          value={champs.telephoneContactParent}
          onChange={modifier('telephoneContactParent')}
          placeholder="01 97 00 00 00"
          erreur={erreurs.telephoneContactParent}
        />
      </div>
      {!eleve && classes?.length > 0 && (
        <ChampSelection
          libelle="Inscrire dans la classe"
          value={champs.classeId}
          onChange={modifier('classeId')}
          placeholder="Plus tard"
          options={classes.map((c) => ({ valeur: c.id, libelle: c.nom }))}
        />
      )}
      <Bouton type="submit" icone={Save} chargement={envoi} className="w-full">
        {eleve ? 'Enregistrer les modifications' : 'Créer la fiche élève'}
      </Bouton>
    </form>
  );
}
