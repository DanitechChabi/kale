import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, FileText, Lock, PenLine, ShieldCheck, Stamp } from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import Dialogue from '../../components/ui/Dialogue.jsx';
import { useAuth } from '../../contexte/Auth.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';
import { formaterDate } from '../../lib/navigation.js';
import { libelleCourtPeriode, libellePeriode } from '../../lib/notes.js';
import { lienVerification, ouvrirPdf } from '../../lib/releves.js';

const ANNUEL = 'annuel';

/** Onglets : chaque période, puis l'année complète (relevé annuel). */
function ChoixDocument({ periodes, valeur, onChange }) {
  const onglets = [
    ...periodes.map((p) => ({
      id: p.id,
      court: libelleCourtPeriode(p),
      long: libellePeriode(p),
      cloturee: p.estCloturee,
    })),
    {
      id: ANNUEL,
      court: 'Année',
      long: 'Relevé annuel',
      cloturee: periodes.length > 0 && periodes.every((p) => p.estCloturee),
    },
  ];
  return (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Document">
      {onglets.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === valeur}
          onClick={() => onChange(o.id)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition ${
            o.id === valeur
              ? 'bg-white text-slate-900 shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="sm:hidden">{o.court}</span>
          <span className="hidden sm:inline">{o.long}</span>
          {o.cloturee && <Lock className="h-3.5 w-3.5 text-slate-400" aria-label="clôturé" />}
        </button>
      ))}
    </div>
  );
}

