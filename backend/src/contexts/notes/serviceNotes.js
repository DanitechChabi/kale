// Évaluations, saisie des notes, résultats de classe et clôture des périodes.
//
// Saisie hors connexion : le client génère lui-même l'identifiant d'une
// évaluation créée sans réseau, et renvoie la feuille complète de notes ; les
// deux opérations sont idempotentes (rejouées sans effet de bord à la reconnexion).
import { ErreurApi } from '../../middlewares/erreurs.js';
import { journaliser } from '../audit/journal.js';
import { detecterAnomalies } from './anomalies.js';
import { classer, moyenneGenerale, moyenneMatiere, statistiques } from './calcul.js';

const LIBELLES_TYPES = {
  INTERROGATION: 'Interrogation',
  DEVOIR: 'Devoir',
  COMPOSITION: 'Composition',
};
const nombre = (d) => (d === null || d === undefined ? null : Number(d));

// --- Droits -------------------------------------------------------------------

async function chargerEnseignement(db, id) {
  const enseignement = await db.enseignement.findUnique({
    where: { id },
    include: {
      matiere: { select: { id: true, nom: true, code: true } },
      classe: { select: { id: true, nom: true, anneeScolaireId: true } },
    },
  });
  if (!enseignement)
    throw new ErreurApi(404, 'INTROUVABLE', 'Matière introuvable dans cette classe');
  return enseignement;
}

/** Le responsable saisit partout ; un enseignant, uniquement dans ses matières. */
function verifierDroitSaisie(utilisateur, enseignement) {
  if (utilisateur.role === 'ADMIN_ECOLE') return;
  if (utilisateur.role === 'ENSEIGNANT' && enseignement.enseignantId === utilisateur.id) return;
  throw new ErreurApi(403, 'ACCES_REFUSE', 'Vous n’enseignez pas cette matière dans cette classe');
}

async function chargerPeriode(db, periodeId, anneeScolaireId) {
  const periode = await db.periode.findUnique({ where: { id: periodeId } });
  if (!periode || (anneeScolaireId && periode.anneeScolaireId !== anneeScolaireId)) {
    throw new ErreurApi(404, 'INTROUVABLE', 'Période introuvable pour cette classe');
  }
  return periode;
}

const periodeCloturee = () =>
  new ErreurApi(
    409,
    'PERIODE_CLOTUREE',
    'Cette période est clôturée : les notes ne peuvent plus être modifiées',
  );

// --- Enseignements et évaluations --------------------------------------------

/** Matières enseignées par l'utilisateur pendant l'année en cours. */
export async function mesEnseignements(db, utilisateur) {
  const annee = await db.anneeScolaire.findFirst({
    where: { estCourante: true },
    include: { periodes: { orderBy: { numero: 'asc' } } },
  });
  if (!annee) return { annee: null, enseignements: [] };
  const enseignements = await db.enseignement.findMany({
    where: {
      classe: { anneeScolaireId: annee.id },
      ...(utilisateur.role === 'ENSEIGNANT' && { enseignantId: utilisateur.id }),
    },
    include: {
      matiere: { select: { nom: true } },
      classe: {
        select: {
          id: true,
          nom: true,
          niveau: true,
          _count: { select: { inscriptions: { where: { statut: 'INSCRIT' } } } },
        },
      },
      _count: { select: { evaluations: true } },
    },
    orderBy: [{ classe: { niveau: 'asc' } }, { classe: { nom: 'asc' } }],
  });
  return {
    annee: { id: annee.id, libelle: annee.libelle, periodes: annee.periodes },
    enseignements: enseignements.map((e) => ({
      id: e.id,
      matiere: e.matiere.nom,
      coefficient: e.coefficient,
      classe: { id: e.classe.id, nom: e.classe.nom },
      effectif: e.classe._count.inscriptions,
      nombreEvaluations: e._count.evaluations,
    })),
  };
}

