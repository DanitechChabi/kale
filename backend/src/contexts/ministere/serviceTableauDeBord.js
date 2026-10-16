// Tableau de bord du ministère : indicateurs agrégés, en lecture seule, par zone
// géographique (national, département, commune, établissement).
//
// Comptes nationaux (MINISTERE, SUPER_ADMIN) : client global, exception documentée.
// Les agrégats sont calculés une fois par établissement (sommes et effectifs, jamais
// des moyennes), puis cumulés par commune et département : une moyenne de zone est
// toujours pondérée par ses élèves, jamais une moyenne de moyennes.
//
// Sources :
// - effectifs : inscriptions « INSCRIT » de l'année ;
// - moyennes et réussite : bulletins et relevés ARCHIVÉS en vigueur (chiffres officiels,
//   figés à la clôture ; un document corrigé ne compte qu'une fois, dans sa version finale) ;
// - absences : appels enregistrés (absences / élèves attendus à ces appels) ;
// - délivrance : documents archivés, délai entre clôture de la période et bulletin,
//   demandes de duplicata déposées pendant l'année scolaire et leur délai de traitement.
import { prisma } from '../../config/prisma.js';
import { ErreurApi } from '../../middlewares/erreurs.js';

const NIVEAUX = [
  'SIXIEME',
  'CINQUIEME',
  'QUATRIEME',
  'TROISIEME',
  'SECONDE',
  'PREMIERE',
  'TERMINALE',
];
const SEUIL_REUSSITE = 10;
const HEURES_RAPIDE = 72; // duplicata délivré en moins de 3 jours

const nombre = (v) => (v === null || v === undefined ? 0 : Number(v));
const arrondi = (v, decimales = 2) =>
  v === null || Number.isNaN(v) ? null : Math.round(v * 10 ** decimales) / 10 ** decimales;
const taux = (part, total) => (total ? arrondi((100 * part) / total, 1) : null);

/** « 2026-2027 » → bornes de l'année scolaire pour les demandes de duplicata. */
function bornesAnnee(libelle) {
  const debut = Number(libelle.slice(0, 4));
  return { du: new Date(Date.UTC(debut, 8, 1)), au: new Date(Date.UTC(debut + 1, 8, 1)) };
}

/** Années scolaires connues, de la plus récente à la plus ancienne. */
async function anneesDisponibles() {
  const lignes = await prisma.anneeScolaire.groupBy({
    by: ['libelle'],
    _count: { _all: true },
    orderBy: { libelle: 'desc' },
  });
  return lignes.map((l) => l.libelle);
}

/** Année affichée par défaut : celle que la majorité des établissements a déclarée courante. */
async function anneeParDefaut(annees) {
  const courantes = await prisma.anneeScolaire.groupBy({
    by: ['libelle'],
    where: { estCourante: true },
    _count: { _all: true },
  });
  courantes.sort((a, b) => b._count._all - a._count._all || b.libelle.localeCompare(a.libelle));
  return courantes[0]?.libelle ?? annees[0] ?? null;
}

// --- Agrégats par établissement (SQL, client global) ------------------------------------

