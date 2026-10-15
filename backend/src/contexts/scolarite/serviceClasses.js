// Classes, matières de l'établissement et enseignements (matière + coefficient
// + enseignant dans une classe). Une classe créée reçoit automatiquement les
// matières et coefficients du programme national de son niveau et de sa série.
import { ErreurApi } from '../../middlewares/erreurs.js';
import { anneeCourante } from './serviceAnnees.js';
import { ABREVIATIONS_NIVEAUX, NIVEAUX_SECOND_CYCLE } from './libelles.js';

const INCLUSION_ENSEIGNEMENT = {
  matiere: { select: { id: true, code: true, nom: true, matiereReferenceId: true } },
  enseignant: { select: { id: true, nom: true, prenoms: true } },
};

const ORDRE_ENSEIGNEMENTS = [
  { matiere: { matiereReference: { ordreAffichage: 'asc' } } },
  { matiere: { nom: 'asc' } },
];

/** Programme national d'un niveau (et d'une série au second cycle). */
export async function lireProgramme(client, niveau, serieId) {
  return client.programmeMatiere.findMany({
    where: { niveau, serieId: serieId ?? null },
    include: { matiereReference: true },
    orderBy: { matiereReference: { ordreAffichage: 'asc' } },
  });
}

async function resoudreSerie(db, ecoleId, niveau, serieId) {
  const secondCycle = NIVEAUX_SECOND_CYCLE.includes(niveau);
  if (!secondCycle) {
    if (serieId) throw new ErreurApi(400, 'SERIE_INTERDITE', 'Pas de série au premier cycle');
    return null;
  }
  if (!serieId) throw new ErreurApi(400, 'SERIE_REQUISE', 'Choisissez la série de la classe');
  const serie = await db.serie.findUnique({ where: { id: serieId } });
  if (!serie) throw new ErreurApi(400, 'SERIE_INVALIDE', 'Série inconnue');
  const ecole = await db.ecole.findUnique({ where: { id: ecoleId } });
  if (!ecole.ordres.includes(serie.ordre)) {
    throw new ErreurApi(
      400,
      'SERIE_HORS_ORDRE',
      `La série ${serie.code} relève de l’enseignement ${serie.ordre === 'TECHNIQUE' ? 'technique' : 'général'}, non déclaré par l’établissement`,
    );
  }
  return serie;
}

/** Nom proposé : « 6e A », « Tle D B »… première lettre libre. */
async function proposerNom(db, anneeScolaireId, niveau, serie) {
  const prefixe = `${ABREVIATIONS_NIVEAUX[niveau]}${serie ? ` ${serie.code}` : ''}`;
  const existants = new Set(
    (await db.classe.findMany({ where: { anneeScolaireId }, select: { nom: true } })).map(
      (c) => c.nom,
    ),
  );
  for (const lettre of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (!existants.has(`${prefixe} ${lettre}`)) return `${prefixe} ${lettre}`;
  }
  throw new ErreurApi(409, 'NOM_INDISPONIBLE', 'Indiquez un nom pour cette classe');
}

async function verifierEnseignant(db, enseignantId) {
  if (!enseignantId) return;
  const enseignant = await db.utilisateur.findFirst({
    where: { id: enseignantId, role: { in: ['ENSEIGNANT', 'ADMIN_ECOLE'] }, actif: true },
  });
  if (!enseignant)
    throw new ErreurApi(400, 'ENSEIGNANT_INVALIDE', 'Enseignant introuvable dans l’établissement');
}

export async function listerClasses(db, { anneeScolaireId }) {
  const annee = anneeScolaireId ? { id: anneeScolaireId } : await anneeCourante(db);
  const classes = await db.classe.findMany({
    where: { anneeScolaireId: annee.id },
    orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
    include: {
      serie: { select: { code: true, libelle: true } },
      professeurPrincipal: { select: { id: true, nom: true, prenoms: true } },
      _count: { select: { enseignements: true, inscriptions: { where: { statut: 'INSCRIT' } } } },
    },
  });
  return classes.map(({ _count, ...c }) => ({
    ...c,
    effectif: _count.inscriptions,
    nombreMatieres: _count.enseignements,
  }));
}

export async function creerClasse(db, ecoleId, donnees) {
  const annee = donnees.anneeScolaireId
    ? await db.anneeScolaire.findUnique({ where: { id: donnees.anneeScolaireId } })
    : await anneeCourante(db);
  if (!annee) throw new ErreurApi(404, 'INTROUVABLE', 'Année scolaire introuvable');

  const serie = await resoudreSerie(db, ecoleId, donnees.niveau, donnees.serieId);
  await verifierEnseignant(db, donnees.professeurPrincipalId);
  const nom = donnees.nom?.trim() || (await proposerNom(db, annee.id, donnees.niveau, serie));
  const programme = await lireProgramme(db, donnees.niveau, serie?.id);

  return db.$transaction(async (tx) => {
    const classe = await tx.classe.create({
      data: {
        anneeScolaireId: annee.id,
        niveau: donnees.niveau,
        serieId: serie?.id ?? null,
        nom,
        professeurPrincipalId: donnees.professeurPrincipalId ?? null,
      },
    });

    // Matières de l'établissement rattachées au catalogue national (créées au besoin)
    for (const ligne of programme) {
      const reference = ligne.matiereReference;
      const matiere =
        (await tx.matiere.findFirst({ where: { matiereReferenceId: reference.id } })) ??
        (await tx.matiere.findFirst({ where: { code: reference.code } })) ??
        (await tx.matiere.create({
          data: { code: reference.code, nom: reference.nom, matiereReferenceId: reference.id },
        }));
      await tx.enseignement.create({
        data: {
          classeId: classe.id,
          matiereId: matiere.id,
          coefficient: ligne.coefficient,
          heuresHebdo: ligne.heuresHebdo,
          groupeOption: ligne.groupeOption,
          estFacultative: ligne.estFacultative,
        },
      });
    }
    return lireClasse(tx, classe.id);
  });
}