export async function listerEvaluations(db, utilisateur, enseignementId, periodeId) {
  const enseignement = await chargerEnseignement(db, enseignementId);
  if (utilisateur.role === 'ENSEIGNANT') verifierDroitSaisie(utilisateur, enseignement);
  const periode = await chargerPeriode(db, periodeId, enseignement.classe.anneeScolaireId);
  const evaluations = await db.evaluation.findMany({
    where: { enseignementId, periodeId },
    include: { notes: { select: { valeur: true, absent: true } } },
    orderBy: [{ date: 'asc' }, { creeLe: 'asc' }],
  });
  return {
    enseignement: {
      id: enseignement.id,
      matiere: enseignement.matiere.nom,
      classe: enseignement.classe,
      coefficient: enseignement.coefficient,
    },
    periode,
    evaluations: evaluations.map(({ notes, ...e }) => ({
      ...e,
      bareme: nombre(e.bareme),
      nombreNotes: notes.filter((n) => !n.absent && n.valeur !== null).length,
      statistiques: statistiques(
        notes
          .filter((n) => !n.absent && n.valeur !== null)
          .map((n) => (Number(n.valeur) * 20) / Number(e.bareme)),
      ),
    })),
  };
}

/** Création idempotente : un identifiant déjà connu renvoie l'évaluation existante. */
export async function creerEvaluation(db, utilisateur, donnees) {
  const enseignement = await chargerEnseignement(db, donnees.enseignementId);
  verifierDroitSaisie(utilisateur, enseignement);
  const periode = await chargerPeriode(db, donnees.periodeId, enseignement.classe.anneeScolaireId);

  if (donnees.id) {
    const existante = await db.evaluation.findUnique({ where: { id: donnees.id } });
    if (existante) {
      if (existante.enseignementId !== enseignement.id)
        throw new ErreurApi(409, 'CONFLIT', 'Identifiant déjà utilisé');
      return { ...existante, bareme: nombre(existante.bareme) };
    }
  }
  if (periode.estCloturee) throw periodeCloturee();

  let libelle = donnees.libelle?.trim();
  if (!libelle) {
    const meme = await db.evaluation.count({
      where: { enseignementId: enseignement.id, periodeId: periode.id, type: donnees.type },
    });
    libelle =
      donnees.type === 'COMPOSITION' && meme === 0
        ? 'Composition'
        : `${LIBELLES_TYPES[donnees.type]} ${meme + 1}`;
  }
  const evaluation = await db.evaluation.create({
    data: {
      ...(donnees.id && { id: donnees.id }),
      enseignementId: enseignement.id,
      periodeId: periode.id,
      type: donnees.type,
      libelle,
      date: donnees.date,
      bareme: donnees.bareme ?? 20,
      creeParId: utilisateur.id,
    },
  });
  return { ...evaluation, bareme: nombre(evaluation.bareme) };
}

async function chargerEvaluation(db, id) {
  const evaluation = await db.evaluation.findUnique({
    where: { id },
    include: {
      periode: true,
      enseignement: {
        include: {
          matiere: { select: { id: true, nom: true } },
          classe: { select: { id: true, nom: true, anneeScolaireId: true } },
        },
      },
    },
  });
  if (!evaluation) throw new ErreurApi(404, 'INTROUVABLE', 'Évaluation introuvable');
  return evaluation;
}

export async function modifierEvaluation(db, utilisateur, id, donnees) {
  const evaluation = await chargerEvaluation(db, id);
  verifierDroitSaisie(utilisateur, evaluation.enseignement);
  if (evaluation.periode.estCloturee) throw periodeCloturee();
  if (donnees.bareme !== undefined) {
    const max = await db.note.aggregate({ where: { evaluationId: id }, _max: { valeur: true } });
    if (max._max.valeur !== null && Number(max._max.valeur) > donnees.bareme) {
      throw new ErreurApi(
        400,
        'BAREME_INSUFFISANT',
        `Une note de ${Number(max._max.valeur)} dépasse ce barème`,
      );
    }
  }
  const resultat = await db.evaluation.update({ where: { id }, data: donnees });
  return { ...resultat, bareme: nombre(resultat.bareme) };
}

export async function supprimerEvaluation(db, utilisateur, id) {
  const evaluation = await chargerEvaluation(db, id);
  verifierDroitSaisie(utilisateur, evaluation.enseignement);
  if (evaluation.periode.estCloturee) throw periodeCloturee();
  if (await db.note.count({ where: { evaluationId: id } })) {
    throw new ErreurApi(409, 'EVALUATION_NOTEE', 'Retirez d’abord les notes de cette évaluation');
  }
  await db.evaluation.delete({ where: { id } });
}

// --- Feuille de notes ---------------------------------------------------------

async function elevesDeLaClasse(db, classeId) {
  const inscriptions = await db.inscription.findMany({
    where: { classeId, statut: 'INSCRIT' },
    include: {
      eleve: { select: { id: true, nom: true, prenoms: true, matricule: true, identifiant: true } },
    },
    orderBy: [{ eleve: { nom: 'asc' } }, { eleve: { prenoms: 'asc' } }],
  });
  return inscriptions.map((i) => ({ ...i.eleve, inscriptionId: i.id }));
}