async function agregatsParEcole(annee) {
  const { du, au } = bornesAnnee(annee);
  const [effectifs, resultats, absences, documents, duplicatas] = await Promise.all([
    prisma.$queryRaw`
      SELECT i.ecole_id, c.niveau::text AS niveau, count(*) AS effectif,
             count(*) FILTER (WHERE e.sexe = 'F') AS filles
      FROM inscriptions i
      JOIN annees_scolaires a ON a.id = i.annee_scolaire_id
      JOIN classes c ON c.id = i.classe_id
      JOIN eleves e ON e.id = i.eleve_id
      WHERE a.libelle = ${annee} AND i.statut = 'INSCRIT'
      GROUP BY 1, 2`,
    // Documents en vigueur uniquement (non remplacés par une correction)
    prisma.$queryRaw`
      SELECT r.ecole_id, r.type::text AS type, p.type::text AS type_periode, p.numero,
             count(m.mg) AS evalues, sum(m.mg) AS somme,
             count(*) FILTER (WHERE m.mg >= ${SEUIL_REUSSITE}) AS reussis
      FROM releves_archives r
      JOIN annees_scolaires a ON a.id = r.annee_scolaire_id
      LEFT JOIN periodes p ON p.id = r.periode_id
      CROSS JOIN LATERAL (
        SELECT (r.donnees -> 'resultats' ->> 'moyenneGenerale')::numeric AS mg
      ) m
      WHERE a.libelle = ${annee}
        AND NOT EXISTS (SELECT 1 FROM releves_archives x WHERE x.remplace_releve_id = r.id)
      GROUP BY 1, 2, 3, 4`,
    // Élèves attendus à chaque appel : inscrits de la classe
    prisma.$queryRaw`
      WITH appels_annee AS (
        SELECT ap.id, ap.ecole_id,
               (SELECT count(*) FROM inscriptions i
                 WHERE i.classe_id = ap.classe_id AND i.statut = 'INSCRIT') AS attendus
        FROM appels ap
        JOIN classes c ON c.id = ap.classe_id
        JOIN annees_scolaires a ON a.id = c.annee_scolaire_id
        WHERE a.libelle = ${annee}
      ), par_appel AS (
        SELECT appel_id,
               count(*) FILTER (WHERE statut = 'ABSENT') AS absences,
               count(*) FILTER (WHERE statut = 'ABSENT' AND NOT justifiee) AS non_justifiees,
               count(*) FILTER (WHERE statut = 'RETARD') AS retards
        FROM presences GROUP BY 1
      )
      SELECT aa.ecole_id, count(*) AS appels, sum(aa.attendus) AS attendus,
             coalesce(sum(pa.absences), 0) AS absences,
             coalesce(sum(pa.non_justifiees), 0) AS non_justifiees,
             coalesce(sum(pa.retards), 0) AS retards
      FROM appels_annee aa LEFT JOIN par_appel pa ON pa.appel_id = aa.id
      GROUP BY 1`,
    prisma.$queryRaw`
      SELECT r.ecole_id,
             count(*) FILTER (WHERE r.type = 'BULLETIN_PERIODE') AS bulletins,
             count(*) FILTER (WHERE r.type = 'RELEVE_ANNUEL') AS releves,
             count(*) FILTER (WHERE r.remplace_releve_id IS NOT NULL) AS corrections,
             count(*) FILTER (WHERE r.remplace_releve_id IS NULL AND p.cloturee_le IS NOT NULL)
               AS bulletins_dates,
             coalesce(sum(extract(epoch FROM r.genere_le - p.cloturee_le))
               FILTER (WHERE r.remplace_releve_id IS NULL AND p.cloturee_le IS NOT NULL), 0)
               AS delai_bulletins_s
      FROM releves_archives r
      JOIN annees_scolaires a ON a.id = r.annee_scolaire_id
      LEFT JOIN periodes p ON p.id = r.periode_id
      WHERE a.libelle = ${annee}
      GROUP BY 1`,
    prisma.$queryRaw`
      SELECT ecole_id, count(*) AS demandes,
             count(*) FILTER (WHERE statut = 'DELIVREE') AS delivrees,
             count(*) FILTER (WHERE statut = 'REJETEE') AS rejetees,
             count(*) FILTER (WHERE statut IN ('EN_ATTENTE', 'EN_COURS')) AS en_cours,
             count(*) FILTER (WHERE statut = 'DELIVREE'
               AND cloture_le - demande_le <= make_interval(hours => ${HEURES_RAPIDE}::int)) AS rapides,
             coalesce(sum(extract(epoch FROM cloture_le - demande_le))
               FILTER (WHERE statut = 'DELIVREE'), 0) AS delai_s
      FROM demandes_duplicata
      WHERE demande_le >= ${du} AND demande_le < ${au}
      GROUP BY 1`,
  ]);

  const ecoles = new Map();
  const ecole = (id) => {
    if (!ecoles.has(id)) ecoles.set(id, vide());
    return ecoles.get(id);
  };
  for (const l of effectifs) {
    const a = ecole(l.ecole_id);
    a.effectif += nombre(l.effectif);
    a.filles += nombre(l.filles);
    a.parNiveau[l.niveau] = (a.parNiveau[l.niveau] ?? 0) + nombre(l.effectif);
  }
  for (const l of resultats) {
    const cle = l.type === 'RELEVE_ANNUEL' ? 'ANNUEL' : `${l.type_periode}-${l.numero}`;
    const r = (ecole(l.ecole_id).resultats[cle] ??= { evalues: 0, somme: 0, reussis: 0 });
    r.evalues += nombre(l.evalues);
    r.somme += nombre(l.somme);
    r.reussis += nombre(l.reussis);
  }
  for (const l of absences) {
    Object.assign(ecole(l.ecole_id).absences, {
      appels: nombre(l.appels),
      attendus: nombre(l.attendus),
      absences: nombre(l.absences),
      nonJustifiees: nombre(l.non_justifiees),
      retards: nombre(l.retards),
    });
  }
  for (const l of documents) {
    Object.assign(ecole(l.ecole_id).documents, {
      bulletins: nombre(l.bulletins),
      releves: nombre(l.releves),
      corrections: nombre(l.corrections),
      bulletinsDates: nombre(l.bulletins_dates),
      delaiBulletinsS: nombre(l.delai_bulletins_s),
    });
  }
  for (const l of duplicatas) {
    Object.assign(ecole(l.ecole_id).duplicatas, {
      demandes: nombre(l.demandes),
      delivrees: nombre(l.delivrees),
      rejetees: nombre(l.rejetees),
      enCours: nombre(l.en_cours),
      rapides: nombre(l.rapides),
      delaiS: nombre(l.delai_s),
    });
  }
  return ecoles;
}

