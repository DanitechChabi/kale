import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CircleAlert,
  CircleCheck,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Upload,
  UserCheck,
} from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { ChampSelection } from '../../components/ui/Champ.jsx';
import Onglets from '../../components/ui/Onglets.jsx';
import { appelApi } from '../../lib/api.js';
import { formaterDate } from '../../lib/navigation.js';

const STATUTS = {
  nouveau: ['À importer', 'bg-marque-50 text-marque-700'],
  existant: ['Déjà connu', 'bg-sky-50 text-sky-800'],
  erreur: ['À corriger', 'bg-red-50 text-red-700'],
  doublon: ['Doublon', 'bg-slate-100 text-slate-600'],
};

async function telechargerModele() {
  const contenu = await appelApi('/import/eleves/modele', { format: 'blob' });
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(contenu);
  lien.download = 'modele-liste-eleves.xlsx';
  lien.click();
  setTimeout(() => URL.revokeObjectURL(lien.href), 10_000);
}

function Depot({ onAnalyse }) {
  const entree = useRef(null);
  const [survol, setSurvol] = useState(false);
  const [etat, setEtat] = useState({ envoi: false, erreur: null });

  async function analyser(fichier) {
    if (!fichier) return;
    setEtat({ envoi: true, erreur: null });
    const formulaire = new FormData();
    formulaire.append('fichier', fichier);
    try {
      onAnalyse(
        await appelApi('/import/eleves/analyse', { methode: 'POST', corps: formulaire }),
        fichier.name,
      );
    } catch (err) {
      setEtat({ envoi: false, erreur: err.message });
    }
  }

  return (
    <div className="space-y-4">
      {etat.erreur && <Alerte type="erreur">{etat.erreur}</Alerte>}
      <input
        ref={entree}
        type="file"
        accept=".xlsx,.csv"
        className="sr-only"
        onChange={(e) => analyser(e.target.files[0])}
        aria-label="Liste des élèves"
      />
      <button
        type="button"
        onClick={() => entree.current.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          analyser(e.dataTransfer.files[0]);
        }}
        disabled={etat.envoi}
        className={`flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
          survol
            ? 'scale-[1.01] border-marque-500 bg-marque-50'
            : 'border-slate-300 bg-white hover:border-marque-400 hover:bg-marque-50/40'
        }`}
      >
        {etat.envoi ? (
          <Chargement texte="Lecture de la liste…" />
        ) : (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-marque-50 text-marque-600">
              <FileSpreadsheet className="h-7 w-7" />
            </span>
            <span className="text-base font-semibold">Choisir la liste des élèves</span>
            <span className="max-w-md text-sm text-slate-500">
              Fichier Excel (.xlsx) ou CSV, tel que vous le tenez déjà : les colonnes sont reconnues
              automatiquement, même avec un titre au-dessus ou « Nom et prénoms » dans une seule
              colonne.
            </span>
          </>
        )}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
        <p className="text-slate-600">
          Pas encore de fichier ? Partez du modèle, qui contient déjà la liste de vos classes.
        </p>
        <Bouton variante="secondaire" icone={Download} onClick={telechargerModele}>
          Télécharger le modèle
        </Bouton>
      </div>
    </div>
  );
}