export async function feuilleNotes(db, utilisateur, evaluationId) {
  const evaluation = await chargerEvaluation(db, evaluationId);
  if (utilisateur.role === 'ENSEIGNANT') verifierDroitSaisie(utilisateur, evaluation.enseignement);
  const [eleves, notes] = await Promise.all([
    elevesDeLaClasse(db, evaluation.enseignement.classe.id),
    db.note.findMany({ where: { evaluationId } }),
  ]);
  const parEleve = new Map(notes.map((n) => [n.eleveId, n]));
  const valeurs = notes
    .filter((n) => !n.absent && n.valeur !== null)
    .map((n) => (Number(n.valeur) * 20) / Number(evaluation.bareme));
  return {
    evaluation: {
      id: evaluation.id,
      type: evaluation.type,
      libelle: evaluation.libelle,
      date: evaluation.date,
      bareme: nombre(evaluation.bareme),
      periode: {
        id: evaluation.periode.id,
        numero: evaluation.periode.numero,
        type: evaluation.periode.type,
        estCloturee: evaluation.periode.estCloturee,
      },
      enseignement: {
        id: evaluation.enseignement.id,
        matiere: evaluation.enseignement.matiere.nom,
        classe: { id: evaluation.enseignement.classe.id, nom: evaluation.enseignement.classe.nom },
      },
    },
    eleves: eleves.map((e) => {
      const n = parEleve.get(e.id);
      return {
        ...e,
        note: n
          ? { id: n.id, valeur: nombre(n.valeur), absent: n.absent, modifieLe: n.modifieLe }
          : null,
      };
    }),
    statistiques: statistiques(valeurs),
  };
}

/**
 * Enregistre une feuille de notes. Chaque création, modification ou retrait est
 * tracé dans le journal d'audit (ancienne et nouvelle valeur). Renvoyer deux
 * fois la même feuille ne produit aucun changement.
 * `saisies` : [{ eleveId, valeur (nombre ou null), absent }]
 */
export async function enregistrerNotes(db, utilisateur, evaluationId, saisies, { adresseIp } = {}) {
  const evaluation = await chargerEvaluation(db, evaluationId);
  verifierDroitSaisie(utilisateur, evaluation.enseignement);
  if (evaluation.periode.estCloturee) throw periodeCloturee();

  const bareme = Number(evaluation.bareme);
  const autorises = new Set(
    (await elevesDeLaClasse(db, evaluation.enseignement.classe.id)).map((e) => e.id),
  );
  const inconnus = saisies.filter((s) => !autorises.has(s.eleveId));
  if (inconnus.length)
    throw new ErreurApi(
      400,
      'ELEVE_HORS_CLASSE',
      'Un élève de la feuille n’est pas inscrit dans cette classe',
    );
  const horsBareme = saisies.find((s) => s.valeur !== null && s.valeur > bareme);
  if (horsBareme) throw new ErreurApi(400, 'HORS_BAREME', `Note supérieure au barème (${bareme})`);

  const existantes = new Map(
    (await db.note.findMany({ where: { evaluationId } })).map((n) => [n.eleveId, n]),
  );
  const bilan = { creees: 0, modifiees: 0, retirees: 0, inchangees: 0 };
  const contexte = { utilisateurId: utilisateur.id, adresseIp, entite: 'Note' };
  const instantane = (n) => ({
    valeur: nombre(n.valeur),
    absent: n.absent,
    evaluationId,
    eleveId: n.eleveId,
  });

  await db.$transaction(async (tx) => {
    for (const { eleveId, valeur, absent } of saisies) {
      const actuelle = existantes.get(eleveId);
      const vide = !absent && valeur === null;

      if (vide) {
        if (!actuelle) continue;
        await tx.note.delete({ where: { id: actuelle.id } });
        await journaliser(tx, {
          ...contexte,
          action: 'SUPPRESSION',
          entiteId: actuelle.id,
          avant: instantane(actuelle),
        });
        bilan.retirees++;
        continue;
      }

      const nouvelleValeur = absent ? null : valeur;
      if (actuelle) {
        if (actuelle.absent === absent && nombre(actuelle.valeur) === nouvelleValeur) {
          bilan.inchangees++;
          continue;
        }
        const note = await tx.note.update({
          where: { id: actuelle.id },
          data: { valeur: nouvelleValeur, absent, saisieParId: utilisateur.id },
        });
        await journaliser(tx, {
          ...contexte,
          action: 'MODIFICATION',
          entiteId: note.id,
          avant: instantane(actuelle),
          apres: instantane(note),
        });
        bilan.modifiees++;
      } else {
        const note = await tx.note.create({
          data: {
            evaluationId,
            eleveId,
            valeur: nouvelleValeur,
            absent,
            saisieParId: utilisateur.id,
          },
        });
        await journaliser(tx, {
          ...contexte,
          action: 'CREATION',
          entiteId: note.id,
          apres: instantane(note),
        });
        bilan.creees++;
      }
    }
  });

  return { bilan, ...(await feuilleNotes(db, utilisateur, evaluationId)) };
}

