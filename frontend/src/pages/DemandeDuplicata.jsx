import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Search, Send, X } from 'lucide-react';
import Guilloche from '../components/Guilloche.jsx';
import Alerte from '../components/ui/Alerte.jsx';
import Bouton from '../components/ui/Bouton.jsx';
import { Champ, ChampSelection } from '../components/ui/Champ.jsx';
import { appelApi, erreursParChamp } from '../lib/api.js';
import { formaterDate } from '../lib/navigation.js';

const VIDE = {
  ecoleId: '',
  typeDocument: 'BULLETIN_PERIODE',
  libelleAnnee: '',
  numeroPeriode: '1',
  classeDeclaree: '',
  nomEleve: '',
  prenomsEleve: '',
  dateNaissance: '',
  matriculeDeclare: '',
  nomDemandeur: '',
  telephone: '',
  email: '',
  motif: '',
};

// Années proposées : de l'année en cours jusqu'à trente ans en arrière
const ANNEES = (() => {
  const maintenant = new Date();
  const fin = maintenant.getMonth() >= 8 ? maintenant.getFullYear() : maintenant.getFullYear() - 1;
  return Array.from({ length: 30 }, (_, i) => {
    const debut = fin - i;
    return { valeur: `${debut}-${debut + 1}`, libelle: `${debut}-${debut + 1}` };
  });
})();

