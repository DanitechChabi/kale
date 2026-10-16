import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookPlus, ClipboardPlus, Send } from 'lucide-react';
import CopiesDevoir from '../../components/CopiesDevoir.jsx';
import EnTetePage from '../../components/EnTetePage.jsx';
import ListeCours from '../../components/ListeCours.jsx';
import ListeDevoirs from '../../components/ListeDevoirs.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { Cadre, Champ } from '../../components/ui/Champ.jsx';
import ChoixFichier from '../../components/ui/ChoixFichier.jsx';
import Dialogue from '../../components/ui/Dialogue.jsx';
import Onglets from '../../components/ui/Onglets.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi, erreursParChamp } from '../../lib/api.js';
import { controlerFichier } from '../../lib/documents.js';
import { dateLocale } from '../../lib/emploiDuTemps.js';

const TYPES = [
  ['DOCUMENT', 'Document PDF'],
  ['VIDEO', 'Vidéo'],
  ['LIEN', 'Lien'],
];

const zoneTexte =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-marque-500 focus:ring-2 focus:ring-marque-500/20 focus:outline-none sm:text-sm';

/** Envoi multipart commun aux cours et devoirs. */
async function publier(chemin, champs, fichier) {
  const formulaire = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) {
    if (valeur !== '' && valeur !== null && valeur !== undefined) formulaire.append(cle, valeur);
  }
  if (fichier) formulaire.append('fichier', fichier);
  return appelApi(chemin, { methode: 'POST', corps: formulaire });
}

