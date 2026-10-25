// Isolation multi-établissements au niveau de l'accès aux données.
//
// prismaPourEcole(ecoleId) renvoie un client Prisma qui ajoute automatiquement
// « ecole_id = <établissement de l'utilisateur> » à chaque lecture, modification
// et suppression, et l'impose à chaque création. Un utilisateur d'établissement
// ne peut donc ni lire ni toucher les données d'une autre école, même en cas
// d'oubli dans un service.
//
// Principe « fermé par défaut » : un modèle non classé ci-dessous est refusé.
// Le SQL brut ($queryRaw) n'est pas filtré : il est interdit avec ce client.
import { prisma } from '../config/prisma.js';
import { ErreurApi } from '../middlewares/erreurs.js';

/** Modèles portant un ecole_id, filtrés automatiquement */
const MODELES_ISOLES = new Set([
  'Utilisateur',
  'DocumentEcole',
  'AnneeScolaire',
  'Periode',
  'Classe',
  'Matiere',
  'Enseignement',
  'Eleve',
  'LienParentEleve',
  'Inscription',
  'ChoixOption',
  'CreneauEmploiDuTemps',
  'Appel',
  'Presence',
  'Evaluation',
  'Note',
  'ReleveArchive',
  'DemandeDuplicata',
  'JournalAudit',
  'Notification',
  'Cours',
  'Devoir',
  'DevoirFait',
  'RenduDevoir',
  'RenduFichier',
  'EduMailIdentifiant',
  'EduMailCompte',
  'EduMailConsentement',
  'EduMailEvenement',
  'EduMailSignalement',
]);

/** Référentiels nationaux : lecture seule pour un établissement */
const MODELES_REFERENCE = new Set([
  'Departement',
  'Commune',
  'Serie',
  'MatiereReference',
  'ProgrammeMatiere',
]);

const OPERATIONS_FILTREES = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'updateManyAndReturn',
  'deleteMany',
]);
const OPERATIONS_UNIQUES = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'delete',
  'upsert',
]);
const OPERATIONS_CREATION = new Set(['create', 'createMany', 'createManyAndReturn']);
const LECTURES = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

const violation = (message) => new ErreurApi(403, 'ISOLATION', message);

function verifierPasDeChangementEcole(donnees, ecoleId) {
  for (const ligne of [].concat(donnees ?? [])) {
    if (ligne.ecole !== undefined)
      throw violation('Relation « ecole » interdite : utiliser ecoleId');
    if (ligne.ecoleId !== undefined && ligne.ecoleId !== ecoleId) {
      throw violation('Accès refusé : données d’un autre établissement');
    }
  }
}

function imposerEcole(donnees, ecoleId) {
  verifierPasDeChangementEcole(donnees, ecoleId);
  return Array.isArray(donnees)
    ? donnees.map((ligne) => ({ ...ligne, ecoleId }))
    : { ...donnees, ecoleId };
}

const clients = new Map();

export function prismaPourEcole(ecoleId) {
  if (!ecoleId) throw new Error('prismaPourEcole : ecoleId obligatoire');
  if (clients.has(ecoleId)) return clients.get(ecoleId);

  const client = prisma.$extends({
    name: 'isolation-ecole',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (MODELES_REFERENCE.has(model)) {
            if (!LECTURES.has(operation))
              throw violation(`Référentiel national en lecture seule (${model})`);
            return query(args);
          }

          // L'établissement lui-même : lecture et mise à jour de sa propre fiche uniquement
          if (model === 'Ecole') {
            if (!['findUnique', 'findUniqueOrThrow', 'findFirst', 'update'].includes(operation)) {
              throw violation(`Opération interdite sur Ecole : ${operation}`);
            }
            if (operation === 'findFirst') {
              return query({ ...args, where: { AND: [args.where ?? {}, { id: ecoleId }] } });
            }
            // Demande explicite d'un autre établissement : introuvable
            if (args.where?.id !== undefined && args.where.id !== ecoleId) {
              if (operation === 'findUnique') return null;
              throw new ErreurApi(404, 'INTROUVABLE', 'Établissement introuvable');
            }
            return query({ ...args, where: { ...args.where, id: ecoleId } });
          }

          if (!MODELES_ISOLES.has(model)) throw violation(`Modèle non autorisé : ${model}`);

          const nouveauxArgs = { ...args };
          if (OPERATIONS_FILTREES.has(operation)) {
            nouveauxArgs.where = { AND: [args.where ?? {}, { ecoleId }] };
            if (args.data) verifierPasDeChangementEcole(args.data, ecoleId);
          } else if (OPERATIONS_UNIQUES.has(operation)) {
            nouveauxArgs.where = { ...args.where, ecoleId };
            if (args.data) verifierPasDeChangementEcole(args.data, ecoleId);
            if (operation === 'upsert') {
              verifierPasDeChangementEcole(args.update, ecoleId);
              nouveauxArgs.create = imposerEcole(args.create, ecoleId);
            }
          } else if (OPERATIONS_CREATION.has(operation)) {
            nouveauxArgs.data = imposerEcole(args.data, ecoleId);
          } else {
            throw violation(`Opération non prise en charge : ${operation}`);
          }
          return query(nouveauxArgs);
        },
      },
    },
  });

  clients.set(ecoleId, client);
  return client;
}
