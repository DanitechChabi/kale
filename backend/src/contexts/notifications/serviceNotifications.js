// Notifications SMS aux parents : file d'envoi en base.
//
// 1. Un événement (absence relevée, bulletin délivré) appelle `planifier` : une
//    ligne par téléphone de parent, avec une clé d'unicité (rejouer l'événement
//    ne produit jamais de second SMS).
// 2. `envoyerEnAttente` envoie les lignes en attente avec le fournisseur configuré,
//    juste après l'événement, puis au démarrage du serveur pour les éventuels restes.
//    Chaque ligne est réservée avant l'envoi (statut ENVOI) : deux envois simultanés
//    ne prennent jamais la même. Après 3 échecs, la ligne passe en ECHEC.
import { prisma } from '../../config/prisma.js';
import { fournisseurSms } from './fournisseursSms.js';

export const TENTATIVES_MAX = 3;

/**
 * Téléphones à prévenir pour un élève : comptes parents reliés (avec téléphone)
 * et contact déclaré à l'inscription. `db` : client isolé de l'établissement.
 */
export async function destinatairesEleve(db, eleveId) {
  const eleve = await db.eleve.findUnique({
    where: { id: eleveId },
    select: {
      telephoneContactParent: true,
      // Lecture des comptes parents (sans établissement) à travers le lien de l'élève
      parents: { select: { parent: { select: { id: true, telephone: true, actif: true } } } },
    },
  });
  if (!eleve) return [];
  const parTelephone = new Map();
  for (const { parent } of eleve.parents) {
    if (parent.telephone && parent.actif) parTelephone.set(parent.telephone, parent.id);
  }
  if (eleve.telephoneContactParent && !parTelephone.has(eleve.telephoneContactParent)) {
    parTelephone.set(eleve.telephoneContactParent, null);
  }
  return [...parTelephone].map(([telephone, utilisateurId]) => ({ telephone, utilisateurId }));
}

/**
 * Met des messages en file. `evenements` : [{ eleveId, type, message, cle }].
 * Renvoie le nombre de messages réellement ajoutés (les doublons sont ignorés).
 */
export async function planifier(db, evenements) {
  const lignes = [];
  for (const { eleveId, type, message, cle } of evenements) {
    for (const { telephone, utilisateurId } of await destinatairesEleve(db, eleveId)) {
      lignes.push({
        eleveId,
        utilisateurId,
        telephone,
        type,
        message: message.slice(0, 480),
        cleUnicite: `${cle}:${telephone}`.slice(0, 200),
      });
    }
  }
  if (!lignes.length) return 0;
  const { count } = await db.notification.createMany({ data: lignes, skipDuplicates: true });
  declencherEnvoi();
  return count;
}

let envoiEnCours = null;

/** Lance un envoi sans attendre (les erreurs sont gardées en base, jamais propagées). */
export function declencherEnvoi() {
  envoiEnCours ??= envoyerEnAttente()
    .catch((erreur) => console.error('Envoi des SMS interrompu :', erreur))
    .finally(() => {
      envoiEnCours = null;
    });
  return envoiEnCours;
}

/**
 * Envoie les messages en attente. File technique transversale : client global,
 * chaque ligne portant déjà son établissement.
 */
export async function envoyerEnAttente({ lot = 50 } = {}) {
  const fournisseur = fournisseurSms();
  let envoyes = 0;
  for (;;) {
    const enAttente = await prisma.notification.findMany({
      where: { statut: 'EN_ATTENTE' },
      orderBy: { creeLe: 'asc' },
      take: lot,
      select: { id: true, telephone: true, message: true, tentatives: true },
    });
    if (!enAttente.length) return envoyes;
    for (const n of enAttente) {
      // Réservation : seule une ligne encore EN_ATTENTE peut passer en ENVOI
      const { count } = await prisma.notification.updateMany({
        where: { id: n.id, statut: 'EN_ATTENTE' },
        data: { statut: 'ENVOI', tentatives: { increment: 1 }, fournisseur: fournisseur.nom },
      });
      if (!count) continue;
      try {
        const { idExterne } = await fournisseur.envoyer({
          telephone: n.telephone,
          message: n.message,
        });
        await prisma.notification.update({
          where: { id: n.id },
          data: { statut: 'ENVOYEE', envoyeeLe: new Date(), idExterne, derniereErreur: null },
        });
        envoyes++;
      } catch (erreur) {
        await prisma.notification.update({
          where: { id: n.id },
          data: {
            statut: n.tentatives + 1 >= TENTATIVES_MAX ? 'ECHEC' : 'EN_ATTENTE',
            derniereErreur: String(erreur?.message ?? erreur).slice(0, 300),
          },
        });
      }
    }
  }
}

/**
 * Au démarrage (une seule instance) : remet en file les messages réservés par un
 * envoi interrompu, puis envoie tout ce qui attend.
 */
export async function reprendreEnvoisInterrompus() {
  await prisma.notification.updateMany({
    where: { statut: 'ENVOI' },
    data: { statut: 'EN_ATTENTE' },
  });
  return declencherEnvoi();
}

// --- Côté établissement (client isolé) ---------------------------------------------

export async function journalNotifications(db, { statut, page = 1, parPage = 50 } = {}) {
  const where = statut ? { statut } : {};
  const [notifications, total, compteurs] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { creeLe: 'desc' },
      skip: (page - 1) * parPage,
      take: parPage,
      include: { eleve: { select: { nom: true, prenoms: true } } },
    }),
    db.notification.count({ where }),
    db.notification.groupBy({ by: ['statut'], _count: { _all: true } }),
  ]);
  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      // Fournisseur « journal » : message enregistré, mais pas transmis à un opérateur
      statut: n.statut === 'ENVOYEE' && n.fournisseur === 'journal' ? 'JOURNALISEE' : n.statut,
      telephone: n.telephone,
      message: n.message,
      eleve: `${n.eleve.nom} ${n.eleve.prenoms}`,
      tentatives: n.tentatives,
      derniereErreur: n.derniereErreur,
      creeLe: n.creeLe,
      envoyeeLe: n.envoyeeLe,
    })),
    total,
    compteurs: Object.fromEntries(compteurs.map((c) => [c.statut, c._count._all])),
  };
}

/** Remet en file un message en échec (nouvelle série de tentatives). */
export async function relancer(db, id) {
  const { count } = await db.notification.updateMany({
    where: { id, statut: 'ECHEC' },
    data: { statut: 'EN_ATTENTE', tentatives: 0 },
  });
  if (count) declencherEnvoi();
  return { relance: Boolean(count) };
}