export async function historiqueNote(db, utilisateur, noteId) {
  const note = await db.note.findUnique({
    where: { id: noteId },
    include: { evaluation: { include: { enseignement: true } } },
  });
  if (!note) throw new ErreurApi(404, 'INTROUVABLE', 'Note introuvable');
  if (utilisateur.role === 'ENSEIGNANT')
    verifierDroitSaisie(utilisateur, note.evaluation.enseignement);
  return db.journalAudit.findMany({
    where: { entite: 'Note', entiteId: noteId },
    orderBy: { creeLe: 'asc' },
    include: { utilisateur: { select: { nom: true, prenoms: true, role: true } } },
  });
}

// --- Résultats ----------------------------------------------------------------

/** Calcule moyennes, moyenne générale et rangs d'une classe pour une période. */
export async function resultatsClasse(db, classeId, periodeId) {
  const classe = await db.classe.findUnique({
    where: { id: classeId },
    include: {
      enseignements: {
        include: {
          matiere: {
            select: {
              nom: true,
              code: true,
              matiereReference: { select: { ordreAffichage: true } },
            },
          },
        },
      },
    },
  });
  if (!classe) throw new ErreurApi(404, 'INTROUVABLE', 'Classe introuvable');
  const periode = await chargerPeriode(db, periodeId, classe.anneeScolaireId);
  const enseignements = [...classe.enseignements].sort(
    (a, b) =>
      (a.matiere.matiereReference?.ordreAffichage ?? 999) -
        (b.matiere.matiereReference?.ordreAffichage ?? 999) ||
      a.matiere.nom.localeCompare(b.matiere.nom),
  );

  const [eleves, evaluations, choix] = await Promise.all([
    elevesDeLaClasse(db, classeId),
    db.evaluation.findMany({
      where: { periodeId, enseignementId: { in: enseignements.map((e) => e.id) } },
      include: { notes: true },
      orderBy: { date: 'asc' },
    }),
    db.choixOption.findMany({ where: { enseignementId: { in: enseignements.map((e) => e.id) } } }),
  ]);
  const choisis = new Set(choix.map((c) => `${c.inscriptionId}|${c.enseignementId}`));
  const groupesChoisis = new Set(
    choix.map(
      (c) =>
        `${c.inscriptionId}|${enseignements.find((e) => e.id === c.enseignementId)?.groupeOption}`,
    ),
  );

  // Moyenne de chaque élève dans chaque matière
  const moyennes = new Map(); // `${eleveId}|${enseignementId}` → résultat
  for (const enseignement of enseignements) {
    const evals = evaluations.filter((e) => e.enseignementId === enseignement.id);
    for (const eleve of eleves) {
      const notes = evals.flatMap((e) =>
        e.notes
          .filter((n) => n.eleveId === eleve.id)
          .map((n) => ({
            type: e.type,
            valeur: nombre(n.valeur),
            bareme: Number(e.bareme),
            absent: n.absent,
          })),
      );
      moyennes.set(`${eleve.id}|${enseignement.id}`, moyenneMatiere(notes));
    }
  }

  // Moyenne générale de chaque élève
  const generales = eleves.map((eleve) => {
    const lignes = enseignements.map((e) => {
      const m = moyennes.get(`${eleve.id}|${e.id}`);
      let suivie;
      if (e.estFacultative)
        suivie = choisis.has(`${eleve.inscriptionId}|${e.id}`) || m.nombreNotes > 0;
      else if (e.groupeOption && groupesChoisis.has(`${eleve.inscriptionId}|${e.groupeOption}`)) {
        suivie = choisis.has(`${eleve.inscriptionId}|${e.id}`);
      }
      return {
        enseignementId: e.id,
        coefficient: e.coefficient,
        moyenne: m.moyenne,
        estFacultative: e.estFacultative,
        groupeOption: e.groupeOption,
        suivie,
      };
    });
    return { eleve, ...moyenneGenerale(lignes) };
  });

  const rangsGeneraux = classer(generales.map((g) => ({ id: g.eleve.id, moyenne: g.moyenne })));
  const rangsMatieres = new Map(
    enseignements.map((e) => [
      e.id,
      classer(
        eleves.map((el) => ({ id: el.id, moyenne: moyennes.get(`${el.id}|${e.id}`).moyenne })),
      ),
    ]),
  );

  const resumeEnseignements = enseignements.map((e) => {
    const evals = evaluations.filter((x) => x.enseignementId === e.id);
    const optionnelle = e.estFacultative || Boolean(e.groupeOption);
    const manquantes = optionnelle
      ? 0
      : evals.reduce(
          (t, ev) => t + eleves.filter((el) => !ev.notes.some((n) => n.eleveId === el.id)).length,
          0,
        );
    return {
      id: e.id,
      matiere: e.matiere.nom,
      code: e.matiere.code,
      coefficient: e.coefficient,
      estFacultative: e.estFacultative,
      groupeOption: e.groupeOption,
      nombreEvaluations: evals.length,
      notesManquantes: manquantes,
      statistiques: statistiques(eleves.map((el) => moyennes.get(`${el.id}|${e.id}`).moyenne)),
    };
  });

  return {
    classe: { id: classe.id, nom: classe.nom, niveau: classe.niveau },
    periode: {
      id: periode.id,
      numero: periode.numero,
      type: periode.type,
      estCloturee: periode.estCloturee,
      dateFin: periode.dateFin,
    },
    enseignements: resumeEnseignements,
    eleves: generales
      .map((g) => ({
        id: g.eleve.id,
        nom: g.eleve.nom,
        prenoms: g.eleve.prenoms,
        matricule: g.eleve.matricule,
        moyenneGenerale: g.moyenne,
        totalPoints: g.totalPoints,
        totalCoefficients: g.totalCoefficients,
        rang: rangsGeneraux.get(g.eleve.id)?.rang ?? null,
        exAequo: rangsGeneraux.get(g.eleve.id)?.exAequo ?? false,
        moyennes: Object.fromEntries(
          enseignements.map((e) => [
            e.id,
            {
              moyenne: moyennes.get(`${g.eleve.id}|${e.id}`).moyenne,
              rang: rangsMatieres.get(e.id).get(g.eleve.id)?.rang ?? null,
            },
          ]),
        ),
      }))
      .sort((a, b) => (a.rang ?? Infinity) - (b.rang ?? Infinity) || a.nom.localeCompare(b.nom)),
    statistiques: statistiques(generales.map((g) => g.moyenne)),
    _interne: { evaluations, eleves, enseignements, moyennes },
  };
}

