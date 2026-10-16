// Suivi de la scolarité d'un élève, pour l'élève lui-même et pour ses parents :
// moyennes de chaque période, notes, absences et documents archivés.
//
// Côté parent, le compte n'a pas d'établissement : chaque enfant est lu avec le
// client isolé de SON établissement (prismaPourEcole), après contrôle du lien
// parent-élève. Un parent ne voit donc jamais un élève qui n'est pas le sien.
import { prisma } from '../../config/prisma.js';
import { prismaPourEcole } from '../../db/isolation.js';
import { ErreurApi } from '../../middlewares/erreurs.js';
import { surVingt } from '../notes/calcul.js';
import { resultatsClasse } from '../notes/serviceNotes.js';
import { depuisHeure } from '../presences/serviceAppels.js';
import { documentsEleve } from '../releves/serviceReleves.js';

const jour = (date) => new Date(date).toISOString().slice(0, 10);

/** Inscription de l'année en cours (ou, à défaut, la plus récente). */
export async function inscriptionActuelle(db, eleveId) {
  return db.inscription.findFirst({
    where: { eleveId },
    orderBy: [{ anneeScolaire: { estCourante: 'desc' } }, { anneeScolaire: { dateDebut: 'desc' } }],
    include: {
      classe: { select: { id: true, nom: true } },
      anneeScolaire: { include: { periodes: { orderBy: { numero: 'asc' } } } },
    },
  });
}

/** Moyennes et notes d'un élève pour chaque période de l'année. */
async function periodesEleve(db, eleveId, inscription) {
  const periodes = [];
  for (const periode of inscription.anneeScolaire.periodes) {
    const resultats = await resultatsClasse(db, inscription.classeId, periode.id);
    const ligne = resultats.eleves.find((e) => e.id === eleveId);
    const { evaluations } = resultats._interne;
    const matieres = resultats.enseignements
      .map((e) => ({
        matiere: e.matiere,
        coefficient: e.coefficient,
        estFacultative: e.estFacultative,
        groupeOption: e.groupeOption,
        moyenne: ligne?.moyennes[e.id]?.moyenne ?? null,
        moyenneClasse: e.statistiques.moyenne,
        notes: evaluations
          .filter((ev) => ev.enseignementId === e.id)
          .map((ev) => {
            const n = ev.notes.find((x) => x.eleveId === eleveId);
            return n
              ? {
                  type: ev.type,
                  libelle: ev.libelle,
                  date: jour(ev.date),
                  absent: n.absent,
                  valeur: n.absent ? null : Number(n.valeur),
                  bareme: Number(ev.bareme),
                  surVingt: n.absent ? null : surVingt(n.valeur, ev.bareme),
                }
              : null;
          })
          .filter(Boolean),
      }))
      // Matière optionnelle non suivie : masquée
      .filter((m) => m.moyenne !== null || m.notes.length || !(m.estFacultative || m.groupeOption));
    periodes.push({
      id: periode.id,
      type: periode.type,
      numero: periode.numero,
      dateDebut: jour(periode.dateDebut),
      dateFin: jour(periode.dateFin),
      estCloturee: periode.estCloturee,
      moyenneGenerale: ligne?.moyenneGenerale ?? null,
      // Le rang n'est communiqué qu'une fois la période clôturée (il bouge jusque-là)
      rang: periode.estCloturee ? (ligne?.rang ?? null) : null,
      exAequo: periode.estCloturee ? (ligne?.exAequo ?? false) : false,
      effectif: resultats.eleves.filter((e) => e.rang).length,
      moyenneClasse: resultats.statistiques.moyenne,
      matieres,
    });
  }
  return periodes;
}

async function absencesEleve(db, eleveId, annee) {
  const presences = await db.presence.findMany({
    where: {
      eleveId,
      statut: { in: ['ABSENT', 'RETARD'] },
      appel: { date: { gte: annee.dateDebut, lte: annee.dateFin } },
    },
    include: {
      appel: {
        select: {
          date: true,
          heureDebut: true,
          enseignement: { select: { matiere: { select: { nom: true } } } },
        },
      },
    },
    orderBy: [{ appel: { date: 'desc' } }, { appel: { heureDebut: 'desc' } }],
  });
  return presences.map((p) => ({
    id: p.id,
    date: jour(p.appel.date),
    heureDebut: depuisHeure(p.appel.heureDebut),
    matiere: p.appel.enseignement?.matiere.nom ?? null,
    statut: p.statut,
    minutesRetard: p.minutesRetard,
    justifiee: p.justifiee,
    motif: p.motif,
  }));
}

