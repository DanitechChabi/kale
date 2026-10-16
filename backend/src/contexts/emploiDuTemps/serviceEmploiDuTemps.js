// Emplois du temps : créneaux hebdomadaires de chaque classe (lundi à samedi).
//
// Un créneau relie une classe, une matière (enseignement), un jour et un horaire.
// Conflits refusés : la classe (aussi garanti par PostgreSQL), l'enseignant et la
// salle ne peuvent pas être à deux endroits en même temps. Un créneau qui a déjà
// servi à faire l'appel n'est pas effacé : il est clos à la date du jour, ce qui
// garde l'historique des appels.
import { ErreurApi } from '../../middlewares/erreurs.js';
import { depuisHeure, versHeure } from '../../utils/heures.js';

/** Date du jour au Bénin, « AAAA-MM-JJ ». */
export const aujourdhuiBenin = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Porto-Novo' }).format(new Date());

/** 1 = lundi … 7 = dimanche */
export const jourSemaine = (date) => ((new Date(date).getUTCDay() + 6) % 7) + 1;

/** Créneaux valides à une date donnée. */
const valideLe = (date) => ({
  valideDu: { lte: new Date(date) },
  OR: [{ valideAu: null }, { valideAu: { gte: new Date(date) } }],
});

const SELECTION = {
  id: true,
  classeId: true,
  jour: true,
  heureDebut: true,
  heureFin: true,
  salle: true,
  classe: { select: { id: true, nom: true } },
  enseignement: {
    select: {
      id: true,
      matiere: { select: { nom: true, code: true } },
      enseignant: { select: { id: true, nom: true, prenoms: true } },
    },
  },
};

const presenter = (c) => ({
  id: c.id,
  jour: c.jour,
  heureDebut: depuisHeure(c.heureDebut),
  heureFin: depuisHeure(c.heureFin),
  salle: c.salle,
  classe: c.classe,
  enseignementId: c.enseignement.id,
  matiere: c.enseignement.matiere.nom,
  code: c.enseignement.matiere.code,
  enseignant: c.enseignement.enseignant,
});

const trier = (a, b) => a.jour - b.jour || a.heureDebut.localeCompare(b.heureDebut);

/** Emploi du temps d'une classe à une date (par défaut aujourd'hui). */
export async function emploiDuTempsClasse(db, classeId, date = aujourdhuiBenin()) {
  const classe = await db.classe.findUnique({
    where: { id: classeId },
    select: { id: true, nom: true, anneeScolaireId: true },
  });
  if (!classe) throw new ErreurApi(404, 'INTROUVABLE', 'Classe introuvable');
  const creneaux = await db.creneauEmploiDuTemps.findMany({
    where: { classeId, ...valideLe(date) },
    select: SELECTION,
  });
  return { classe, date, creneaux: creneaux.map(presenter).sort(trier) };
}

/** Emploi du temps d'un enseignant, toutes classes confondues. */
export async function emploiDuTempsEnseignant(db, enseignantId, date = aujourdhuiBenin()) {
  const creneaux = await db.creneauEmploiDuTemps.findMany({
    where: {
      enseignement: { enseignantId },
      classe: { anneeScolaire: { estCourante: true } },
      ...valideLe(date),
    },
    select: SELECTION,
  });
  return { date, creneaux: creneaux.map(presenter).sort(trier) };
}

/** Créneaux d'une classe un jour donné (proposés au moment de l'appel). */
export async function creneauxDuJour(db, classeId, date) {
  const jour = jourSemaine(date);
  if (jour > 6) return [];
  const { creneaux } = await emploiDuTempsClasse(db, classeId, date);
  return creneaux.filter((c) => c.jour === jour);
}

// --- Écriture ------------------------------------------------------------------------

const chevauche = (a, b) => a.heureDebut < b.heureFin && b.heureDebut < a.heureFin;

/** Conflits avec les autres créneaux en vigueur : classe, enseignant, salle. */
async function verifierConflits(
  db,
  { id, classeId, jour, heureDebut, heureFin, salle, enseignantId },
) {
  const autres = await db.creneauEmploiDuTemps.findMany({
    where: {
      jour,
      valideAu: null,
      ...(id && { id: { not: id } }),
      classe: { anneeScolaire: { estCourante: true } },
      OR: [
        { classeId },
        ...(enseignantId ? [{ enseignement: { enseignantId } }] : []),
        ...(salle ? [{ salle: { equals: salle, mode: 'insensitive' } }] : []),
      ],
    },
    select: SELECTION,
  });
  const nouveau = { heureDebut, heureFin };
  const conflits = autres
    .map(presenter)
    .filter((c) => chevauche(c, nouveau))
    .map((c) => ({
      ...c,
      motif:
        c.classe.id === classeId
          ? 'CLASSE'
          : enseignantId && c.enseignant?.id === enseignantId
            ? 'ENSEIGNANT'
            : 'SALLE',
    }));
  if (conflits.length) {
    const c = conflits[0];
    const message = {
      CLASSE: `La classe a déjà ${c.matiere} de ${c.heureDebut} à ${c.heureFin}`,
      ENSEIGNANT: `L’enseignant a déjà cours en ${c.classe.nom} de ${c.heureDebut} à ${c.heureFin}`,
      SALLE: `La salle ${c.salle} est occupée par la ${c.classe.nom} de ${c.heureDebut} à ${c.heureFin}`,
    }[c.motif];
    throw new ErreurApi(409, 'CRENEAU_OCCUPE', message, { conflits });
  }
}