/** Résultats pour l'API (sans les données internes de calcul). */
export async function resultatsClassePublics(db, classeId, periodeId) {
  const resultats = await resultatsClasse(db, classeId, periodeId);
  delete resultats._interne;
  return resultats;
}

// --- Contrôle avant clôture et clôture ----------------------------------------

async function anomaliesClasse(db, resultats, periodePrecedente) {
  const { evaluations, eleves, enseignements, moyennes } = resultats._interne;
  const nomMatiere = new Map(enseignements.map((e) => [e.id, e.matiere.nom]));
  const noms = new Map(eleves.map((e) => [e.id, `${e.nom} ${e.prenoms}`]));

  const moyennesActuelles = new Map();
  for (const [cle, m] of moyennes) {
    const [eleveId, enseignementId] = cle.split('|');
    moyennesActuelles.set(`${eleveId}|${nomMatiere.get(enseignementId)}`, m.moyenne);
  }
  const moyennesPrecedentes = new Map();
  if (periodePrecedente) {
    const precedents = await resultatsClasse(db, resultats.classe.id, periodePrecedente.id);
    for (const [cle, m] of precedents._interne.moyennes) {
      const [eleveId, enseignementId] = cle.split('|');
      moyennesPrecedentes.set(`${eleveId}|${nomMatiere.get(enseignementId)}`, m.moyenne);
    }
  }

  const idsNotes = evaluations.flatMap((e) => e.notes.map((n) => n.id));
  const journal = idsNotes.length
    ? await db.journalAudit.findMany({
        where: { entite: 'Note', action: 'MODIFICATION', entiteId: { in: idsNotes } },
      })
    : [];
  const finPeriode = new Date(resultats.periode.dateFin.getTime() + 86_400_000);
  const historiques = new Map();
  for (const entree of journal) {
    const h = historiques.get(entree.entiteId) ?? { modifications: 0, apresFinPeriode: false };
    h.modifications++;
    if (entree.creeLe > finPeriode) h.apresFinPeriode = true;
    historiques.set(entree.entiteId, h);
  }

  return detecterAnomalies({
    evaluations: evaluations.map((e) => ({
      id: e.id,
      libelle: e.libelle,
      matiere: nomMatiere.get(e.enseignementId),
      notes: e.notes.map((n) => ({
        id: n.id,
        eleveId: n.eleveId,
        valeur: nombre(n.valeur),
        bareme: Number(e.bareme),
        absent: n.absent,
      })),
    })),
    moyennesActuelles,
    moyennesPrecedentes,
    historiques,
    noms,
  });
}