function Apercu({ analyse, nomFichier, onRecommencer, onImporte }) {
  const [filtre, setFiltre] = useState('tout');
  const [classeParDefaut, setClasseParDefaut] = useState('');
  const [etat, setEtat] = useState({ envoi: false, erreur: null });
  const { resume, lignes, classes, classesInconnues, colonnes } = analyse;

  const aImporter = lignes.filter(
    (l) => l.statut === 'nouveau' || (l.statut === 'existant' && !l.eleveExistant?.classe),
  );
  const sansClasse = aImporter.filter((l) => !l.donnees.classeId).length;
  const visibles = useMemo(
    () => (filtre === 'tout' ? lignes : lignes.filter((l) => l.statut === filtre)),
    [filtre, lignes],
  );

  async function importer() {
    setEtat({ envoi: true, erreur: null });
    try {
      const resultat = await appelApi('/import/eleves', {
        methode: 'POST',
        corps: {
          classeId: classeParDefaut || null,
          lignes: aImporter.map((l) => {
            const { classe: _c, ...donnees } = l.donnees;
            return { numero: l.numero, ...donnees };
          }),
        },
      });
      onImporte(resultat);
    } catch (err) {
      setEtat({ envoi: false, erreur: err.message });
    }
  }

  return (
    <div className="space-y-5">
      <div className="entree grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['nouveau', resume.nouveaux, CircleCheck, 'text-marque-700'],
          ['existant', resume.existants, UserCheck, 'text-sky-700'],
          ['erreur', resume.erreurs, CircleAlert, 'text-rouge'],
          ['doublon', resume.doublons, RotateCcw, 'text-slate-500'],
        ].map(([statut, nombre, Icone, couleur]) => (
          <div key={statut} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <Icone className={`h-5 w-5 ${couleur}`} />
            <p className="mt-2 text-2xl font-bold tabular-nums">{nombre}</p>
            <p className="text-sm text-slate-500">{STATUTS[statut][0]}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-600">
        <strong>{nomFichier}</strong> · colonnes reconnues :{' '}
        {colonnes
          .filter((c) => c.champ)
          .map((c) => c.entete)
          .join(', ')}
        {colonnes.some((c) => !c.champ) && (
          <span className="text-slate-400">
            {' '}
            · ignorées :{' '}
            {colonnes
              .filter((c) => !c.champ)
              .map((c) => c.entete)
              .join(', ')}
          </span>
        )}
      </p>
      {classesInconnues.length > 0 && (
        <Alerte type="attention" titre="Classes introuvables">
          {classesInconnues.join(', ')} : créez ces classes puis relancez l’analyse, ou choisissez
          une classe ci-dessous.
        </Alerte>
      )}

      <Onglets
        onglets={[
          ['tout', 'Tout', resume.total],
          ['nouveau', STATUTS.nouveau[0], resume.nouveaux],
          ['erreur', STATUTS.erreur[0], resume.erreurs],
          ['existant', STATUTS.existant[0], resume.existants],
        ]}
        actif={filtre}
        onChange={setFiltre}
      />
      <div className="max-h-[28rem] overflow-auto rounded-xl ring-1 ring-slate-200">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Ligne</th>
              <th className="px-3 py-2 font-semibold">Élève</th>
              <th className="px-3 py-2 font-semibold">Naissance</th>
              <th className="px-3 py-2 font-semibold">Classe</th>
              <th className="px-3 py-2 font-semibold">État</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {visibles.map((l) => (
              <tr key={l.numero} className={l.statut === 'erreur' ? 'bg-red-50/40' : ''}>
                <td className="px-3 py-2 text-slate-500 tabular-nums">{l.numero}</td>
                <td className="px-3 py-2">
                  <span className="font-medium">{l.donnees.nom || '—'}</span> {l.donnees.prenoms}
                  {l.donnees.sexe && (
                    <span className="ml-1 text-xs text-slate-500">({l.donnees.sexe})</span>
                  )}
                  {[...l.erreurs, ...l.avertissements].map((m) => (
                    <span
                      key={m}
                      className={`block text-xs ${l.erreurs.includes(m) ? 'text-rouge' : 'text-amber-700'}`}
                    >
                      {m}
                    </span>
                  ))}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {l.donnees.dateNaissance ? formaterDate(l.donnees.dateNaissance) : '—'}
                </td>
                <td className="px-3 py-2">{l.donnees.classe ?? '—'}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUTS[l.statut][1]}`}
                  >
                    {STATUTS[l.statut][0]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sansClasse > 0 && (
        <ChampSelection
          libelle={`Classe pour les ${sansClasse} élève${sansClasse > 1 ? 's' : ''} sans classe reconnue`}
          value={classeParDefaut}
          onChange={(e) => setClasseParDefaut(e.target.value)}
          placeholder="Ne pas inscrire pour l’instant"
          options={classes.map((c) => ({ valeur: c.id, libelle: c.nom }))}
        />
      )}
      {resume.erreurs > 0 && (
        <p className="text-sm text-slate-600">
          Les {resume.erreurs} ligne{resume.erreurs > 1 ? 's' : ''} à corriger seront ignorée
          {resume.erreurs > 1 ? 's' : ''}. Corrigez le fichier et importez-le à nouveau : les élèves
          déjà importés seront reconnus.
        </p>
      )}
      {etat.erreur && <Alerte type="erreur">{etat.erreur}</Alerte>}
      <div className="flex flex-wrap gap-2">
        <Bouton
          icone={Upload}
          chargement={etat.envoi}
          disabled={!aImporter.length}
          onClick={importer}
        >
          Importer {aImporter.length} élève{aImporter.length > 1 ? 's' : ''}
        </Bouton>
        <Bouton variante="secondaire" onClick={onRecommencer}>
          Choisir un autre fichier
        </Bouton>
      </div>
    </div>
  );
}

export default function ImportEleves() {
  const [analyse, setAnalyse] = useState(null);
  const [resultat, setResultat] = useState(null);

  return (
    <div className="space-y-6">
      <EnTetePage
        retour={{ vers: '/espace/eleves', libelle: 'Élèves' }}
        surtitre="Scolarité"
        titre="Importer une liste d’élèves"
        description="Rien n’est enregistré avant votre confirmation : vous vérifiez d’abord chaque ligne."
      />
      {resultat ? (
        <div className="entree space-y-4 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <CircleCheck className="mx-auto h-12 w-12 text-marque-600" />
          <p className="text-xl font-bold">
            {resultat.crees} élève{resultat.crees > 1 ? 's' : ''} enregistré
            {resultat.crees > 1 ? 's' : ''}
          </p>
          <p className="text-slate-600">
            {resultat.inscrits} inscription{resultat.inscrits > 1 ? 's' : ''} en classe
            {resultat.ignores.length > 0 &&
              ` · ${resultat.ignores.length} ligne${resultat.ignores.length > 1 ? 's' : ''} ignorée${resultat.ignores.length > 1 ? 's' : ''}`}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              to="/espace/classes"
              className="rounded-lg bg-marque-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-marque-700"
            >
              Voir les classes
            </Link>
            <Bouton
              variante="secondaire"
              onClick={() => {
                setAnalyse(null);
                setResultat(null);
              }}
            >
              Importer une autre liste
            </Bouton>
          </div>
        </div>
      ) : analyse ? (
        <Apercu
          analyse={analyse.donnees}
          nomFichier={analyse.nom}
          onRecommencer={() => setAnalyse(null)}
          onImporte={setResultat}
        />
      ) : (
        <Depot onAnalyse={(donnees, nom) => setAnalyse({ donnees, nom })} />
      )}
    </div>
  );
}