async function chargerEnseignement(db, enseignementId) {
  const enseignement = await db.enseignement.findUnique({
    where: { id: enseignementId },
    select: {
      id: true,
      classeId: true,
      enseignantId: true,
      classe: { select: { anneeScolaire: { select: { dateDebut: true, estCourante: true } } } },
    },
  });
  if (!enseignement) throw new ErreurApi(404, 'INTROUVABLE', 'Matière introuvable');
  return enseignement;
}

function verifierHoraire({ heureDebut, heureFin }) {
  if (heureFin <= heureDebut) {
    throw new ErreurApi(400, 'HORAIRE_INVALIDE', 'L’heure de fin doit suivre l’heure de début');
  }
}

export async function creerCreneau(db, donnees) {
  verifierHoraire(donnees);
  const enseignement = await chargerEnseignement(db, donnees.enseignementId);
  if (!enseignement.classe.anneeScolaire.estCourante) {
    throw new ErreurApi(
      409,
      'ANNEE_TERMINEE',
      'Seules les classes de l’année en cours sont planifiées',
    );
  }
  const salle = donnees.salle?.trim() || null;
  await verifierConflits(db, {
    classeId: enseignement.classeId,
    jour: donnees.jour,
    heureDebut: donnees.heureDebut,
    heureFin: donnees.heureFin,
    salle,
    enseignantId: enseignement.enseignantId,
  });
  const creneau = await db.creneauEmploiDuTemps.create({
    data: {
      classeId: enseignement.classeId,
      enseignementId: enseignement.id,
      jour: donnees.jour,
      heureDebut: versHeure(donnees.heureDebut),
      heureFin: versHeure(donnees.heureFin),
      salle,
      valideDu: enseignement.classe.anneeScolaire.dateDebut,
    },
    select: SELECTION,
  });
  return { creneau: presenter(creneau) };
}

async function chargerCreneau(db, id) {
  const creneau = await db.creneauEmploiDuTemps.findUnique({
    where: { id },
    select: { ...SELECTION, valideAu: true, _count: { select: { appels: true } } },
  });
  if (!creneau || creneau.valideAu) throw new ErreurApi(404, 'INTROUVABLE', 'Créneau introuvable');
  return creneau;
}

export async function modifierCreneau(db, id, modifications) {
  const actuel = presenter(await chargerCreneau(db, id));
  const cible = { ...actuel, ...modifications };
  verifierHoraire(cible);
  const enseignement = await chargerEnseignement(db, cible.enseignementId);
  if (enseignement.classeId !== actuel.classe.id) {
    throw new ErreurApi(400, 'ENSEIGNEMENT_INVALIDE', 'Cette matière n’appartient pas à la classe');
  }
  const salle = cible.salle?.trim() || null;
  await verifierConflits(db, {
    id,
    classeId: actuel.classe.id,
    jour: cible.jour,
    heureDebut: cible.heureDebut,
    heureFin: cible.heureFin,
    salle,
    enseignantId: enseignement.enseignantId,
  });
  const creneau = await db.creneauEmploiDuTemps.update({
    where: { id },
    data: {
      enseignementId: enseignement.id,
      jour: cible.jour,
      heureDebut: versHeure(cible.heureDebut),
      heureFin: versHeure(cible.heureFin),
      salle,
    },
    select: SELECTION,
  });
  return { creneau: presenter(creneau) };
}

/** Supprime le créneau, ou le clôt s'il a déjà servi à l'appel (historique conservé). */
export async function supprimerCreneau(db, id) {
  const creneau = await chargerCreneau(db, id);
  if (creneau._count.appels) {
    // Clos hier : il ne bloque plus le créneau dès aujourd'hui
    const hier = new Date(`${aujourdhuiBenin()}T00:00:00Z`);
    hier.setUTCDate(hier.getUTCDate() - 1);
    const { valideDu } = await db.creneauEmploiDuTemps.findUnique({
      where: { id },
      select: { valideDu: true },
    });
    await db.creneauEmploiDuTemps.update({
      where: { id },
      data: { valideAu: hier < valideDu ? valideDu : hier },
    });
    return { archive: true };
  }
  await db.creneauEmploiDuTemps.delete({ where: { id } });
  return { archive: false };
}