function DialoguePublication({ type: nature, enseignementId, onFermer, onPublie }) {
  const estCours = nature === 'cours';
  const [valeurs, setValeurs] = useState({
    titre: '',
    description: '',
    type: 'DOCUMENT',
    url: '',
    consignes: '',
    pourLe: '',
  });
  const [fichier, setFichier] = useState(null);
  const [etat, setEtat] = useState({ envoi: false, erreur: null, erreurs: {} });
  const modifier = (cle) => (e) => setValeurs((v) => ({ ...v, [cle]: e.target.value }));
  const fichierAttendu = estCours && valeurs.type === 'DOCUMENT';

  async function envoyer(e) {
    e.preventDefault();
    const probleme = fichier && controlerFichier(fichier);
    if (probleme && !probleme.includes('volumineux')) {
      setEtat({ envoi: false, erreur: probleme, erreurs: {} });
      return;
    }
    setEtat({ envoi: true, erreur: null, erreurs: {} });
    try {
      const champs = estCours
        ? {
            enseignementId,
            titre: valeurs.titre,
            description: valeurs.description,
            type: valeurs.type,
            url: valeurs.type === 'DOCUMENT' ? '' : valeurs.url,
          }
        : {
            enseignementId,
            titre: valeurs.titre,
            consignes: valeurs.consignes,
            pourLe: valeurs.pourLe,
          };
      await publier(
        estCours ? '/cours' : '/devoirs',
        champs,
        fichierAttendu || !estCours ? fichier : null,
      );
      onPublie();
    } catch (err) {
      setEtat({
        envoi: false,
        erreur: err.code === 'VALIDATION' ? 'Vérifiez les champs signalés.' : err.message,
        erreurs: erreursParChamp(err),
      });
    }
  }

  return (
    <Dialogue ouvert onFermer={onFermer} titre={estCours ? 'Publier un cours' : 'Donner un devoir'}>
      <form onSubmit={envoyer} className="space-y-4" noValidate>
        <Champ
          libelle="Titre"
          value={valeurs.titre}
          onChange={modifier('titre')}
          erreur={etat.erreurs.titre}
          placeholder={
            estCours ? 'Ex. : Chapitre 3 — Théorème de Thalès' : 'Ex. : Exercices 4 à 7 page 52'
          }
          obligatoire
        />
        {estCours ? (
          <>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-800">Support</legend>
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                {TYPES.map(([valeur, libelle]) => (
                  <label
                    key={valeur}
                    className={`flex-1 cursor-pointer rounded-md py-1.5 text-center text-sm font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-marque-500 ${
                      valeurs.type === valeur ? 'bg-white shadow-md' : 'text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={valeur}
                      checked={valeurs.type === valeur}
                      onChange={modifier('type')}
                      className="sr-only"
                    />
                    {libelle}
                  </label>
                ))}
              </div>
            </fieldset>
            {fichierAttendu ? (
              <ChoixFichier
                fichier={fichier}
                onChange={setFichier}
                libelle="Document (PDF, 15 Mo au plus)"
              />
            ) : (
              <Champ
                libelle={valeurs.type === 'VIDEO' ? 'Lien de la vidéo' : 'Lien'}
                type="url"
                value={valeurs.url}
                onChange={modifier('url')}
                erreur={etat.erreurs.url}
                placeholder="https://"
                obligatoire
              />
            )}
            <Cadre id="description-cours" libelle="Description">
              <textarea
                id="description-cours"
                rows={3}
                maxLength={2000}
                value={valeurs.description}
                onChange={modifier('description')}
                placeholder="Ce que les élèves doivent retenir ou préparer"
                className={zoneTexte}
              />
            </Cadre>
          </>
        ) : (
          <>
            <Cadre id="consignes" libelle="Consignes" erreur={etat.erreurs.consignes} obligatoire>
              <textarea
                id="consignes"
                rows={4}
                maxLength={4000}
                value={valeurs.consignes}
                onChange={modifier('consignes')}
                className={zoneTexte}
              />
            </Cadre>
            <Champ
              libelle="Pour le"
              type="date"
              min={dateLocale()}
              value={valeurs.pourLe}
              onChange={modifier('pourLe')}
              erreur={etat.erreurs.pourLe}
              obligatoire
            />
            <ChoixFichier
              fichier={fichier}
              onChange={setFichier}
              libelle="Pièce jointe (facultative)"
            />
          </>
        )}
        {etat.erreur && <Alerte type="erreur">{etat.erreur}</Alerte>}
        <div className="flex justify-end gap-2">
          <Bouton variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" icone={Send} chargement={etat.envoi}>
            Publier
          </Bouton>
        </div>
      </form>
    </Dialogue>
  );
}

/** L'enseignant publie ses cours et devoirs, matière par matière. */
export default function CoursEnseignant() {
  const [parametres, setParametres] = useSearchParams();
  const { donnees: miennes, erreur: erreurListe } = useRequete('/mes-enseignements');
  const enseignements = miennes?.enseignements ?? [];
  const enseignementId = parametres.get('matiere') ?? enseignements[0]?.id;
  const onglet = parametres.get('onglet') ?? 'cours';
  const choisir = (cle, valeur) =>
    setParametres(
      (p) =>
        new URLSearchParams({
          ...Object.fromEntries(p),
          ...(enseignementId && { matiere: enseignementId }),
          [cle]: valeur,
        }),
      { replace: true },
    );
  const cours = useRequete(
    enseignementId && onglet === 'cours' ? `/enseignements/${enseignementId}/cours` : null,
  );
  const devoirs = useRequete(
    enseignementId && onglet === 'devoirs' ? `/enseignements/${enseignementId}/devoirs` : null,
  );
  const actif = onglet === 'cours' ? cours : devoirs;
  const [publication, setPublication] = useState(null);
  const [copies, setCopies] = useState(null);
  const [erreur, setErreur] = useState(null);

  async function retirer(chemin) {
    setErreur(null);
    try {
      await appelApi(chemin, { methode: 'DELETE' });
      actif.recharger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <EnTetePage
        titre="Cours et devoirs"
        description="Vos supports et devoirs sont visibles par les élèves de la classe et par leurs parents."
        actions={
          enseignementId && (
            <Bouton
              icone={onglet === 'cours' ? BookPlus : ClipboardPlus}
              onClick={() => setPublication(onglet)}
            >
              {onglet === 'cours' ? 'Publier un cours' : 'Donner un devoir'}
            </Bouton>
          )
        }
      />
      <div
        className="entree flex flex-col gap-3 sm:flex-row sm:items-center"
        style={{ '--delai': '60ms' }}
      >
        <select
          aria-label="Classe et matière"
          value={enseignementId ?? ''}
          onChange={(e) => choisir('matiere', e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold sm:text-sm"
        >
          {enseignements.map((e) => (
            <option key={e.id} value={e.id}>
              {e.classe.nom} · {e.matiere}
            </option>
          ))}
        </select>
        <Onglets
          onglets={[
            ['cours', 'Cours'],
            ['devoirs', 'Devoirs'],
          ]}
          actif={onglet}
          onChange={(v) => choisir('onglet', v)}
        />
      </div>
      {miennes && !enseignements.length && (
        <Alerte type="info">Aucune matière ne vous est encore attribuée par la direction.</Alerte>
      )}
      {(erreurListe || actif.erreur || erreur) && (
        <Alerte type="erreur">{(erreurListe ?? actif.erreur)?.message ?? erreur}</Alerte>
      )}
      {actif.chargement && enseignementId && <Chargement />}
      {onglet === 'cours' && cours.donnees && (
        <ListeCours
          cours={cours.donnees.cours}
          afficherMatiere={false}
          cheminFichier={(c) => `/cours/${c.id}/fichier`}
          onRetirer={(c) => retirer(`/cours/${c.id}`)}
        />
      )}
      {onglet === 'devoirs' && devoirs.donnees && (
        <ListeDevoirs
          devoirs={devoirs.donnees.devoirs}
          afficherMatiere={false}
          cheminFichier={(d) => `/devoirs/${d.id}/fichier`}
          onRetirer={(d) => retirer(`/devoirs/${d.id}`)}
          onCopies={setCopies}
        />
      )}
      {copies && (
        <CopiesDevoir
          devoir={copies}
          onFermer={() => {
            setCopies(null);
            devoirs.recharger();
          }}
        />
      )}
      {publication && (
        <DialoguePublication
          type={publication}
          enseignementId={enseignementId}
          onFermer={() => setPublication(null)}
          onPublie={() => {
            setPublication(null);
            actif.recharger();
          }}
        />
      )}
    </div>
  );
}