/** Recherche d'un établissement vérifié (nom, sigle ou commune). */
function ChoixEtablissement({ choisi, onChoisir, erreur }) {
  const [texte, setTexte] = useState('');
  const [resultats, setResultats] = useState(null);

  useEffect(() => {
    if (choisi) return undefined;
    const controleur = new AbortController();
    // Petite attente : une seule requête quand la saisie se stabilise
    const minuteur = setTimeout(() => {
      appelApi(`/public/etablissements?q=${encodeURIComponent(texte.trim())}`, {
        signal: controleur.signal,
      }).then(
        (r) => setResultats(r.etablissements),
        () => {},
      );
    }, 250);
    return () => {
      clearTimeout(minuteur);
      controleur.abort();
    };
  }, [texte, choisi]);

  if (choisi) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-marque-50 p-3 ring-1 ring-marque-500">
        <Building2 className="h-5 w-5 shrink-0 text-marque-700" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{choisi.nom}</p>
          {choisi.commune && <p className="text-xs text-slate-600">{choisi.commune}</p>}
        </div>
        <button
          type="button"
          onClick={() => onChoisir(null)}
          className="rounded-lg p-2 text-slate-600 hover:bg-white"
          aria-label="Changer d’établissement"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor="recherche-ecole" className="block text-sm font-medium text-slate-800">
        Établissement fréquenté <span className="text-rouge">*</span>
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400" />
        <input
          id="recherche-ecole"
          type="search"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Nom, sigle ou commune"
          autoComplete="off"
          className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-base focus:border-marque-500 focus:ring-2 focus:ring-marque-500/20 focus:outline-none sm:text-sm"
        />
      </div>
      {erreur && <p className="text-sm text-rouge">{erreur}</p>}
      {resultats && (
        <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl bg-white ring-1 ring-slate-200">
          {resultats.length ? (
            resultats.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onChoisir(e)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                >
                  <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.nom}</span>
                  {e.commune && <span className="text-xs text-slate-500">{e.commune}</span>}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-3 text-sm text-slate-500">
              Aucun établissement trouvé. Seuls les établissements inscrits sur EduRelevé
              apparaissent.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function Confirmation({ resultat, telephone }) {
  return (
    <div className="entree space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-encre p-6 text-white">
        <Guilloche
          variante="bande"
          largeur={800}
          hauteur={120}
          lignes={12}
          anime
          className="absolute inset-x-0 bottom-0 h-24 w-full text-or/25"
        />
        <p className="etiquette !text-or/90">Demande enregistrée</p>
        <p className="mt-2 text-sm text-marque-100">Votre numéro de suivi</p>
        <p className="tampon-frappe chiffres mt-1 text-3xl font-semibold tracking-wide sm:text-4xl">
          {resultat.numeroSuivi}
        </p>
        <p className="relative mt-4 text-sm text-marque-100">
          Adressée à {resultat.etablissement} le {formaterDate(resultat.demandeLe, true)}.
        </p>
      </div>
      <div className="space-y-2 text-slate-700">
        <p>
          Notez ce numéro. Avec le téléphone indiqué ({telephone}), il vous permet de suivre la
          demande et de télécharger le document dès que le secrétariat l’a délivré.
        </p>
      </div>
      <Link
        to={`/duplicata/suivi?numero=${encodeURIComponent(resultat.numeroSuivi)}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-marque-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-marque-700"
      >
        Suivre ma demande
      </Link>
    </div>
  );
}

export default function DemandeDuplicata() {
  const [donnees, setDonnees] = useState(VIDE);
  const [ecole, setEcole] = useState(null);
  const [erreurs, setErreurs] = useState({});
  const [erreurGenerale, setErreurGenerale] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState(null);

  const modifier = (cle) => (e) => setDonnees((d) => ({ ...d, [cle]: e.target.value }));

  async function envoyer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreurs({});
    setErreurGenerale(null);
    // Champs facultatifs vides : non transmis
    const corps = Object.fromEntries(
      Object.entries({ ...donnees, ecoleId: ecole?.id ?? '' }).filter(
        ([cle, valeur]) =>
          valeur !== '' && !(cle === 'numeroPeriode' && donnees.typeDocument === 'RELEVE_ANNUEL'),
      ),
    );
    try {
      setResultat(await appelApi('/public/duplicata', { methode: 'POST', corps }));
      window.scrollTo?.({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErreurs(erreursParChamp(err));
      setErreurGenerale(err.code === 'VALIDATION' ? 'Vérifiez les champs signalés.' : err.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      {resultat ? (
        <Confirmation resultat={resultat} telephone={donnees.telephone} />
      ) : (
        <>
          <div className="entree space-y-2">
            <p className="etiquette">Sans déplacement</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Demander un duplicata</h1>
            <p className="text-slate-600">
              Bulletin ou relevé de notes archivé par votre ancien établissement. Le secrétariat
              retrouve le document et le met à votre disposition en ligne.{' '}
              <Link to="/duplicata/suivi" className="font-semibold text-marque-700 hover:underline">
                Suivre une demande
              </Link>
            </p>
          </div>

          <form onSubmit={envoyer} className="entree mt-8 space-y-8" noValidate>
            {erreurGenerale && <Alerte type="erreur">{erreurGenerale}</Alerte>}

            <fieldset className="space-y-4">
              <legend className="etiquette mb-3 block w-full border-b-2 border-slate-900 pb-2">
                1. Le document
              </legend>
              <ChoixEtablissement choisi={ecole} onChoisir={setEcole} erreur={erreurs.ecoleId} />
              <div className="grid gap-4 sm:grid-cols-2">
                <ChampSelection
                  libelle="Document"
                  value={donnees.typeDocument}
                  onChange={modifier('typeDocument')}
                  options={[
                    { valeur: 'BULLETIN_PERIODE', libelle: 'Bulletin d’une période' },
                    { valeur: 'RELEVE_ANNUEL', libelle: 'Relevé de notes annuel' },
                  ]}
                  obligatoire
                />
                <ChampSelection
                  libelle="Année scolaire"
                  value={donnees.libelleAnnee}
                  onChange={modifier('libelleAnnee')}
                  options={ANNEES}
                  placeholder="Choisir…"
                  erreur={erreurs.libelleAnnee}
                  obligatoire
                />
                {donnees.typeDocument === 'BULLETIN_PERIODE' && (
                  <ChampSelection
                    libelle="Période"
                    value={donnees.numeroPeriode}
                    onChange={modifier('numeroPeriode')}
                    options={[
                      { valeur: '1', libelle: '1er trimestre ou semestre' },
                      { valeur: '2', libelle: '2e trimestre ou semestre' },
                      { valeur: '3', libelle: '3e trimestre' },
                    ]}
                    erreur={erreurs.numeroPeriode}
                    obligatoire
                  />
                )}
                <Champ
                  libelle="Classe"
                  value={donnees.classeDeclaree}
                  onChange={modifier('classeDeclaree')}
                  placeholder="Ex. : Tle D 2"
                  erreur={erreurs.classeDeclaree}
                />
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="etiquette mb-3 block w-full border-b-2 border-slate-900 pb-2">
                2. L’élève
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Champ
                  libelle="Nom"
                  value={donnees.nomEleve}
                  onChange={modifier('nomEleve')}
                  erreur={erreurs.nomEleve}
                  autoComplete="family-name"
                  obligatoire
                />
                <Champ
                  libelle="Prénoms"
                  value={donnees.prenomsEleve}
                  onChange={modifier('prenomsEleve')}
                  erreur={erreurs.prenomsEleve}
                  autoComplete="given-name"
                  obligatoire
                />
                <Champ
                  libelle="Date de naissance"
                  type="date"
                  value={donnees.dateNaissance}
                  onChange={modifier('dateNaissance')}
                  erreur={erreurs.dateNaissance}
                  obligatoire
                />
                <Champ
                  libelle="Matricule"
                  value={donnees.matriculeDeclare}
                  onChange={modifier('matriculeDeclare')}
                  erreur={erreurs.matriculeDeclare}
                  aide="S’il figure sur un ancien bulletin"
                />
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="etiquette mb-3 block w-full border-b-2 border-slate-900 pb-2">
                3. Vos coordonnées
              </legend>
              <Champ
                libelle="Nom et prénoms du demandeur"
                value={donnees.nomDemandeur}
                onChange={modifier('nomDemandeur')}
                erreur={erreurs.nomDemandeur}
                aide="L’élève lui-même, un parent ou un tuteur"
                autoComplete="name"
                obligatoire
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Champ
                  libelle="Téléphone"
                  type="tel"
                  inputMode="tel"
                  value={donnees.telephone}
                  onChange={modifier('telephone')}
                  erreur={erreurs.telephone}
                  placeholder="01 97 00 00 00"
                  aide="Nécessaire pour suivre la demande"
                  autoComplete="tel"
                  obligatoire
                />
                <Champ
                  libelle="E-mail"
                  type="email"
                  value={donnees.email}
                  onChange={modifier('email')}
                  erreur={erreurs.email}
                  autoComplete="email"
                />
              </div>
              <Champ
                libelle="Motif"
                value={donnees.motif}
                onChange={modifier('motif')}
                erreur={erreurs.motif}
                placeholder="Ex. : inscription à l’université, concours, emploi"
              />
            </fieldset>

            <div className="border-t border-slate-200 pt-6">
              <Bouton type="submit" icone={Send} chargement={envoi} className="w-full sm:w-auto">
                Envoyer la demande
              </Bouton>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
