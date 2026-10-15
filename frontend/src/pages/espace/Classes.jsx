import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Plus, Users } from 'lucide-react';
import Apparition from '../../components/animation/Apparition.jsx';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { Champ } from '../../components/ui/Champ.jsx';
import Dialogue from '../../components/ui/Dialogue.jsx';
import { useAuth } from '../../contexte/Auth.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';
import { LIBELLE_NIVEAU, NIVEAUX, SECOND_CYCLE } from '../../lib/scolarite.js';

/** Création d'une classe avec aperçu des matières du programme national. */
function NouvelleClasse({ onCreee }) {
  const { utilisateur } = useAuth();
  const ordres = utilisateur.ecole?.ordres ?? ['GENERAL'];
  const [niveau, setNiveau] = useState('');
  const [serieId, setSerieId] = useState('');
  const [nom, setNom] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const { donnees: series } = useRequete('/referentiel/series');
  const secondCycle = SECOND_CYCLE.includes(niveau);
  const pret = niveau && (!secondCycle || serieId);
  const { donnees: programme, chargement } = useRequete(
    pret ? `/referentiel/programme?niveau=${niveau}${serieId ? `&serieId=${serieId}` : ''}` : null,
  );

  async function creer() {
    setEnvoi(true);
    setErreur(null);
    try {
      const { classe } = await appelApi('/classes', {
        methode: 'POST',
        corps: { niveau, serieId: serieId || null, nom: nom || null },
      });
      onCreee(classe);
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  const serie = series?.series.find((s) => s.id === serieId);
  const parOrdre = (ordre) => series?.series.filter((s) => s.ordre === ordre) ?? [];

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-800">Niveau</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {NIVEAUX.map(([valeur, libelle]) => (
            <button
              key={valeur}
              type="button"
              onClick={() => {
                setNiveau(valeur);
                setSerieId('');
              }}
              aria-pressed={niveau === valeur}
              className={`rounded-xl py-3 text-sm font-bold transition ${
                niveau === valeur
                  ? 'bg-marque-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-white'
              }`}
            >
              {libelle}
            </button>
          ))}
        </div>
      </fieldset>

      {secondCycle && (
        <fieldset className="entree space-y-3">
          <legend className="text-sm font-medium text-slate-800">Série</legend>
          {['GENERAL', 'TECHNIQUE']
            .filter((o) => ordres.includes(o))
            .map((ordre) => (
              <div key={ordre} className="space-y-1.5">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {ordre === 'GENERAL' ? 'Général' : 'Technique'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {parOrdre(ordre).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSerieId(s.id)}
                      aria-pressed={serieId === s.id}
                      title={s.libelle}
                      className={`min-w-12 rounded-lg px-3 py-2 text-sm font-bold transition ${
                        serieId === s.id
                          ? 'bg-marque-600 text-white'
                          : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-marque-300'
                      }`}
                    >
                      {s.code}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          {serie && (
            <p className="text-sm text-slate-500">
              Série {serie.code} : {serie.libelle}
            </p>
          )}
        </fieldset>
      )}

      {pret && (
        <div className="entree space-y-2">
          <p className="text-sm font-medium text-slate-800">Matières ajoutées automatiquement</p>
          {chargement ? (
            <Chargement />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
              {programme?.programme.map((l, i) => (
                <li
                  key={l.matiere.code}
                  className="ligne-note flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  style={{ '--delai': `${i * 35}ms` }}
                >
                  <span>
                    {l.matiere.nom}
                    {l.groupeOption && (
                      <span className="ml-2 text-xs text-slate-500">
                        au choix ({l.groupeOption})
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    coef. <strong>{l.coefficient}</strong>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500">
            Coefficients du référentiel national, à confirmer par le ministère. Vous pourrez les
            ajuster pour cette classe.
          </p>
        </div>
      )}

      {pret && (
        <Champ
          libelle="Nom de la classe"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder={`Automatique : ${LIBELLE_NIVEAU[niveau]}${serie ? ` ${serie.code}` : ''} A, B…`}
        />
      )}
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      <Bouton icone={Plus} onClick={creer} chargement={envoi} disabled={!pret} className="w-full">
        Créer la classe
      </Bouton>
    </div>
  );
}

export default function Classes() {
  const { utilisateur } = useAuth();
  const { donnees, erreur, chargement, recharger } = useRequete('/classes');
  const [creation, setCreation] = useState(false);
  const gestion = utilisateur.role === 'ADMIN_ECOLE';

  if (chargement) return <Chargement />;
  if (erreur?.code === 'ANNEE_ABSENTE') {
    return (
      <div className="space-y-6">
        <EnTetePage titre="Classes" />
        <Alerte type="info" titre="Aucune année scolaire en cours">
          {gestion ? (
            <Link to="/espace/annee" className="font-semibold underline">
              Créez d’abord l’année scolaire
            </Link>
          ) : (
            'Le responsable de l’établissement doit d’abord créer l’année scolaire.'
          )}
        </Alerte>
      </div>
    );
  }
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;

  const { classes } = donnees;
  const groupes = [
    ['Premier cycle', classes.filter((c) => !SECOND_CYCLE.includes(c.niveau))],
    ['Second cycle', classes.filter((c) => SECOND_CYCLE.includes(c.niveau))],
  ].filter(([, liste]) => liste.length);
  const effectifTotal = classes.reduce((t, c) => t + c.effectif, 0);

  return (
    <div className="space-y-6">
      <EnTetePage
        surtitre="Organisation"
        titre="Classes"
        description={`${classes.length} classe${classes.length > 1 ? 's' : ''} · ${effectifTotal} élève${effectifTotal > 1 ? 's' : ''} inscrit${effectifTotal > 1 ? 's' : ''}`}
        actions={
          gestion && (
            <Bouton icone={Plus} onClick={() => setCreation(true)}>
              Nouvelle classe
            </Bouton>
          )
        }
      />
      {!classes.length && (
        <div className="entree rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Aucune classe pour l’année en cours.
        </div>
      )}
      {groupes.map(([titre, liste]) => (
        <section key={titre} className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">{titre}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liste.map((classe, i) => (
              <Apparition as="li" key={classe.id} delai={Math.min(i, 9) * 40}>
                <Link
                  to={`/espace/classes/${classe.id}`}
                  className="group flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-marque-200"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-marque-50 text-sm font-bold text-marque-700">
                    {LIBELLE_NIVEAU[classe.niveau]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{classe.nom}</p>
                    <p className="flex items-center gap-3 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {classe.effectif}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" /> {classe.nombreMatieres} matières
                      </span>
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Apparition>
            ))}
          </ul>
        </section>
      ))}
      <Dialogue ouvert={creation} onFermer={() => setCreation(false)} titre="Nouvelle classe">
        <NouvelleClasse
          onCreee={() => {
            setCreation(false);
            recharger();
          }}
        />
      </Dialogue>
    </div>
  );
}
