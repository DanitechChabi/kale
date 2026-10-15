import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CircleCheck, Send } from 'lucide-react';
import Alerte from '../components/ui/Alerte.jsx';
import Bouton from '../components/ui/Bouton.jsx';
import Chargement from '../components/ui/Chargement.jsx';
import ChoixFichier from '../components/ui/ChoixFichier.jsx';
import { Cadre, Champ, ChampMotDePasse, ChampSelection } from '../components/ui/Champ.jsx';
import { useRequete } from '../hooks/useRequete.js';
import { appelApi } from '../lib/api.js';
import { LIBELLES_PIECES, piecesObligatoires } from '../lib/documents.js';

const ETAPES = ['Établissement', 'Responsable', 'Pièces', 'Envoi'];
const CLE_BROUILLON = 'edureleve:inscription-ecole';

const STATUTS = [
  ['PUBLIC', 'Public', 'Établissement de l’État'],
  ['PRIVE_LAIC', 'Privé laïc', 'Autorisé par arrêté'],
  ['PRIVE_CONFESSIONNEL', 'Privé confessionnel', 'Autorisé par arrêté'],
];
const TYPES = [
  { valeur: 'CEG', libelle: 'Collège d’enseignement général (CEG)' },
  { valeur: 'LYCEE', libelle: 'Lycée' },
  { valeur: 'LYCEE_TECHNIQUE', libelle: 'Lycée technique et professionnel' },
  { valeur: 'COMPLEXE_SCOLAIRE', libelle: 'Complexe scolaire' },
];
// Pièces pour lesquelles on demande la référence et la date de l'acte
const ACTES = ['AUTORISATION_CREATION_OUVERTURE', 'AUTORISATION_DIRIGER', 'ACTE_NOMINATION_CHEF'];

const VIDE = {
  ecole: {
    code: '',
    nom: '',
    sigle: '',
    statut: '',
    type: '',
    ordres: ['GENERAL'],
    nomChefEtablissement: '',
    departementId: '',
    communeId: '',
    adresse: '',
    telephone: '',
    email: '',
    typePeriode: 'TRIMESTRE',
  },
  responsable: { nom: '', prenoms: '', telephone: '', email: '', motDePasse: '', confirmation: '' },
  references: {},
};

// Le brouillon (sans mot de passe ni fichiers) survit à une coupure de connexion
function lireBrouillon() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_BROUILLON));
    return brut
      ? {
          ...VIDE,
          ...brut,
          responsable: {
            ...VIDE.responsable,
            ...brut.responsable,
            motDePasse: '',
            confirmation: '',
          },
        }
      : VIDE;
  } catch {
    return VIDE;
  }
}
function ecrireBrouillon(donnees) {
  try {
    const { motDePasse: _m, confirmation: _c, ...responsable } = donnees.responsable;
    localStorage.setItem(CLE_BROUILLON, JSON.stringify({ ...donnees, responsable }));
  } catch {
    /* stockage indisponible : sans conséquence */
  }
}
function effacerBrouillon() {
  try {
    localStorage.removeItem(CLE_BROUILLON);
  } catch {
    /* rien */
  }
}

const motDePasseValide = (m) => m.length >= 8 && /\p{L}/u.test(m) && /\d/.test(m);

function validerEtape(etape, donnees, fichiers) {
  const e = {};
  if (etape === 0) {
    const { ecole } = donnees;
    if (ecole.nom.trim().length < 3) e['ecole.nom'] = 'Indiquez le nom de l’établissement';
    if (ecole.code.trim().length < 2) e['ecole.code'] = 'Indiquez le code officiel';
    if (!ecole.statut) e['ecole.statut'] = 'Choisissez le statut';
    if (!ecole.type) e['ecole.type'] = 'Choisissez le type';
    if (!ecole.ordres.length) e['ecole.ordres'] = 'Choisissez au moins un ordre';
    if (ecole.nomChefEtablissement.trim().length < 3)
      e['ecole.nomChefEtablissement'] = 'Indiquez le nom du chef d’établissement';
    if (!ecole.communeId) e['ecole.communeId'] = 'Choisissez la commune';
    if (ecole.telephone.replace(/\D/g, '').length < 8)
      e['ecole.telephone'] = 'Numéro de téléphone invalide';
  }
  if (etape === 1) {
    const { responsable } = donnees;
    if (responsable.nom.trim().length < 2) e['responsable.nom'] = 'Indiquez le nom';
    if (responsable.prenoms.trim().length < 2) e['responsable.prenoms'] = 'Indiquez les prénoms';
    if (responsable.telephone.replace(/\D/g, '').length < 8)
      e['responsable.telephone'] = 'Numéro de téléphone invalide';
    if (!motDePasseValide(responsable.motDePasse))
      e['responsable.motDePasse'] = '8 caractères au moins, avec une lettre et un chiffre';
    if (responsable.confirmation !== responsable.motDePasse)
      e['responsable.confirmation'] = 'Les mots de passe ne correspondent pas';
  }
  if (etape === 2) {
    for (const type of piecesObligatoires(donnees.ecole.statut)) {
      if (!fichiers[type]) e[`pieces.${type}`] = 'Pièce obligatoire';
    }
  }
  return e;
}