function vide() {
  return {
    effectif: 0,
    filles: 0,
    parNiveau: {},
    resultats: {},
    absences: { appels: 0, attendus: 0, absences: 0, nonJustifiees: 0, retards: 0 },
    documents: { bulletins: 0, releves: 0, corrections: 0, bulletinsDates: 0, delaiBulletinsS: 0 },
    duplicatas: { demandes: 0, delivrees: 0, rejetees: 0, enCours: 0, rapides: 0, delaiS: 0 },
  };
}

/** Somme des agrégats de plusieurs établissements. */
function cumuler(liste) {
  const total = vide();
  for (const a of liste) {
    total.effectif += a.effectif;
    total.filles += a.filles;
    for (const [n, v] of Object.entries(a.parNiveau)) {
      total.parNiveau[n] = (total.parNiveau[n] ?? 0) + v;
    }
    for (const [cle, r] of Object.entries(a.resultats)) {
      const t = (total.resultats[cle] ??= { evalues: 0, somme: 0, reussis: 0 });
      t.evalues += r.evalues;
      t.somme += r.somme;
      t.reussis += r.reussis;
    }
    for (const bloc of ['absences', 'documents', 'duplicatas']) {
      for (const [k, v] of Object.entries(a[bloc])) total[bloc][k] += v;
    }
  }
  return total;
}

// --- Indicateurs -------------------------------------------------------------------------

const ORDRE_PERIODES = (cle) =>
  cle === 'ANNUEL' ? 99 : (cle.startsWith('SEMESTRE') ? 10 : 0) + Number(cle.split('-')[1]);

/**
 * Source du taux de réussite : relevés annuels s'il y en a, sinon la période la plus
 * avancée qui a des bulletins. La même source sert à toutes les zones comparées.
 */
function sourceReussite(total) {
  const cles = Object.keys(total.resultats).filter((c) => total.resultats[c].evalues > 0);
  return cles.sort((a, b) => ORDRE_PERIODES(b) - ORDRE_PERIODES(a))[0] ?? null;
}

function indicateurs(a, source, ecolesZone) {
  const r = source ? a.resultats[source] : null;
  const delivres = a.duplicatas.delivrees;
  return {
    etablissements: ecolesZone.filter((e) => e.statutVerification === 'VERIFIEE').length,
    etablissementsEnAttente: ecolesZone.filter((e) =>
      ['EN_ATTENTE', 'EN_EXAMEN'].includes(e.statutVerification),
    ).length,
    effectif: a.effectif,
    filles: a.filles,
    partFilles: taux(a.filles, a.effectif),
    elevesEvalues: r?.evalues ?? 0,
    moyenneGenerale: r?.evalues ? arrondi(r.somme / r.evalues) : null,
    tauxReussite: r?.evalues ? taux(r.reussis, r.evalues) : null,
    appels: a.absences.appels,
    tauxAbsence: taux(a.absences.absences, a.absences.attendus),
    absencesNonJustifiees: a.absences.nonJustifiees,
    retards: a.absences.retards,
    documentsDelivres: a.documents.bulletins + a.documents.releves,
    bulletins: a.documents.bulletins,
    releves: a.documents.releves,
    corrections: a.documents.corrections,
    delaiBulletinJours: a.documents.bulletinsDates
      ? arrondi(a.documents.delaiBulletinsS / a.documents.bulletinsDates / 86400, 1)
      : null,
    duplicatas: {
      demandes: a.duplicatas.demandes,
      delivres,
      rejetes: a.duplicatas.rejetees,
      enCours: a.duplicatas.enCours,
      delaiMoyenHeures: delivres ? arrondi(a.duplicatas.delaiS / delivres / 3600, 1) : null,
      partSous72h: taux(a.duplicatas.rapides, delivres),
    },
  };
}

/** Résultats de chaque période (et de l'année) pour la zone sélectionnée. */
function resultatsParPeriode(total) {
  return Object.entries(total.resultats)
    .filter(([, r]) => r.evalues > 0)
    .sort(([a], [b]) => ORDRE_PERIODES(a) - ORDRE_PERIODES(b))
    .map(([cle, r]) => ({
      cle,
      elevesEvalues: r.evalues,
      moyenneGenerale: arrondi(r.somme / r.evalues),
      tauxReussite: taux(r.reussis, r.evalues),
    }));
}