/** Tableau de bord complet d'un élève (client isolé de son établissement). */
export async function suiviEleve(db, eleveId) {
  const eleve = await db.eleve.findUnique({
    where: { id: eleveId },
    select: { id: true, nom: true, prenoms: true, identifiant: true, matricule: true, sexe: true },
  });
  if (!eleve) throw new ErreurApi(404, 'INTROUVABLE', 'Élève introuvable');
  const inscription = await inscriptionActuelle(db, eleveId);
  const ecole = await db.ecole.findFirst({ select: { nom: true, telephone: true } });
  if (!inscription) {
    return {
      eleve,
      ecole,
      classe: null,
      anneeScolaire: null,
      periodes: [],
      absences: [],
      documents: [],
    };
  }
  const [periodes, absences, { documents }] = await Promise.all([
    periodesEleve(db, eleveId, inscription),
    absencesEleve(db, eleveId, inscription.anneeScolaire),
    documentsEleve(db, eleveId),
  ]);
  return {
    eleve,
    ecole,
    classe: inscription.classe,
    anneeScolaire: inscription.anneeScolaire.libelle,
    periodes,
    absences,
    documents,
  };
}

// --- Parents -------------------------------------------------------------------------

/**
 * Liens du parent avec ses enfants (toutes écoles). Client global : le compte
 * parent n'a pas d'établissement ; seuls ses propres liens sont lus.
 */
async function liensParent(parentId) {
  return prisma.lienParentEleve.findMany({
    where: {
      parentId,
      ecole: { statutVerification: 'VERIFIEE', actif: true },
    },
    select: { eleveId: true, ecoleId: true, lien: true },
  });
}

/** Client isolé de l'établissement de l'enfant, après contrôle du lien. */
export async function accesEnfant(parentId, eleveId) {
  const lien = (await liensParent(parentId)).find((l) => l.eleveId === eleveId);
  if (!lien) throw new ErreurApi(404, 'INTROUVABLE', 'Enfant introuvable');
  return { db: prismaPourEcole(lien.ecoleId), lien };
}

/** Enfants du parent avec un résumé : classe, dernière moyenne, absences non justifiées. */
export async function mesEnfants(parentId) {
  const liens = await liensParent(parentId);
  const enfants = [];
  for (const { eleveId, ecoleId, lien } of liens) {
    const db = prismaPourEcole(ecoleId);
    const suivi = await suiviEleve(db, eleveId);
    const notees = suivi.periodes.filter((p) => p.moyenneGenerale !== null);
    const derniere = notees.at(-1) ?? null;
    enfants.push({
      id: eleveId,
      lien,
      nom: suivi.eleve.nom,
      prenoms: suivi.eleve.prenoms,
      ecole: suivi.ecole.nom,
      classe: suivi.classe?.nom ?? null,
      anneeScolaire: suivi.anneeScolaire,
      dernierePeriode: derniere && {
        type: derniere.type,
        numero: derniere.numero,
        estCloturee: derniere.estCloturee,
        moyenneGenerale: derniere.moyenneGenerale,
        rang: derniere.rang,
        effectif: derniere.effectif,
      },
      absencesNonJustifiees: suivi.absences.filter((a) => a.statut === 'ABSENT' && !a.justifiee)
        .length,
      documents: suivi.documents.filter((d) => !d.remplacePar).length,
    });
  }
  return { enfants };
}

/** SMS reçus par le parent (sur son téléphone ou à son compte), du plus récent au plus ancien. */
export async function messagesParent(parent) {
  const notifications = await prisma.notification.findMany({
    where: {
      OR: [
        { utilisateurId: parent.id },
        ...(parent.telephone ? [{ telephone: parent.telephone }] : []),
      ],
      // Uniquement pour ses propres enfants
      eleve: { parents: { some: { parentId: parent.id } } },
    },
    orderBy: { creeLe: 'desc' },
    take: 50,
    select: { id: true, type: true, message: true, statut: true, creeLe: true, eleveId: true },
  });
  return { messages: notifications };
}

/** Classe actuelle d'un élève (cours, devoirs, emploi du temps). */
export async function classeActuelle(db, eleveId) {
  const inscription = await inscriptionActuelle(db, eleveId);
  if (!inscription) throw new ErreurApi(404, 'SANS_CLASSE', 'Aucune inscription en cours');
  return inscription.classe.id;
}