export async function lireClasse(db, id) {
  const classe = await db.classe.findUnique({
    where: { id },
    include: {
      anneeScolaire: { select: { id: true, libelle: true, estCourante: true } },
      serie: { select: { id: true, code: true, libelle: true } },
      professeurPrincipal: { select: { id: true, nom: true, prenoms: true } },
      enseignements: { include: INCLUSION_ENSEIGNEMENT, orderBy: ORDRE_ENSEIGNEMENTS },
      inscriptions: {
        where: { statut: 'INSCRIT' },
        include: {
          eleve: {
            select: {
              id: true,
              identifiant: true,
              matricule: true,
              nom: true,
              prenoms: true,
              sexe: true,
              dateNaissance: true,
              utilisateurId: true,
            },
          },
        },
        orderBy: [{ eleve: { nom: 'asc' } }, { eleve: { prenoms: 'asc' } }],
      },
    },
  });
  if (!classe) throw new ErreurApi(404, 'INTROUVABLE', 'Classe introuvable');
  const { inscriptions, ...reste } = classe;
  return {
    ...reste,
    eleves: inscriptions.map((i) => ({
      ...i.eleve,
      inscriptionId: i.id,
      redoublant: i.redoublant,
    })),
  };
}

export async function modifierClasse(db, id, { nom, professeurPrincipalId }) {
  await verifierEnseignant(db, professeurPrincipalId);
  await db.classe.update({
    where: { id },
    data: {
      ...(nom && { nom: nom.trim() }),
      ...(professeurPrincipalId !== undefined && { professeurPrincipalId }),
    },
  });
  return lireClasse(db, id);
}

export async function supprimerClasse(db, id) {
  const classe = await db.classe.findUnique({
    where: { id },
    include: { _count: { select: { inscriptions: true, appels: true, creneaux: true } } },
  });
  if (!classe) throw new ErreurApi(404, 'INTROUVABLE', 'Classe introuvable');
  if (classe._count.inscriptions || classe._count.appels || classe._count.creneaux) {
    throw new ErreurApi(
      409,
      'CLASSE_UTILISEE',
      'Cette classe a déjà des élèves ou un emploi du temps : elle ne peut pas être supprimée',
    );
  }
  await db.$transaction(async (tx) => {
    await tx.enseignement.deleteMany({ where: { classeId: id } });
    await tx.classe.delete({ where: { id } });
  });
}

// --- Matières de l'établissement --------------------------------------------

export function listerMatieres(db) {
  return db.matiere.findMany({
    orderBy: [{ matiereReference: { ordreAffichage: 'asc' } }, { nom: 'asc' }],
    include: {
      matiereReference: { select: { code: true } },
      _count: { select: { enseignements: true } },
    },
  });
}

/** Matière propre à l'établissement (hors catalogue national). */
export function creerMatiere(db, { code, nom }) {
  return db.matiere.create({ data: { code, nom } });
}

export function modifierMatiere(db, id, donnees) {
  return db.matiere.update({ where: { id }, data: donnees });
}

// --- Enseignements ------------------------------------------------------------

export async function ajouterEnseignement(db, classeId, donnees) {
  const [classe, matiere] = await Promise.all([
    db.classe.findUnique({ where: { id: classeId } }),
    db.matiere.findUnique({ where: { id: donnees.matiereId } }),
  ]);
  if (!classe) throw new ErreurApi(404, 'INTROUVABLE', 'Classe introuvable');
  if (!matiere) throw new ErreurApi(404, 'INTROUVABLE', 'Matière introuvable');
  await verifierEnseignant(db, donnees.enseignantId);
  return db.enseignement.create({
    data: { ...donnees, classeId },
    include: INCLUSION_ENSEIGNEMENT,
  });
}

export async function modifierEnseignement(db, id, donnees) {
  await verifierEnseignant(db, donnees.enseignantId);
  return db.enseignement.update({ where: { id }, data: donnees, include: INCLUSION_ENSEIGNEMENT });
}

export async function retirerEnseignement(db, id) {
  const enseignement = await db.enseignement.findUnique({
    where: { id },
    include: {
      _count: { select: { evaluations: true, creneaux: true, choixOptions: true, appels: true } },
    },
  });
  if (!enseignement)
    throw new ErreurApi(404, 'INTROUVABLE', 'Matière introuvable dans cette classe');
  const { evaluations, creneaux, choixOptions, appels } = enseignement._count;
  if (evaluations || creneaux || choixOptions || appels) {
    throw new ErreurApi(
      409,
      'ENSEIGNEMENT_UTILISE',
      'Cette matière a déjà des notes, des cours ou des choix d’élèves',
    );
  }
  await db.enseignement.delete({ where: { id } });
}