/** Sélection d'une pièce justificative. */
function Piece({ type, obligatoire, fichier, reference, erreur, onFichier, onReference }) {
  return (
    <div
      className={`space-y-3 rounded-xl p-4 ring-1 transition ${
        erreur
          ? 'bg-red-50/50 ring-rouge/40'
          : fichier
            ? 'bg-marque-50/40 ring-marque-200'
            : 'bg-white ring-slate-200'
      }`}
    >
      <p className="font-medium text-slate-900">
        {LIBELLES_PIECES[type]}
        {obligatoire ? (
          <span className="text-rouge"> *</span>
        ) : (
          <span className="ml-1 text-xs font-normal text-slate-500">(facultatif)</span>
        )}
      </p>
      <ChoixFichier
        fichier={fichier}
        onChange={onFichier}
        libelle={LIBELLES_PIECES[type]}
        erreur={erreur}
      />
      {ACTES.includes(type) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ
            libelle="Référence de l’acte"
            placeholder="N° 2019-045/MESTFP/…"
            value={reference?.referenceActe ?? ''}
            onChange={(e) => onReference({ ...reference, referenceActe: e.target.value })}
          />
          <Champ
            libelle="Date de l’acte"
            type="date"
            value={reference?.dateActe ?? ''}
            onChange={(e) => onReference({ ...reference, dateActe: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

function Recapitulatif({ donnees, fichiers, departements }) {
  const { ecole, responsable } = donnees;
  const departement = departements.find((d) => d.id === ecole.departementId);
  const commune = departement?.communes.find((c) => c.id === ecole.communeId);
  const lignes = [
    ['Établissement', `${ecole.nom}${ecole.sigle ? ` (${ecole.sigle})` : ''}`],
    ['Code officiel', ecole.code.toUpperCase()],
    ['Statut', STATUTS.find(([v]) => v === ecole.statut)?.[1]],
    ['Type', TYPES.find((t) => t.valeur === ecole.type)?.libelle],
    ['Localisation', commune && `${commune.nom}, ${departement.nom}`],
    ['Chef d’établissement', ecole.nomChefEtablissement],
    [
      'Responsable du compte',
      `${responsable.prenoms} ${responsable.nom.toUpperCase()} · ${responsable.telephone}`,
    ],
    ['Pièces jointes', Object.values(fichiers).filter(Boolean).length],
  ];
  return (
    <dl className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
      {lignes.map(([libelle, valeur]) => (
        <div key={libelle} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-3">
          <dt className="text-slate-500">{libelle}</dt>
          <dd className="font-medium break-words text-slate-900 sm:col-span-2">{valeur}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function InscriptionEcole() {
  const { donnees: referentiel, chargement } = useRequete('/referentiel/departements');
  const [etape, setEtape] = useState(0);
  const [donnees, setDonnees] = useState(lireBrouillon);
  const [fichiers, setFichiers] = useState({});
  const [erreurs, setErreurs] = useState({});
  const [erreurGenerale, setErreurGenerale] = useState(null);
  const [attestation, setAttestation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState(null);
  const haut = useRef(null);

  useEffect(() => ecrireBrouillon(donnees), [donnees]);
  useEffect(() => haut.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), [etape]);

  const departements = referentiel?.departements ?? [];
  const communes = departements.find((d) => d.id === donnees.ecole.departementId)?.communes ?? [];
  const obligatoires = donnees.ecole.statut ? piecesObligatoires(donnees.ecole.statut) : [];
  const facultatives = ['LETTRE_MANDAT'];

  const modifierEcole = (cle) => (e) =>
    setDonnees((d) => ({ ...d, ecole: { ...d.ecole, [cle]: e.target.value } }));
  const modifierResponsable = (cle) => (e) =>
    setDonnees((d) => ({ ...d, responsable: { ...d.responsable, [cle]: e.target.value } }));

  function suivant() {
    const problemes = validerEtape(etape, donnees, fichiers);
    setErreurs(problemes);
    if (!Object.keys(problemes).length) setEtape((n) => n + 1);
  }

  async function envoyer() {
    setEnvoi(true);
    setErreurGenerale(null);
    const { departementId: _d, ...ecole } = donnees.ecole;
    const { confirmation: _c, ...responsable } = donnees.responsable;
    const pieces = new Set([...obligatoires, ...facultatives]);
    const references = Object.fromEntries(
      Object.entries(donnees.references).filter(
        ([type, r]) => pieces.has(type) && fichiers[type] && (r.referenceActe || r.dateActe),
      ),
    );
    const formulaire = new FormData();
    formulaire.append('donnees', JSON.stringify({ ecole, responsable, references }));
    for (const [type, fichier] of Object.entries(fichiers)) {
      if (fichier && pieces.has(type)) formulaire.append(type, fichier);
    }
    try {
      const reponse = await appelApi('/inscription-ecole', { methode: 'POST', corps: formulaire });
      effacerBrouillon();
      setResultat(reponse.ecole);
    } catch (err) {
      gererErreur(err);
    } finally {
      setEnvoi(false);
    }
  }

  // Renvoie l'utilisateur à l'étape concernée par l'erreur du serveur
  function gererErreur(err) {
    if (err.code === 'VALIDATION') {
      const parChamp = Object.fromEntries(err.details.map((d) => [d.champ, d.message]));
      setErreurs(parChamp);
      const premier = err.details[0]?.champ ?? '';
      setEtape(premier.startsWith('responsable') ? 1 : premier.startsWith('ecole') ? 0 : 3);
    } else if (err.code === 'ECOLE_EXISTANTE') {
      setErreurs({ 'ecole.code': err.message });
      setEtape(0);
    } else if (err.code === 'IDENTIFIANT_DEJA_UTILISE') {
      setErreurs({ 'responsable.telephone': err.message });
      setEtape(1);
    } else if (['PIECES_MANQUANTES', 'FICHIER_INVALIDE'].includes(err.code)) {
      setErreurGenerale(err.message);
      setEtape(2);
    } else {
      setErreurGenerale(err.message);
    }
  }

  if (resultat) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="entree mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-marque-50 text-marque-600">
          <CircleCheck className="h-9 w-9" />
        </div>
        <h1
          className="entree mt-6 text-2xl font-bold tracking-tight"
          style={{ '--delai': '120ms' }}
        >
          Dossier déposé
        </h1>
        <p className="entree mt-3 text-slate-600" style={{ '--delai': '220ms' }}>
          <strong>{resultat.nom}</strong> (code {resultat.code}) est en attente de vérification par
          le ministère. Connectez-vous avec votre téléphone pour suivre le dossier. Les comptes des
          enseignants et des élèves pourront être créés après validation.
        </p>
        <Link
          to="/connexion"
          className="entree mt-8 inline-flex items-center gap-2 rounded-lg bg-marque-600 px-5 py-3 text-sm font-semibold text-white hover:bg-marque-700"
          style={{ '--delai': '320ms' }}
        >
          Suivre mon dossier <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div ref={haut} className="mx-auto max-w-2xl scroll-mt-20 px-4 py-8 sm:py-12">
      <div className="entree space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Inscrire votre établissement
        </h1>
        <p className="text-slate-600">
          Le ministère vérifie chaque établissement à partir de ses documents officiels avant
          d’ouvrir ses comptes.
        </p>
      </div>

      {/* Progression */}
      <ol className="mt-8 grid grid-cols-4 gap-2" aria-label="Étapes">
        {ETAPES.map((libelle, i) => (
          <li key={libelle} className="space-y-2" aria-current={i === etape ? 'step' : undefined}>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full origin-left rounded-full bg-marque-500 transition-transform duration-500 ${i <= etape ? 'scale-x-100' : 'scale-x-0'}`}
              />
            </div>
            <p
              className={`text-xs font-semibold sm:text-sm ${i === etape ? 'text-marque-700' : i < etape ? 'text-slate-700' : 'text-slate-400'}`}
            >
              <span className="tabular-nums">{i + 1}.</span> {libelle}
            </p>
          </li>
        ))}
      </ol>

      <div key={etape} className="entree mt-8 space-y-6">
        {erreurGenerale && <Alerte type="erreur">{erreurGenerale}</Alerte>}

        {etape === 0 &&
          (chargement ? (
            <Chargement />
          ) : (
            <>
              <Champ
                libelle="Nom de l’établissement"
                value={donnees.ecole.nom}
                onChange={modifierEcole('nom')}
                erreur={erreurs['ecole.nom']}
                placeholder="CEG Les Cocotiers"
                obligatoire
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Champ
                  libelle="Code officiel"
                  value={donnees.ecole.code}
                  onChange={modifierEcole('code')}
                  erreur={erreurs['ecole.code']}
                  aide="Code attribué par le ministère"
                  obligatoire
                />
                <Champ
                  libelle="Sigle"
                  value={donnees.ecole.sigle}
                  onChange={modifierEcole('sigle')}
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-800">
                  Statut <span className="text-rouge">*</span>
                </legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {STATUTS.map(([valeur, libelle, detail]) => (
                    <label
                      key={valeur}
                      className={`cursor-pointer rounded-xl p-3 ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-marque-500 ${
                        donnees.ecole.statut === valeur
                          ? 'bg-marque-50 ring-marque-500'
                          : 'bg-white ring-slate-200 hover:ring-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="statut"
                        value={valeur}
                        checked={donnees.ecole.statut === valeur}
                        onChange={modifierEcole('statut')}
                        className="sr-only"
                      />
                      <span className="block font-semibold">{libelle}</span>
                      <span className="block text-xs text-slate-500">{detail}</span>
                    </label>
                  ))}
                </div>
                {erreurs['ecole.statut'] && (
                  <p className="text-sm text-rouge">{erreurs['ecole.statut']}</p>
                )}
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <ChampSelection
                  libelle="Type"
                  value={donnees.ecole.type}
                  onChange={modifierEcole('type')}
                  options={TYPES}
                  placeholder="Choisir…"
                  erreur={erreurs['ecole.type']}
                  obligatoire
                />
                <Cadre
                  id="ordres"
                  libelle="Ordres d’enseignement"
                  erreur={erreurs['ecole.ordres']}
                  obligatoire
                >
                  <div className="flex gap-4 pt-2">
                    {[
                      ['GENERAL', 'Général'],
                      ['TECHNIQUE', 'Technique'],
                    ].map(([valeur, libelle]) => (
                      <label key={valeur} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 accent-marque-600"
                          checked={donnees.ecole.ordres.includes(valeur)}
                          onChange={(e) =>
                            setDonnees((d) => ({
                              ...d,
                              ecole: {
                                ...d.ecole,
                                ordres: e.target.checked
                                  ? [...d.ecole.ordres, valeur]
                                  : d.ecole.ordres.filter((o) => o !== valeur),
                              },
                            }))
                          }
                        />
                        {libelle}
                      </label>
                    ))}
                  </div>
                </Cadre>
              </div>
              <Champ
                libelle="Chef d’établissement"
                value={donnees.ecole.nomChefEtablissement}
                onChange={modifierEcole('nomChefEtablissement')}
                erreur={erreurs['ecole.nomChefEtablissement']}
                placeholder="Nom du directeur, du principal ou du proviseur"
                obligatoire
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <ChampSelection
                  libelle="Département"
                  value={donnees.ecole.departementId}
                  onChange={(e) =>
                    setDonnees((d) => ({
                      ...d,
                      ecole: { ...d.ecole, departementId: e.target.value, communeId: '' },
                    }))
                  }
                  options={departements.map((d) => ({ valeur: d.id, libelle: d.nom }))}
                  placeholder="Choisir…"
                  obligatoire
                />
                <ChampSelection
                  libelle="Commune"
                  value={donnees.ecole.communeId}
                  onChange={modifierEcole('communeId')}
                  options={communes.map((c) => ({ valeur: c.id, libelle: c.nom }))}
                  placeholder={
                    donnees.ecole.departementId ? 'Choisir…' : 'Choisissez d’abord le département'
                  }
                  disabled={!donnees.ecole.departementId}
                  erreur={erreurs['ecole.communeId']}
                  obligatoire
                />
              </div>
              <Champ
                libelle="Adresse"
                value={donnees.ecole.adresse}
                onChange={modifierEcole('adresse')}
                placeholder="Quartier, rue, repère"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Champ
                  libelle="Téléphone de l’établissement"
                  type="tel"
                  inputMode="tel"
                  value={donnees.ecole.telephone}
                  onChange={modifierEcole('telephone')}
                  erreur={erreurs['ecole.telephone']}
                  placeholder="01 21 30 00 00"
                  obligatoire
                />
                <Champ
                  libelle="E-mail de l’établissement"
                  type="email"
                  value={donnees.ecole.email}
                  onChange={modifierEcole('email')}
                  erreur={erreurs['ecole.email']}
                />
              </div>
              <ChampSelection
                libelle="Découpage de l’année scolaire"
                value={donnees.ecole.typePeriode}
                onChange={modifierEcole('typePeriode')}
                options={[
                  { valeur: 'TRIMESTRE', libelle: 'Trimestres' },
                  { valeur: 'SEMESTRE', libelle: 'Semestres' },
                ]}
              />
            </>
          ))}

        {etape === 1 && (
          <>
            <Alerte type="info">
              Ce compte gère l’établissement sur la plateforme et suit la vérification du dossier.
            </Alerte>
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ
                libelle="Nom"
                value={donnees.responsable.nom}
                onChange={modifierResponsable('nom')}
                erreur={erreurs['responsable.nom']}
                autoComplete="family-name"
                obligatoire
              />
              <Champ
                libelle="Prénoms"
                value={donnees.responsable.prenoms}
                onChange={modifierResponsable('prenoms')}
                erreur={erreurs['responsable.prenoms']}
                autoComplete="given-name"
                obligatoire
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ
                libelle="Téléphone"
                type="tel"
                inputMode="tel"
                value={donnees.responsable.telephone}
                onChange={modifierResponsable('telephone')}
                erreur={erreurs['responsable.telephone']}
                aide="Servira d’identifiant de connexion"
                placeholder="01 97 00 00 00"
                autoComplete="tel"
                obligatoire
              />
              <Champ
                libelle="E-mail"
                type="email"
                value={donnees.responsable.email}
                onChange={modifierResponsable('email')}
                erreur={erreurs['responsable.email']}
                autoComplete="email"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ChampMotDePasse
                libelle="Mot de passe"
                value={donnees.responsable.motDePasse}
                onChange={modifierResponsable('motDePasse')}
                erreur={erreurs['responsable.motDePasse']}
                aide="8 caractères au moins, avec une lettre et un chiffre"
                autoComplete="new-password"
                obligatoire
              />
              <ChampMotDePasse
                libelle="Confirmation"
                value={donnees.responsable.confirmation}
                onChange={modifierResponsable('confirmation')}
                erreur={erreurs['responsable.confirmation']}
                autoComplete="new-password"
                obligatoire
              />
            </div>
          </>
        )}

        {etape === 2 && (
          <>
            <p className="text-sm text-slate-600">
              Joignez des copies lisibles (scan ou photo nette). Les pièces exigées dépendent du
              statut de l’établissement.
            </p>
            {[...obligatoires, ...facultatives].map((type) => (
              <Piece
                key={type}
                type={type}
                obligatoire={obligatoires.includes(type)}
                fichier={fichiers[type]}
                reference={donnees.references[type]}
                erreur={erreurs[`pieces.${type}`]}
                onFichier={(f) => setFichiers((actuels) => ({ ...actuels, [type]: f }))}
                onReference={(r) =>
                  setDonnees((d) => ({ ...d, references: { ...d.references, [type]: r } }))
                }
              />
            ))}
          </>
        )}

        {etape === 3 && (
          <>
            <Recapitulatif donnees={donnees} fichiers={fichiers} departements={departements} />
            <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
              <input
                type="checkbox"
                checked={attestation}
                onChange={(e) => setAttestation(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-marque-600"
              />
              <span>
                J’atteste être habilité à inscrire cet établissement et que les informations et
                documents fournis sont exacts.
              </span>
            </label>
          </>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-6">
          {etape > 0 ? (
            <Bouton variante="secondaire" icone={ArrowLeft} onClick={() => setEtape((n) => n - 1)}>
              Retour
            </Bouton>
          ) : (
            <Link to="/connexion" className="text-sm font-semibold text-marque-700 hover:underline">
              Déjà inscrit ? Se connecter
            </Link>
          )}
          {etape < 3 ? (
            <Bouton onClick={suivant}>
              Continuer <ArrowRight className="h-4 w-4" />
            </Bouton>
          ) : (
            <Bouton icone={Send} chargement={envoi} disabled={!attestation} onClick={envoyer}>
              Déposer le dossier
            </Bouton>
          )}
        </div>
      </div>
    </div>
  );
}
