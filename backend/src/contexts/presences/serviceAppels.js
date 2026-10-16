// Appel en classe : absences et retards, justification par le secrétariat.
//
// Une feuille d'appel est identifiée par (classe, date, heure de début) : la
// renvoyer complète remplace la précédente (écriture rejouable, idempotente).
// Chaque absence ou retard nouvellement relevé déclenche un SMS aux parents,
// une seule fois par élève et par appel.
import { ErreurApi } from '../../middlewares/erreurs.js';
import { messageAbsence } from '../notifications/messages.js';
import { planifier } from '../notifications/serviceNotifications.js';

/** « 08:30 » → Date de l'heure (colonne TIME) */
export const versHeure = (texte) => new Date(`1970-01-01T${texte}:00.000Z`);
export const depuisHeure = (date) => new Date(date).toISOString().slice(11, 16);
const jour = (date) => new Date(date).toISOString().slice(0, 10);

async function chargerClasse(db, classeId) {
  const classe = await db.classe.findUnique({
    where: { id: classeId },
    select: {
      id: true,
      nom: true,
      anneeScolaire: { select: { id: true, dateDebut: true, dateFin: true, estCourante: true } },
      professeurPrincipalId: true,
      enseignements: { select: { id: true, enseignantId: true } },
    },
  });
  if (!classe) throw new ErreurApi(404, 'INTROUVABLE', 'Classe introuvable');
  return classe;
}

/** Un enseignant fait l'appel dans les classes où il enseigne (ou dont il est professeur principal). */
function verifierDroit(utilisateur, classe) {
  if (utilisateur.role !== 'ENSEIGNANT') return;
  const enseigne =
    classe.professeurPrincipalId === utilisateur.id ||
    classe.enseignements.some((e) => e.enseignantId === utilisateur.id);
  if (!enseigne) {
    throw new ErreurApi(403, 'ACCES_REFUSE', 'Vous n’enseignez pas dans cette classe');
  }
}

async function inscrits(db, classeId) {
  const inscriptions = await db.inscription.findMany({
    where: { classeId, statut: 'INSCRIT' },
    select: { eleve: { select: { id: true, nom: true, prenoms: true, matricule: true } } },
    orderBy: [{ eleve: { nom: 'asc' } }, { eleve: { prenoms: 'asc' } }],
  });
  return inscriptions.map((i) => i.eleve);
}

/** Feuille d'appel : élèves de la classe et statut déjà relevé (présent par défaut). */
export async function feuilleAppel(db, utilisateur, { classeId, date, heureDebut }) {
  const classe = await chargerClasse(db, classeId);
  verifierDroit(utilisateur, classe);
  const [eleves, appel, appelsDuJour] = await Promise.all([
    inscrits(db, classeId),
    db.appel.findUnique({
      where: {
        classeId_date_heureDebut: {
          classeId,
          date: new Date(date),
          heureDebut: versHeure(heureDebut),
        },
      },
      include: { presences: true, faitPar: { select: { nom: true, prenoms: true } } },
    }),
    db.appel.findMany({
      where: { classeId, date: new Date(date) },
      select: {
        heureDebut: true,
        _count: { select: { presences: { where: { statut: { not: 'PRESENT' } } } } },
      },
      orderBy: { heureDebut: 'asc' },
    }),
  ]);
  const parEleve = new Map(appel?.presences.map((p) => [p.eleveId, p]) ?? []);
  return {
    classe: { id: classe.id, nom: classe.nom },
    date,
    heureDebut,
    enregistre: Boolean(appel),
    faitPar: appel?.faitPar ?? null,
    appelsDuJour: appelsDuJour.map((a) => ({
      heureDebut: depuisHeure(a.heureDebut),
      absences: a._count.presences,
    })),
    eleves: eleves.map((e) => {
      const p = parEleve.get(e.id);
      return {
        ...e,
        statut: p?.statut ?? 'PRESENT',
        minutesRetard: p?.minutesRetard ?? null,
        justifiee: p?.justifiee ?? false,
      };
    }),
  };
}

/**
 * Enregistre la feuille complète. Les élèves absents de la liste envoyée sont
 * considérés présents. Renvoie la feuille à jour et le nombre de SMS mis en file.
 */