export async function controlerPeriode(db, periodeId) {
  const periode = await db.periode.findUnique({ where: { id: periodeId } });
  if (!periode) throw new ErreurApi(404, 'INTROUVABLE', 'Période introuvable');
  const precedente =
    periode.numero > 1
      ? await db.periode.findFirst({
          where: { anneeScolaireId: periode.anneeScolaireId, numero: periode.numero - 1 },
        })
      : null;
  const classes = await db.classe.findMany({
    where: { anneeScolaireId: periode.anneeScolaireId },
    orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
    select: { id: true, nom: true },
  });

  const bilan = [];
  for (const classe of classes) {
    const resultats = await resultatsClasse(db, classe.id, periodeId);
    if (!resultats.eleves.length) continue;
    const sansEvaluation = resultats.enseignements
      .filter((e) => !e.estFacultative && !e.groupeOption && e.nombreEvaluations === 0)
      .map((e) => e.matiere);
    const notesManquantes = resultats.enseignements.reduce((t, e) => t + e.notesManquantes, 0);
    bilan.push({
      classe,
      effectif: resultats.eleves.length,
      sansEvaluation,
      notesManquantes,
      anomalies: await anomaliesClasse(db, resultats, precedente),
      moyenneClasse: resultats.statistiques.moyenne,
    });
  }

  return {
    periode: {
      id: periode.id,
      numero: periode.numero,
      type: periode.type,
      estCloturee: periode.estCloturee,
    },
    pret: bilan.every((c) => !c.sansEvaluation.length && !c.notesManquantes),
    classes: bilan,
    totalAnomalies: bilan.reduce((t, c) => t + c.anomalies.length, 0),
  };
}

/** Clôture définitive : les notes de la période deviennent non modifiables (trigger PostgreSQL). */
export async function cloturerPeriode(
  db,
  utilisateur,
  periodeId,
  { forcer = false, motif } = {},
  { adresseIp } = {},
) {
  const controle = await controlerPeriode(db, periodeId);
  if (controle.periode.estCloturee)
    throw new ErreurApi(409, 'DEJA_CLOTUREE', 'Cette période est déjà clôturée');
  if (!controle.pret && !forcer) {
    throw new ErreurApi(409, 'CLOTURE_INCOMPLETE', 'Des notes manquent encore', {
      classes: controle.classes
        .filter((c) => c.sansEvaluation.length || c.notesManquantes)
        .map((c) => ({
          classe: c.classe.nom,
          sansEvaluation: c.sansEvaluation,
          notesManquantes: c.notesManquantes,
        })),
    });
  }
  if (forcer && !controle.pret && !motif) {
    throw new ErreurApi(
      400,
      'MOTIF_OBLIGATOIRE',
      'Indiquez pourquoi la période est clôturée malgré les notes manquantes',
    );
  }

  const periode = await db.periode.update({
    where: { id: periodeId },
    data: { estCloturee: true, clotureeLe: new Date(), clotureeParId: utilisateur.id },
  });
  await journaliser(db, {
    utilisateurId: utilisateur.id,
    adresseIp,
    action: 'MODIFICATION',
    entite: 'Periode',
    entiteId: periodeId,
    avant: { estCloturee: false },
    apres: {
      estCloturee: true,
      forcee: !controle.pret,
      motif: motif ?? null,
      anomalies: controle.totalAnomalies,
    },
  });
  return periode;
}
