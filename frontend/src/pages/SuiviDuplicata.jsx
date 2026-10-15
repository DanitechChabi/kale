import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, ExternalLink, Search } from 'lucide-react';
import Alerte from '../components/ui/Alerte.jsx';
import Badge from '../components/ui/Badge.jsx';
import Bouton from '../components/ui/Bouton.jsx';
import { Champ } from '../components/ui/Champ.jsx';
import { appelApi } from '../lib/api.js';
import { formaterDate } from '../lib/navigation.js';
import {
  LIBELLES_TYPES_DOCUMENT,
  STATUTS_DEMANDE,
  libellePeriodeDemande,
  lienVerification,
} from '../lib/releves.js';

const URL_API = import.meta.env.VITE_API_URL ?? '/api';

/** Étapes de la demande, tracées comme les lignes d'un registre. */
function Etapes({ demande }) {
  const rejetee = demande.statut === 'REJETEE';
  const etapes = [
    ['Demande déposée', demande.demandeLe],
    ['Prise en charge par le secrétariat', demande.priseEnChargeLe],
    [rejetee ? 'Demande rejetée' : 'Document délivré', demande.clotureLe],
  ];
  return (
    <ol className="space-y-0 border-l-2 border-slate-200 pl-5">
      {etapes.map(([libelle, date], i) => (
        <li
          key={libelle}
          className="ligne-note relative pb-5 last:pb-0"
          style={{ '--delai': `${i * 120}ms` }}
        >
          <span
            className={`absolute top-1.5 -left-[1.6rem] h-3 w-3 rounded-full ring-4 ring-white ${
              date ? (rejetee && i === 2 ? 'bg-rouge' : 'bg-marque-600') : 'bg-slate-300'
            }`}
            aria-hidden="true"
          />
          <p className={`font-semibold ${date ? '' : 'text-slate-400'}`}>{libelle}</p>
          {date && <p className="text-sm text-slate-500">{formaterDate(date, true)}</p>}
        </li>
      ))}
    </ol>
  );
}

export default function SuiviDuplicata() {
  const [parametres] = useSearchParams();
  const [numeroSuivi, setNumeroSuivi] = useState(parametres.get('numero') ?? '');
  const [telephone, setTelephone] = useState('');
  const [etat, setEtat] = useState({ envoi: false, demande: null, erreur: null });

  async function consulter(e) {
    e.preventDefault();
    setEtat({ envoi: true, demande: null, erreur: null });
    try {
      const { demande } = await appelApi('/public/duplicata/suivi', {
        methode: 'POST',
        corps: { numeroSuivi, telephone },
      });
      setEtat({ envoi: false, demande, erreur: null });
    } catch (err) {
      setEtat({ envoi: false, demande: null, erreur: err.message });
    }
  }

  const { demande } = etat;

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:py-12">
      <div className="entree space-y-2">
        <p className="etiquette">Duplicata</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Suivre ma demande</h1>
        <p className="text-slate-600">
          Saisissez le numéro de suivi reçu et le téléphone indiqué dans la demande.{' '}
          <Link to="/duplicata" className="font-semibold text-marque-700 hover:underline">
            Nouvelle demande
          </Link>
        </p>
      </div>

      <form
        onSubmit={consulter}
        className="entree grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <Champ
          libelle="Numéro de suivi"
          value={numeroSuivi}
          onChange={(e) => setNumeroSuivi(e.target.value)}
          placeholder="D26-XXXX-XXXXX"
          className="chiffres block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base uppercase focus:border-marque-500 focus:ring-2 focus:ring-marque-500/20 focus:outline-none sm:text-sm"
          autoComplete="off"
          obligatoire
        />
        <Champ
          libelle="Téléphone"
          type="tel"
          inputMode="tel"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          placeholder="01 97 00 00 00"
          autoComplete="tel"
          obligatoire
        />
        <Bouton type="submit" icone={Search} chargement={etat.envoi}>
          Consulter
        </Bouton>
      </form>

      {etat.erreur && <Alerte type="erreur">{etat.erreur}</Alerte>}

      {demande && (
        <section className="entree space-y-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="chiffres text-sm text-slate-500">{demande.numeroSuivi}</p>
              <h2 className="text-lg font-bold">
                {LIBELLES_TYPES_DOCUMENT[demande.typeDocument]} · {demande.libelleAnnee}
              </h2>
              <p className="text-sm text-slate-600">
                {demande.eleve} ·{' '}
                {libellePeriodeDemande(demande.typeDocument, demande.numeroPeriode)} ·{' '}
                {demande.etablissement}
              </p>
            </div>
            <Badge statut={demande.statut} table={STATUTS_DEMANDE} />
          </div>

          <Etapes demande={demande} />

          {demande.statut === 'REJETEE' && (
            <Alerte type="erreur" titre="Motif du rejet">
              {demande.motifRejet}
            </Alerte>
          )}

          {demande.document && (
            <div className="space-y-3 border-t-2 border-slate-900 pt-5">
              <p className="text-sm text-slate-600">
                Document n°{' '}
                <span className="chiffres font-semibold">{demande.document.numero}</span>. Le lien
                de téléchargement est valable 15 minutes ; il suffit de consulter à nouveau la
                demande pour en obtenir un autre.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <a
                  href={`${URL_API}/public/duplicata/telechargement/${demande.document.jetonTelechargement}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-marque-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-marque-700"
                >
                  <Download className="h-4 w-4" /> Télécharger le PDF
                </a>
                <a
                  href={lienVerification(demande.document.numero)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4" /> Page de vérification
                </a>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