export async function enregistrerAppel(db, utilisateur, donnees) {
  const { classeId, date, heureDebut, enseignementId = null, presences } = donnees;
  const classe = await chargerClasse(db, classeId);
  verifierDroit(utilisateur, classe);
  const { anneeScolaire } = classe;
  if (!anneeScolaire.estCourante) {
    throw new ErreurApi(
      409,
      'ANNEE_TERMINEE',
      'L’appel se fait dans les classes de l’année en cours',
    );
  }
  const jourAppel = new Date(date);
  if (jourAppel < anneeScolaire.dateDebut || jourAppel > anneeScolaire.dateFin) {
    throw new ErreurApi(400, 'DATE_HORS_ANNEE', 'Cette date est en dehors de l’année scolaire');
  }
  // Date du jour au Bénin (et non en temps universel)
  const aujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Porto-Novo' }).format(
    new Date(),
  );
  if (jour(jourAppel) > aujourdhui) {
    throw new ErreurApi(400, 'DATE_FUTURE', 'L’appel ne peut pas être fait pour une date future');
  }
  if (enseignementId && !classe.enseignements.some((e) => e.id === enseignementId)) {
    throw new ErreurApi(400, 'ENSEIGNEMENT_INVALIDE', 'Matière inconnue dans cette classe');
  }

  const eleves = await inscrits(db, classeId);
  const idsClasse = new Set(eleves.map((e) => e.id));
  const etrangers = presences.filter((p) => !idsClasse.has(p.eleveId));
  if (etrangers.length) {
    throw new ErreurApi(400, 'ELEVE_HORS_CLASSE', 'Élève non inscrit dans cette classe', {
      eleves: etrangers.map((p) => p.eleveId),
    });
  }
  const statuts = new Map(presences.map((p) => [p.eleveId, p]));

  const cleAppel = {
    classeId_date_heureDebut: { classeId, date: jourAppel, heureDebut: versHeure(heureDebut) },
  };
  const appel = await db.appel.upsert({
    where: cleAppel,
    update: { enseignementId, faitParId: utilisateur.id },
    create: {
      classeId,
      date: jourAppel,
      heureDebut: versHeure(heureDebut),
      enseignementId,
      faitParId: utilisateur.id,
    },
    include: { presences: true },
  });

  const anciennes = new Map(appel.presences.map((p) => [p.eleveId, p]));
  const nouveauxManquements = [];
  for (const eleve of eleves) {
    const saisie = statuts.get(eleve.id) ?? { statut: 'PRESENT' };
    const minutesRetard = saisie.statut === 'RETARD' ? (saisie.minutesRetard ?? 5) : null;
    const ancienne = anciennes.get(eleve.id);
    if (ancienne && ancienne.statut === saisie.statut && ancienne.minutesRetard === minutesRetard) {
      continue;
    }
    const presence = await db.presence.upsert({
      where: { appelId_eleveId: { appelId: appel.id, eleveId: eleve.id } },
      update: {
        statut: saisie.statut,
        minutesRetard,
        // Une absence corrigée en présence perd sa justification
        ...(saisie.statut === 'PRESENT' && {
          justifiee: false,
          motif: null,
          justifieeParId: null,
          justifieeLe: null,
        }),
      },
      create: { appelId: appel.id, eleveId: eleve.id, statut: saisie.statut, minutesRetard },
    });
    if (saisie.statut !== 'PRESENT') nouveauxManquements.push({ eleve, presence });
  }

  let smsEnFile = 0;
  if (nouveauxManquements.length) {
    const ecole = await db.ecole.findFirst({
      select: { nom: true, telephone: true, smsAbsences: true },
    });
    if (ecole.smsAbsences) {
      smsEnFile = await planifier(
        db,
        nouveauxManquements.map(({ eleve, presence }) => ({
          eleveId: eleve.id,
          type: 'ABSENCE',
          // Une même présence ne produit qu'un SMS par statut (absence puis retard possibles)
          cle: `presence:${presence.id}:${presence.statut}`,
          message: messageAbsence({
            eleve,
            ecole,
            appel,
            statut: presence.statut,
            minutesRetard: presence.minutesRetard,
          }),
        })),
      );
    }
  }

  return { ...(await feuilleAppel(db, utilisateur, { classeId, date, heureDebut })), smsEnFile };
}

/** Absences et retards d'une période (toute l'école ou une classe), du plus récent au plus ancien. */
export async function listerAbsences(db, { classeId, du, au, nonJustifiees }) {
  const presences = await db.presence.findMany({
    where: {
      statut: { in: ['ABSENT', 'RETARD'] },
      ...(nonJustifiees && { justifiee: false }),
      appel: {
        ...(classeId && { classeId }),
        date: { ...(du && { gte: new Date(du) }), ...(au && { lte: new Date(au) }) },
      },
    },
    include: {
      eleve: { select: { id: true, nom: true, prenoms: true } },
      appel: { select: { date: true, heureDebut: true, classe: { select: { nom: true } } } },
    },
    orderBy: [{ appel: { date: 'desc' } }, { appel: { heureDebut: 'desc' } }],
    take: 300,
  });
  return {
    absences: presences.map((p) => ({
      id: p.id,
      eleve: p.eleve,
      classe: p.appel.classe.nom,
      date: jour(p.appel.date),
      heureDebut: depuisHeure(p.appel.heureDebut),
      statut: p.statut,
      minutesRetard: p.minutesRetard,
      justifiee: p.justifiee,
      motif: p.motif,
    })),
  };
}

export async function justifier(db, utilisateur, presenceId, { motif }) {
  const presence = await db.presence.findUnique({ where: { id: presenceId } });
  if (!presence || presence.statut === 'PRESENT') {
    throw new ErreurApi(404, 'INTROUVABLE', 'Absence introuvable');
  }
  await db.presence.update({
    where: { id: presenceId },
    data: { justifiee: true, motif, justifieeParId: utilisateur.id, justifieeLe: new Date() },
  });
  return { justifiee: true };
}
