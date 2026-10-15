import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Ban, Check, FileText, Hand, Search, Send } from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import Dialogue from '../../components/ui/Dialogue.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';
import { formaterDate, formaterTelephone } from '../../lib/navigation.js';
import {
  LIBELLES_TYPES_DOCUMENT,
  STATUTS_DEMANDE,
  libellePeriodeDemande,
  ouvrirPdf,
  titreDocument,
} from '../../lib/releves.js';

function Fiche({ demande }) {
  const lignes = [
    ['Document', LIBELLES_TYPES_DOCUMENT[demande.typeDocument]],
    ['Période', libellePeriodeDemande(demande.typeDocument, demande.numeroPeriode)],
    ['Année scolaire', demande.libelleAnnee],
    ['Classe déclarée', demande.classeDeclaree],
    ['Élève', `${demande.nomEleve} ${demande.prenomsEleve}`],
    ['Né(e) le', formaterDate(demande.dateNaissance)],
    ['Matricule déclaré', demande.matriculeDeclare],
    ['Demandeur', demande.nomDemandeur],
    ['Téléphone', formaterTelephone(demande.telephone)],
    ['E-mail', demande.email],
    ['Motif', demande.motif],
    ['Déposée le', formaterDate(demande.demandeLe, true)],
  ].filter(([, valeur]) => valeur);
  return (
    <section className="cahier marge-rouge rounded-2xl py-3 pr-4 pl-10 ring-1 ring-slate-200">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 text-sm leading-7">
        {lignes.map(([libelle, valeur]) => (
          <div key={libelle} className="contents">
            <dt className="text-slate-500">{libelle}</dt>
            <dd className="min-w-0 font-medium break-words">{valeur}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DialogueRejet({ onFermer, onRejeter }) {
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  return (
    <Dialogue ouvert onFermer={onFermer} titre="Rejeter la demande">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setEnvoi(true);
          await onRejeter(motif);
          setEnvoi(false);
        }}
      >
        <p className="text-sm text-slate-600">
          Le demandeur verra ce motif en suivant sa demande. Soyez précis sur ce qui manque.
        </p>
        <textarea
          aria-label="Motif du rejet"
          required
          minLength={5}
          maxLength={500}
          rows={3}
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Ex. : aucun élève de ce nom inscrit en 2019-2020 ; présentez-vous avec votre ancien bulletin."
          className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-marque-500 focus:ring-2 focus:ring-marque-500/20 focus:outline-none sm:text-sm"
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Bouton variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" variante="danger" icone={Ban} chargement={envoi}>
            Rejeter
          </Bouton>
        </div>
      </form>
    </Dialogue>
  );
}

export default function DuplicataDetail() {
  const { id } = useParams();
  const { donnees, erreur, chargement } = useRequete(`/duplicatas/${id}`);
  const [maj, setMaj] = useState(null);
  const [choisi, setChoisi] = useState(null);
  const [action, setAction] = useState({ envoi: null, erreur: null });
  const [rejet, setRejet] = useState(false);

  const etat = maj ?? donnees;
  const demande = etat?.demande;
  const ouverte = demande && ['EN_ATTENTE', 'EN_COURS'].includes(demande.statut);

  async function agir(nom, chemin, corps) {
    setAction({ envoi: nom, erreur: null });
    try {
      setMaj(await appelApi(`/duplicatas/${id}/${chemin}`, { methode: 'POST', corps }));
      setAction({ envoi: null, erreur: null });
      return true;
    } catch (err) {
      setAction({ envoi: null, erreur: err.message });
      return false;
    }
  }

  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement || !etat) return <Chargement />;

  // Document proposé par défaut : celui qui correspond exactement à la demande
  const propose =
    choisi ?? etat.candidats.flatMap((c) => c.documents).find((d) => d.correspond)?.id ?? null;

  return (
    <div className="space-y-6">
      <EnTetePage
        retour={{ vers: '/espace/duplicatas', libelle: 'Demandes de duplicata' }}
        surtitre={<span className="chiffres">{demande.numeroSuivi}</span>}
        titre={`${demande.nomEleve} ${demande.prenomsEleve}`}
        actions={<Badge statut={demande.statut} table={STATUTS_DEMANDE} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <Fiche demande={demande} />
          {demande.statut === 'EN_ATTENTE' && (
            <Bouton
              variante="secondaire"
              icone={Hand}
              chargement={action.envoi === 'prise'}
              onClick={() => agir('prise', 'prise-en-charge')}
            >
              Prendre en charge
            </Bouton>
          )}
          {demande.traitePar && (
            <p className="text-sm text-slate-500">
              Traitée par {demande.traitePar.prenoms} {demande.traitePar.nom}
            </p>
          )}
        </div>

        <section className="space-y-4">
          {demande.statut === 'DELIVREE' && (
            <Alerte type="succes" titre="Document délivré">
              <p>
                Le demandeur peut télécharger le document{' '}
                <span className="chiffres font-semibold">{demande.document.numero}</span> depuis le
                suivi de sa demande.
              </p>
              <button
                type="button"
                className="mt-1 font-semibold underline"
                onClick={() => ouvrirPdf(`/releves/${demande.document.id}/pdf`)}
              >
                Ouvrir le document
              </button>
            </Alerte>
          )}
          {demande.statut === 'REJETEE' && (
            <Alerte type="erreur" titre="Demande rejetée">
              {demande.motifRejet}
            </Alerte>
          )}

          {ouverte && (
            <>
              <h2 className="etiquette flex items-center gap-2">
                <Search className="h-3.5 w-3.5" /> Élèves et documents archivés correspondants
              </h2>
              {etat.candidats.length ? (
                <ul className="space-y-3">
                  {etat.candidats.map((c) => (
                    <li key={c.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p>
                          <span className="font-semibold">{c.nom}</span> {c.prenoms}
                        </p>
                        <p className="text-xs text-slate-500">
                          <span className="chiffres">{c.matricule}</span> · né(e) le{' '}
                          {formaterDate(c.dateNaissance)}
                        </p>
                      </div>
                      {c.correspondance >= 4 && (
                        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-marque-700">
                          <Check className="h-3.5 w-3.5" /> Nom et date de naissance identiques
                        </p>
                      )}
                      {c.documents.length ? (
                        <fieldset className="mt-3 space-y-2">
                          <legend className="sr-only">Documents de {c.nom}</legend>
                          {c.documents.map((d) => (
                            <label
                              key={d.id}
                              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ring-1 transition ${
                                propose === d.id
                                  ? 'bg-marque-50 ring-marque-500'
                                  : 'ring-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name="document"
                                value={d.id}
                                checked={propose === d.id}
                                onChange={() => setChoisi(d.id)}
                                className="accent-marque-600"
                              />
                              <span className="min-w-0 flex-1 text-sm">
                                <span className="font-medium">
                                  {titreDocument({
                                    type: demande.typeDocument,
                                    periode: d.periode,
                                  })}
                                </span>{' '}
                                · {d.anneeScolaire}
                                <span className="chiffres block text-xs text-slate-500">
                                  {d.numero}
                                </span>
                              </span>
                              {d.correspond && (
                                <span className="text-xs font-semibold text-marque-700">
                                  Correspond
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  ouvrirPdf(`/releves/${d.id}/pdf`);
                                }}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-marque-700"
                                aria-label={`Ouvrir le document ${d.numero}`}
                              >
                                <FileText className="h-4 w-4" />
                              </button>
                            </label>
                          ))}
                        </fieldset>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">
                          Aucun document de ce type archivé pour cet élève.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Alerte type="info">
                  Aucun élève correspondant dans votre base. Si l’année demandée est antérieure à
                  l’utilisation d’EduRelevé, le document n’a pas été archivé ici.
                </Alerte>
              )}

              {action.erreur && <Alerte type="erreur">{action.erreur}</Alerte>}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Bouton
                  icone={Send}
                  disabled={!propose}
                  chargement={action.envoi === 'delivrance'}
                  onClick={() => agir('delivrance', 'delivrance', { releveId: propose })}
                >
                  Délivrer le document choisi
                </Bouton>
                <Bouton variante="secondaire" icone={Ban} onClick={() => setRejet(true)}>
                  Rejeter la demande
                </Bouton>
              </div>
            </>
          )}
        </section>
      </div>

      {rejet && (
        <DialogueRejet
          onFermer={() => setRejet(false)}
          onRejeter={async (motif) => {
            if (await agir('rejet', 'rejet', { motif })) setRejet(false);
          }}
        />
      )}
    </div>
  );
}