function DialogueCorrection({ document, onFermer, onCorrige }) {
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function corriger(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const resultat = await appelApi(`/releves/${document.id}/correction`, {
        methode: 'POST',
        corps: { motif },
      });
      onCorrige(resultat.document);
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  return (
    <Dialogue ouvert onFermer={onFermer} titre="Corriger le document">
      <form onSubmit={corriger} className="space-y-4">
        <p className="text-sm text-slate-600">
          Le document <span className="chiffres font-semibold">{document.numeroAffiche}</span> reste
          archivé et vérifiable avec la mention « remplacé ». Un nouveau document est produit avec
          les données actuelles de l’élève ; les notes, figées à la clôture, ne changent pas.
        </p>
        <div className="space-y-1.5">
          <label htmlFor="motif-correction" className="block text-sm font-medium text-slate-800">
            Motif de la correction <span className="text-rouge">*</span>
          </label>
          <textarea
            id="motif-correction"
            required
            minLength={5}
            maxLength={500}
            rows={3}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. : prénom mal orthographié sur l’acte de naissance"
            className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-marque-500 focus:ring-2 focus:ring-marque-500/20 focus:outline-none sm:text-sm"
          />
          <p className="text-sm text-slate-500">Le motif est imprimé sur le nouveau document.</p>
        </div>
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Bouton variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" chargement={envoi} icone={PenLine}>
            Produire le document corrigé
          </Bouton>
        </div>
      </form>
    </Dialogue>
  );
}

function LigneEleve({ eleve, index, recents, peutCorriger, onCorriger }) {
  const d = eleve.document;
  return (
    <li
      className="ligne-note grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[1fr_11rem_8rem_auto]"
      style={{ '--delai': `${Math.min(index, 25) * 20}ms` }}
    >
      <div className="min-w-0">
        <p className="truncate">
          <span className="font-semibold">{eleve.nom}</span> {eleve.prenoms}
        </p>
        <p className="chiffres text-xs text-slate-500">{eleve.matricule}</p>
      </div>
      {d ? (
        <>
          <div className="order-last col-span-2 flex items-center gap-2 sm:order-none sm:col-span-1">
            <span
              className={`tampon-encre text-marque-700 ${recents.has(d.id) ? 'tampon-frappe' : ''}`}
              style={{ '--delai': `${Math.min(index, 25) * 70}ms` }}
            >
              <Stamp className="h-3 w-3" aria-hidden="true" />
              {d.numeroAffiche}
            </span>
          </div>
          <p className="hidden text-sm text-slate-500 sm:block">
            {formaterDate(d.genereLe)}
            {d.versions > 1 && (
              <span className="block text-xs font-semibold text-sceau">
                Corrigé ({d.versions - 1})
              </span>
            )}
          </p>
          <div className="row-span-1 flex justify-end gap-1">
            <button
              type="button"
              onClick={() => ouvrirPdf(`/releves/${d.id}/pdf`)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-marque-700"
              aria-label={`Ouvrir le document de ${eleve.prenoms} ${eleve.nom}`}
              title="Ouvrir le PDF"
            >
              <FileText className="h-4 w-4" />
            </button>
            <a
              href={lienVerification(d.numeroAffiche)}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-marque-700"
              aria-label={`Page de vérification du document ${d.numeroAffiche}`}
              title="Page de vérification"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            {peutCorriger && (
              <button
                type="button"
                onClick={() => onCorriger(d)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-marque-700"
                aria-label={`Corriger le document de ${eleve.prenoms} ${eleve.nom}`}
                title="Corriger"
              >
                <PenLine className="h-4 w-4" />
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="text-right text-sm text-slate-400 sm:col-span-3">Non délivré</p>
      )}
    </li>
  );
}

export default function Bulletins() {
  const { utilisateur } = useAuth();
  const estDirection = utilisateur.role === 'ADMIN_ECOLE';
  const [parametres, setParametres] = useSearchParams();
  const { donnees: listeClasses } = useRequete('/classes');
  const { donnees: listeAnnees } = useRequete('/annees');
  const annee = listeAnnees?.annees.find((a) => a.estCourante);
  const classes = listeClasses?.classes ?? [];
  const classeId = parametres.get('classe') ?? classes[0]?.id;
  // Par défaut : la dernière période clôturée (celle dont on délivre les bulletins)
  const choixDefaut =
    annee &&
    ([...annee.periodes].reverse().find((p) => p.estCloturee)?.id ?? annee.periodes[0]?.id);
  const choix = parametres.get('document') ?? choixDefaut;
  const chemin =
    classeId && choix
      ? `/releves/classe?classeId=${classeId}${choix === ANNUEL ? '' : `&periodeId=${choix}`}`
      : null;
  const { donnees: etat, erreur, chargement, recharger } = useRequete(chemin);

  const [generation, setGeneration] = useState({ envoi: false, resultat: null, erreur: null });
  const [recents, setRecents] = useState(new Set());
  const [aCorriger, setACorriger] = useState(null);

  const choisir = (cle, valeur) => {
    setGeneration({ envoi: false, resultat: null, erreur: null });
    setParametres(
      (p) =>
        new URLSearchParams({
          ...Object.fromEntries(p),
          ...(classeId && { classe: classeId }),
          ...(choix && { document: choix }),
          [cle]: valeur,
        }),
      { replace: true },
    );
  };

  const manquants = etat?.eleves.filter((e) => !e.document).length ?? 0;
  const libelleDocuments = etat?.type === 'RELEVE_ANNUEL' ? 'relevés annuels' : 'bulletins';

  async function generer() {
    setGeneration({ envoi: true, resultat: null, erreur: null });
    const avant = new Set(etat.eleves.filter((e) => e.document).map((e) => e.document.id));
    try {
      const resultat = await appelApi('/releves/generation', {
        methode: 'POST',
        corps: { classeId, ...(choix !== ANNUEL && { periodeId: choix }) },
      });
      const apres = await appelApi(chemin);
      // Les documents nouvellement archivés reçoivent leur tampon, un par un
      setRecents(
        new Set(apres.eleves.map((e) => e.document?.id).filter((id) => id && !avant.has(id))),
      );
      recharger();
      setGeneration({ envoi: false, resultat, erreur: null });
    } catch (err) {
      setGeneration({ envoi: false, resultat: null, erreur: err.message });
    }
  }

  return (
    <div className="space-y-6">
      <EnTetePage
        surtitre={annee?.libelle}
        titre="Bulletins et relevés"
        description="Délivrés après la clôture, archivés définitivement, numérotés et vérifiables en ligne par QR code."
        actions={
          <Link
            to="/espace/duplicatas"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-50"
          >
            Demandes de duplicata
          </Link>
        }
      />

      <div
        className="entree flex flex-col gap-3 sm:flex-row sm:items-center"
        style={{ '--delai': '60ms' }}
      >
        <select
          aria-label="Classe"
          value={classeId ?? ''}
          onChange={(e) => choisir('classe', e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold sm:w-48 sm:text-sm"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
        {annee && (
          <div className="sm:min-w-[28rem]">
            <ChoixDocument
              periodes={annee.periodes}
              valeur={choix}
              onChange={(id) => choisir('document', id)}
            />
          </div>
        )}
      </div>

      {listeClasses && !classes.length && (
        <Alerte type="info">Créez d’abord vos classes et inscrivez les élèves.</Alerte>
      )}
      {erreur && <Alerte type="erreur">{erreur.message}</Alerte>}
      {chargement && chemin && <Chargement />}

      {etat && (
        <>
          {!etat.cloturee ? (
            <Alerte
              type="attention"
              titre={etat.type === 'RELEVE_ANNUEL' ? 'Année non clôturée' : 'Période non clôturée'}
            >
              <p>
                Les {libelleDocuments} sont délivrés une fois{' '}
                {etat.type === 'RELEVE_ANNUEL'
                  ? 'toutes les périodes clôturées'
                  : 'la période clôturée'}
                , quand les notes ne peuvent plus changer.
              </p>
              {estDirection && (
                <Link to="/espace/cloture" className="mt-1 inline-block font-semibold underline">
                  Contrôle et clôture
                </Link>
              )}
            </Alerte>
          ) : (
            <div
              className="entree flex flex-col gap-3 border-y-2 border-slate-900 py-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ '--delai': '100ms' }}
            >
              <p className="flex items-baseline gap-2">
                <span className="chiffres text-3xl font-semibold">
                  {etat.eleves.length - manquants}
                </span>
                <span className="text-slate-600">
                  sur {etat.eleves.length} {libelleDocuments} archivés
                </span>
              </p>
              {manquants > 0 ? (
                <Bouton icone={ShieldCheck} chargement={generation.envoi} onClick={generer}>
                  Délivrer {manquants > 1 ? `les ${manquants} ${libelleDocuments}` : 'le document'}
                </Bouton>
              ) : (
                <p className="flex items-center gap-2 text-sm font-semibold text-marque-700">
                  <ShieldCheck className="h-4 w-4" /> Tous les documents sont archivés
                </p>
              )}
            </div>
          )}

          {generation.erreur && <Alerte type="erreur">{generation.erreur}</Alerte>}
          {generation.resultat && generation.resultat.generes > 0 && (
            <Alerte type="succes" titre="Documents archivés">
              {generation.resultat.generes} document{generation.resultat.generes > 1 ? 's' : ''}{' '}
              produit{generation.resultat.generes > 1 ? 's' : ''}, scellé
              {generation.resultat.generes > 1 ? 's' : ''} par son empreinte et désormais vérifiable
              {generation.resultat.generes > 1 ? 's' : ''} en ligne.
            </Alerte>
          )}

          {etat.eleves.length ? (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              {etat.eleves.map((eleve, i) => (
                <LigneEleve
                  key={eleve.id}
                  eleve={eleve}
                  index={i}
                  recents={recents}
                  peutCorriger={estDirection}
                  onCorriger={setACorriger}
                />
              ))}
            </ul>
          ) : (
            <Alerte type="info">Aucun élève inscrit dans cette classe.</Alerte>
          )}
        </>
      )}

      {aCorriger && (
        <DialogueCorrection
          document={aCorriger}
          onFermer={() => setACorriger(null)}
          onCorrige={(nouveau) => {
            setACorriger(null);
            setRecents(new Set([nouveau.id]));
            recharger();
          }}
        />
      )}
    </div>
  );
}