// --- Point d'entrée -------------------------------------------------------------------------

/**
 * Tableau de bord pour une année et une zone. Le détail descend d'un niveau :
 * national → départements, département → communes, commune → établissements.
 */
export async function tableauDeBord({ annee, departementId, communeId, ecoleId } = {}) {
  const annees = await anneesDisponibles();
  const anneeRetenue = annee ?? (await anneeParDefaut(annees));
  if (annee && !annees.includes(annee)) {
    throw new ErreurApi(404, 'ANNEE_INCONNUE', 'Aucune donnée pour cette année scolaire');
  }

  const [departements, ecoles] = await Promise.all([
    prisma.departement.findMany({
      orderBy: { nom: 'asc' },
      select: { id: true, code: true, nom: true, communes: { select: { id: true, nom: true } } },
    }),
    prisma.ecole.findMany({
      where: { actif: true },
      orderBy: { nom: 'asc' },
      select: {
        id: true,
        nom: true,
        statut: true,
        type: true,
        statutVerification: true,
        commune: { select: { id: true, nom: true, departementId: true } },
      },
    }),
  ]);
  const agregats = anneeRetenue ? await agregatsParEcole(anneeRetenue) : new Map();
  const de = (liste) => cumuler(liste.map((e) => agregats.get(e.id) ?? vide()));

  // Zone sélectionnée (la plus fine des trois)
  let selection = ecoles;
  let zone = { niveau: 'NATIONAL', nom: 'Bénin' };
  if (departementId) {
    const d = departements.find((x) => x.id === departementId);
    if (!d) throw new ErreurApi(404, 'INTROUVABLE', 'Département introuvable');
    selection = selection.filter((e) => e.commune.departementId === departementId);
    zone = { niveau: 'DEPARTEMENT', nom: d.nom };
  }
  if (communeId) {
    const c = departements.flatMap((d) => d.communes).find((x) => x.id === communeId);
    if (!c) throw new ErreurApi(404, 'INTROUVABLE', 'Commune introuvable');
    selection = selection.filter((e) => e.commune.id === communeId);
    zone = { niveau: 'COMMUNE', nom: c.nom };
  }
  if (ecoleId) {
    const e = ecoles.find((x) => x.id === ecoleId);
    if (!e) throw new ErreurApi(404, 'INTROUVABLE', 'Établissement introuvable');
    selection = [e];
    zone = { niveau: 'ETABLISSEMENT', nom: e.nom };
  }

  const total = de(selection);
  const source = sourceReussite(total);

  // Carte : tous les départements, avec la même source de réussite
  const parDepartement = departements.map((d) => {
    const ecolesDep = ecoles.filter((e) => e.commune.departementId === d.id);
    return { id: d.id, code: d.code, nom: d.nom, ...indicateurs(de(ecolesDep), source, ecolesDep) };
  });

  // Détail : un niveau sous la zone sélectionnée
  let detail = [];
  if (ecoleId) {
    detail = [];
  } else if (communeId) {
    detail = selection.map((e) => ({
      id: e.id,
      type: 'ETABLISSEMENT',
      nom: e.nom,
      statutVerification: e.statutVerification,
      ...indicateurs(de([e]), source, [e]),
    }));
  } else if (departementId) {
    const d = departements.find((x) => x.id === departementId);
    detail = d.communes
      .map((c) => {
        const ecolesCommune = selection.filter((e) => e.commune.id === c.id);
        return ecolesCommune.length
          ? {
              id: c.id,
              type: 'COMMUNE',
              nom: c.nom,
              ...indicateurs(de(ecolesCommune), source, ecolesCommune),
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.effectif - a.effectif || a.nom.localeCompare(b.nom));
  } else {
    detail = parDepartement.map((d) => ({ ...d, type: 'DEPARTEMENT' }));
  }

  return {
    annees,
    annee: anneeRetenue,
    zone,
    seuilReussite: SEUIL_REUSSITE,
    sourceReussite: source,
    synthese: indicateurs(total, source, selection),
    effectifsParNiveau: NIVEAUX.map((niveau) => ({
      niveau,
      effectif: total.parNiveau[niveau] ?? 0,
    })),
    resultatsParPeriode: resultatsParPeriode(total),
    parDepartement,
    detail,
    // Listes pour les filtres (zones et établissements actifs)
    zones: departements.map((d) => ({
      id: d.id,
      code: d.code,
      nom: d.nom,
      communes: d.communes
        .map((c) => ({
          id: c.id,
          nom: c.nom,
          ecoles: ecoles
            .filter((e) => e.commune.id === c.id)
            .map((e) => ({ id: e.id, nom: e.nom })),
        }))
        .sort((a, b) => a.nom.localeCompare(b.nom)),
    })),
  };
}
