import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, Download } from 'lucide-react';
import CarteBenin from '../../components/CarteBenin.jsx';
import EnTetePage from '../../components/EnTetePage.jsx';
import Apparition from '../../components/animation/Apparition.jsx';
import Compteur from '../../components/animation/Compteur.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { ChampSelection } from '../../components/ui/Champ.jsx';
import Onglets from '../../components/ui/Onglets.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';
import {
  formater,
  formaterDelai,
  formaterMoyenne,
  INDICATEURS_CARTE,
  LIBELLES_NIVEAUX_COURTS,
  LIBELLES_PERIODES,
} from '../../lib/tableauDeBord.js';

const FILTRES = ['annee', 'departementId', 'communeId', 'ecoleId'];

/** Tuile d'indicateur : libellé, valeur, précision. */
function Tuile({ libelle, valeur, decimales = 0, unite, texte, precision, delai }) {
  return (
    <Apparition delai={delai} className="border-t-2 border-slate-900 pt-3">
      <p className="text-sm text-slate-600">{libelle}</p>
      <p className="chiffres mt-1 text-3xl font-semibold tracking-tight text-encre">
        {texte ??
          (valeur === null || valeur === undefined ? (
            '—'
          ) : (
            <>
              <Compteur valeur={valeur} decimales={decimales} duree={700} delai={delai} />
              {unite && <span className="ml-1 text-lg text-slate-500">{unite}</span>}
            </>
          ))}
      </p>
      {precision && <p className="mt-1 text-xs text-slate-500">{precision}</p>}
    </Apparition>
  );
}

/** Barre horizontale (une seule série : une seule teinte), valeur au bout. */
function Barre({ libelle, valeur, max, afficher }) {
  const part = max ? valeur / max : 0;
  return (
    <div className="grid grid-cols-[3rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
      <span className="text-slate-600">{libelle}</span>
      <span className="h-5">
        <span
          className="jauge block h-full origin-left rounded-r bg-marque-500"
          style={{ '--echelle': part }}
          title={`${libelle} : ${afficher(valeur)}`}
        />
      </span>
      <span className="chiffres text-right text-slate-800">{afficher(valeur)}</span>
    </div>
  );
}

/** Filtres en cascade : année, département, commune, établissement. */
function Filtres({ donnees, filtres, changer }) {
  const departement = donnees.zones.find((d) => d.id === filtres.departementId);
  const commune = departement?.communes.find((c) => c.id === filtres.communeId);
  const avecEcoles = (liste) => liste.filter((c) => c.ecoles.length);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <ChampSelection
        libelle="Année scolaire"
        value={donnees.annee ?? ''}
        onChange={(e) => changer({ annee: e.target.value })}
        options={donnees.annees.map((a) => ({ valeur: a, libelle: a }))}
      />
      <ChampSelection
        libelle="Département"
        value={filtres.departementId ?? ''}
        onChange={(e) => changer({ departementId: e.target.value, communeId: '', ecoleId: '' })}
        placeholder="Tout le pays"
        options={donnees.zones.map((d) => ({ valeur: d.id, libelle: d.nom }))}
      />
      <ChampSelection
        libelle="Commune"
        value={filtres.communeId ?? ''}
        onChange={(e) => changer({ communeId: e.target.value, ecoleId: '' })}
        placeholder={departement ? 'Tout le département' : 'Choisir un département'}
        disabled={!departement}
        options={avecEcoles(departement?.communes ?? []).map((c) => ({
          valeur: c.id,
          libelle: c.nom,
        }))}
      />
      <ChampSelection
        libelle="Établissement"
        value={filtres.ecoleId ?? ''}
        onChange={(e) => changer({ ecoleId: e.target.value })}
        placeholder={commune ? 'Toute la commune' : 'Choisir une commune'}
        disabled={!commune}
        options={(commune?.ecoles ?? []).map((e) => ({ valeur: e.id, libelle: e.nom }))}
      />
    </div>
  );
}

const TYPES_DETAIL = {
  DEPARTEMENT: 'Département',
  COMMUNE: 'Commune',
  ETABLISSEMENT: 'Établissement',
};

/** Détail de la zone : un niveau plus bas, chaque ligne ouvre la zone. */
function TableauDetail({ lignes, onOuvrir }) {
  if (!lignes.length) return null;
  const type = TYPES_DETAIL[lignes[0].type];
  return (
    <section className="space-y-3" aria-labelledby="titre-detail">
      <h2 id="titre-detail" className="etiquette border-b-2 border-slate-900 pb-2">
        Détail par {type.toLowerCase()}
      </h2>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">{type}</th>
              <th className="px-3 py-2 text-right font-medium">Établ.</th>
              <th className="px-3 py-2 text-right font-medium">Élèves</th>
              <th className="px-3 py-2 text-right font-medium">Moyenne</th>
              <th className="px-3 py-2 text-right font-medium">Réussite</th>
              <th className="px-3 py-2 text-right font-medium">Absences</th>
              <th className="px-3 py-2 text-right font-medium">Documents</th>
              <th className="py-2 pl-3 text-right font-medium">Délai duplicata</th>
            </tr>
          </thead>
          <tbody className="chiffres">
            {lignes.map((l) => (
              <tr
                key={l.id}
                className="group cursor-pointer border-b border-slate-200 hover:bg-marque-50/60"
                onClick={() => onOuvrir(l)}
              >
                <td className="py-2.5 pr-3 font-sans">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left font-medium text-slate-900 group-hover:text-marque-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOuvrir(l);
                    }}
                  >
                    {l.nom}
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  </button>
                </td>
                <td className="px-3 py-2.5 text-right">{formater(l.etablissements)}</td>
                <td className="px-3 py-2.5 text-right">{formater(l.effectif)}</td>
                <td className="px-3 py-2.5 text-right">{formaterMoyenne(l.moyenneGenerale)}</td>
                <td className="px-3 py-2.5 text-right">{formater(l.tauxReussite, '%')}</td>
                <td className="px-3 py-2.5 text-right">{formater(l.tauxAbsence, '%')}</td>
                <td className="px-3 py-2.5 text-right">{formater(l.documentsDelivres)}</td>
                <td className="py-2.5 pl-3 text-right">
                  {formaterDelai(l.duplicatas.delaiMoyenHeures)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Tableau de bord du ministère : indicateurs agrégés par zone (lecture seule).
 * Les filtres vivent dans l'adresse : une vue se partage par simple lien.
 */
export default function TableauMinistere() {
  const [parametres, setParametres] = useSearchParams();
  const filtres = Object.fromEntries(FILTRES.map((f) => [f, parametres.get(f) || undefined]));
  const requete = new URLSearchParams(Object.entries(filtres).filter(([, v]) => v)).toString();
  const { donnees, erreur, chargement } = useRequete(
    `/ministere/tableau-de-bord${requete ? `?${requete}` : ''}`,
  );
  const [indicateur, setIndicateur] = useState(INDICATEURS_CARTE[0].cle);
  const [export_, setExport] = useState({ envoi: false, erreur: null });

  const changer = (modifs) => {
    const suivant = { ...filtres, ...modifs };
    setParametres(Object.fromEntries(Object.entries(suivant).filter(([, v]) => v)), {
      replace: false,
    });
  };

  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  if (!donnees.annee) {
    return (
      <div className="space-y-6">
        <EnTetePage surtitre="Ministère" titre="Tableau de bord" />
        <Alerte type="info">
          Aucune année scolaire n’a encore été ouverte par un établissement.
        </Alerte>
      </div>
    );
  }

  const s = donnees.synthese;
  const choixCarte = INDICATEURS_CARTE.find((i) => i.cle === indicateur);
  const maxNiveau = Math.max(...donnees.effectifsParNiveau.map((n) => n.effectif));
  const source = donnees.sourceReussite && LIBELLES_PERIODES(donnees.sourceReussite);

  async function exporter() {
    setExport({ envoi: true, erreur: null });
    try {
      const contenu = await appelApi(`/ministere/tableau-de-bord.csv?${requete}`, {
        format: 'blob',
      });
      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(contenu);
      lien.download = `edureleve-${donnees.annee}-${donnees.zone.nom}.csv`;
      lien.click();
      setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
      setExport({ envoi: false, erreur: null });
    } catch (err) {
      setExport({ envoi: false, erreur: err.message });
    }
  }

  // Ouvrir une zone du détail : on descend d'un niveau
  const ouvrir = (ligne) => {
    if (ligne.type === 'DEPARTEMENT')
      changer({ departementId: ligne.id, communeId: '', ecoleId: '' });
    if (ligne.type === 'COMMUNE') changer({ communeId: ligne.id, ecoleId: '' });
    if (ligne.type === 'ETABLISSEMENT') changer({ ecoleId: ligne.id });
  };

  return (
    <div className="space-y-8">
      <EnTetePage
        surtitre={`Ministère · ${donnees.annee}`}
        titre={donnees.zone.niveau === 'NATIONAL' ? 'Tableau de bord national' : donnees.zone.nom}
        description="Chiffres agrégés en lecture seule : effectifs inscrits, bulletins archivés, appels et demandes de duplicata."
        actions={
          <Bouton
            variante="secondaire"
            icone={Download}
            chargement={export_.envoi}
            onClick={exporter}
          >
            Exporter (CSV)
          </Bouton>
        }
      />
      {export_.erreur && <Alerte type="erreur">{export_.erreur}</Alerte>}
      <Filtres donnees={donnees} filtres={filtres} changer={changer} />

      <div className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
        <Tuile
          libelle="Élèves inscrits"
          valeur={s.effectif}
          precision={s.partFilles !== null ? `dont ${formater(s.partFilles, '%')} de filles` : null}
        />
        <Tuile
          libelle="Taux de réussite"
          valeur={s.tauxReussite}
          decimales={1}
          unite="%"
          precision={
            source
              ? `${source} · moyenne ≥ ${donnees.seuilReussite} · ${formater(s.elevesEvalues)} élèves`
              : 'Aucun bulletin archivé'
          }
          delai={60}
        />
        <Tuile
          libelle="Taux d’absence"
          valeur={s.tauxAbsence}
          decimales={1}
          unite="%"
          precision={s.appels ? `sur ${formater(s.appels)} appels` : 'Aucun appel enregistré'}
          delai={120}
        />
        <Tuile
          libelle="Délai moyen d’un duplicata"
          texte={formaterDelai(s.duplicatas.delaiMoyenHeures)}
          precision={
            s.duplicatas.delivres
              ? `${formater(s.duplicatas.delivres)} délivrés · ${formater(s.duplicatas.partSous72h, '%')} en moins de 72 h`
              : 'Aucun duplicata délivré'
          }
          delai={180}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-4 rounded-lg bg-white p-4 ring-1 ring-slate-200 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-bold tracking-tight">Par département</h2>
            <p className="text-xs text-slate-500">Touchez un département pour l’ouvrir</p>
          </div>
          <Onglets
            onglets={INDICATEURS_CARTE.map((i) => [i.cle, i.libelle])}
            actif={indicateur}
            onChange={setIndicateur}
          />
          <CarteBenin
            zones={donnees.parDepartement}
            indicateur={choixCarte}
            selection={filtres.departementId}
            onChoisir={(z) =>
              changer({
                departementId: z.id === filtres.departementId ? '' : z.id,
                communeId: '',
                ecoleId: '',
              })
            }
          />
        </section>

        <div className="min-w-0 space-y-8">
          <section className="space-y-3">
            <h2 className="etiquette border-b-2 border-slate-900 pb-2">Élèves par classe</h2>
            <div className="space-y-2">
              {donnees.effectifsParNiveau.map((n) => (
                <Barre
                  key={n.niveau}
                  libelle={LIBELLES_NIVEAUX_COURTS[n.niveau]}
                  valeur={n.effectif}
                  max={maxNiveau}
                  afficher={(v) => formater(v)}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="etiquette border-b-2 border-slate-900 pb-2">Résultats archivés</h2>
            {donnees.resultatsParPeriode.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1.5 font-medium">Période</th>
                    <th className="py-1.5 text-right font-medium">Élèves</th>
                    <th className="py-1.5 text-right font-medium">Moyenne</th>
                    <th className="py-1.5 pl-4 font-medium">Réussite</th>
                  </tr>
                </thead>
                <tbody className="chiffres">
                  {donnees.resultatsParPeriode.map((r) => (
                    <tr key={r.cle} className="border-t border-slate-200">
                      <td className="py-2 font-sans">{LIBELLES_PERIODES(r.cle)}</td>
                      <td className="py-2 text-right">{formater(r.elevesEvalues)}</td>
                      <td className="py-2 text-right">{formaterMoyenne(r.moyenneGenerale)}</td>
                      <td className="py-2 pl-4">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-marque-100">
                            <span
                              className="jauge block h-full origin-left bg-marque-600"
                              style={{ '--echelle': (r.tauxReussite ?? 0) / 100 }}
                            />
                          </span>
                          {formater(r.tauxReussite, '%')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-500">
                Les moyennes apparaissent dès que des bulletins sont archivés après une clôture.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="etiquette border-b-2 border-slate-900 pb-2">Délivrance des documents</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ['Bulletins archivés', formater(s.bulletins)],
                ['Relevés annuels', formater(s.releves)],
                [
                  'Délai après clôture',
                  s.delaiBulletinJours === null ? '—' : `${formater(s.delaiBulletinJours)} j`,
                ],
                ['Corrections', formater(s.corrections)],
                ['Duplicatas demandés', formater(s.duplicatas.demandes)],
                ['En cours de traitement', formater(s.duplicatas.enCours)],
              ].map(([terme, valeur]) => (
                <div key={terme}>
                  <dt className="text-slate-500">{terme}</dt>
                  <dd className="chiffres text-base font-semibold text-encre">{valeur}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      <TableauDetail lignes={donnees.detail} onOuvrir={ouvrir} />

      <p className="text-xs text-slate-500">
        {formater(s.etablissements)} établissement{s.etablissements > 1 ? 's' : ''} vérifié
        {s.etablissements > 1 ? 's' : ''}
        {s.etablissementsEnAttente > 0 &&
          ` · ${formater(s.etablissementsEnAttente)} en attente de vérification`}
        . Moyennes et réussite : bulletins archivés en vigueur (une correction remplace l’original).
        Absences : élèves absents rapportés aux élèves attendus lors des appels.
      </p>
    </div>
  );
}
