// Cours en ligne (PDF, vidéo, lien) et devoirs (cahier de textes).
//
// Publication : l'enseignant de la matière, ou la direction. Lecture : le
// personnel de l'établissement, les élèves de la classe et leurs parents (les
// routes élève et parent passent l'identifiant de la classe de l'enfant).
// Les fichiers sont contrôlés par leur signature et stockés via utils/fichiers.js.
import { basename } from 'node:path';
import { ErreurApi } from '../../middlewares/erreurs.js';
import {
  detecterTypeFichier,
  empreinteSha256,
  enregistrerFichier,
  lireFichier,
  supprimerFichiers,
} from '../../utils/fichiers.js';

const jour = (date) => new Date(date).toISOString().slice(0, 10);

async function chargerEnseignement(db, enseignementId) {
  const enseignement = await db.enseignement.findUnique({
    where: { id: enseignementId },
    select: {
      id: true,
      classeId: true,
      enseignantId: true,
      matiere: { select: { nom: true } },
      classe: { select: { id: true, nom: true } },
    },
  });
  if (!enseignement) throw new ErreurApi(404, 'INTROUVABLE', 'Matière introuvable');
  return enseignement;
}

/** Seul l'enseignant de la matière (ou la direction) publie et retire. */
function verifierAuteur(utilisateur, enseignement) {
  if (utilisateur.role === 'ADMIN_ECOLE') return;
  if (utilisateur.role !== 'ENSEIGNANT' || enseignement.enseignantId !== utilisateur.id) {
    throw new ErreurApi(403, 'ACCES_REFUSE', 'Seul l’enseignant de cette matière peut publier ici');
  }
}

/** Contrôle et enregistre un fichier joint (PDF, PNG ou JPEG). */
async function stockerFichier(ecoleId, dossier, fichier) {
  if (!fichier) return {};
  const format = detecterTypeFichier(fichier.buffer);
  if (!format) {
    throw new ErreurApi(
      400,
      'FICHIER_INVALIDE',
      'Seuls les fichiers PDF, JPEG et PNG sont acceptés',
    );
  }
  const cheminFichier = await enregistrerFichier(
    `${dossier}/${ecoleId}`,
    fichier.buffer,
    format.extension,
  );
  return {
    nomFichier: basename(fichier.originalname || `document.${format.extension}`).slice(0, 255),
    cheminFichier,
    typeMime: format.typeMime,
    tailleOctets: fichier.buffer.length,
    empreinteSha256: empreinteSha256(fichier.buffer),
  };
}

const fichierPublic = (f) =>
  f.cheminFichier
    ? { nom: f.nomFichier, typeMime: f.typeMime, tailleOctets: f.tailleOctets }
    : null;

const auteurPublic = (a) => (a ? { nom: a.nom, prenoms: a.prenoms } : null);

// --- Cours ------------------------------------------------------------------------------

const presenterCours = (c) => ({
  id: c.id,
  enseignementId: c.enseignementId,
  matiere: c.enseignement?.matiere.nom,
  titre: c.titre,
  description: c.description,
  type: c.type,
  url: c.url,
  fichier: fichierPublic(c),
  auteur: auteurPublic(c.auteur),
  publieLe: c.publieLe,
});

const INCLURE = {
  auteur: { select: { nom: true, prenoms: true } },
  enseignement: { select: { matiere: { select: { nom: true } } } },
};

/** Cours d'une matière, ou de toute une classe (élève, parent). */
export async function listerCours(db, { enseignementId, classeId }) {
  const cours = await db.cours.findMany({
    where: enseignementId ? { enseignementId } : { enseignement: { classeId } },
    include: INCLURE,
    orderBy: { publieLe: 'desc' },
    take: 200,
  });
  return { cours: cours.map(presenterCours) };
}

export async function publierCours(db, utilisateur, donnees, fichier) {
  const enseignement = await chargerEnseignement(db, donnees.enseignementId);
  verifierAuteur(utilisateur, enseignement);
  if (donnees.type === 'DOCUMENT' && !fichier) {
    throw new ErreurApi(400, 'FICHIER_REQUIS', 'Joignez le document du cours (PDF)');
  }
  if (donnees.type !== 'DOCUMENT' && !donnees.url) {
    throw new ErreurApi(400, 'LIEN_REQUIS', 'Indiquez le lien de la vidéo ou de la ressource');
  }
  const stocke =
    donnees.type === 'DOCUMENT' ? await stockerFichier(utilisateur.ecoleId, 'cours', fichier) : {};
  try {
    const cours = await db.cours.create({
      data: {
        enseignementId: enseignement.id,
        auteurId: utilisateur.id,
        titre: donnees.titre,
        description: donnees.description ?? null,
        type: donnees.type,
        url: donnees.type === 'DOCUMENT' ? null : donnees.url,
        ...stocke,
      },
      include: INCLURE,
    });
    return { cours: presenterCours(cours) };
  } catch (erreur) {
    if (stocke.cheminFichier) await supprimerFichiers([stocke.cheminFichier]);
    throw erreur;
  }
}

export async function retirerCours(db, utilisateur, id) {
  const cours = await db.cours.findUnique({ where: { id } });
  if (!cours) throw new ErreurApi(404, 'INTROUVABLE', 'Cours introuvable');
  verifierAuteur(utilisateur, await chargerEnseignement(db, cours.enseignementId));
  await db.cours.delete({ where: { id } });
  if (cours.cheminFichier) await supprimerFichiers([cours.cheminFichier]);
  return { retire: true };
}

/** Document d'un cours ; `classeId` restreint aux cours d'une classe (élève, parent). */
export async function fichierCours(db, id, { classeId } = {}) {
  const cours = await db.cours.findUnique({
    where: { id },
    include: { enseignement: { select: { classeId: true } } },
  });
  if (!cours?.cheminFichier || (classeId && cours.enseignement.classeId !== classeId)) {
    throw new ErreurApi(404, 'INTROUVABLE', 'Document introuvable');
  }
  return {
    document: { typeMime: cours.typeMime, nomFichier: cours.nomFichier },
    contenu: await lireFichier(cours.cheminFichier),
  };
}

// --- Devoirs ---------------------------------------------------------------------------

const presenterDevoir = (d, { eleveId, effectif } = {}) => ({
  id: d.id,
  enseignementId: d.enseignementId,
  matiere: d.enseignement?.matiere.nom,
  titre: d.titre,
  consignes: d.consignes,
  pourLe: jour(d.pourLe),
  fichier: fichierPublic(d),
  auteur: auteurPublic(d.auteur),
  creeLe: d.creeLe,
  ...(eleveId !== undefined && { fait: d.faits.some((f) => f.eleveId === eleveId) }),
  ...(effectif !== undefined && { faits: d.faits.length, effectif }),
});

/**
 * Devoirs d'une matière (vue enseignant : combien l'ont fait) ou d'une classe
 * (vue élève/parent : fait ou non). `depuis` : date de remise minimale.
 */
export async function listerDevoirs(db, { enseignementId, classeId, eleveId, depuis }) {
  const devoirs = await db.devoir.findMany({
    where: {
      ...(enseignementId ? { enseignementId } : { enseignement: { classeId } }),
      ...(depuis && { pourLe: { gte: new Date(depuis) } }),
    },
    include: { ...INCLURE, faits: { select: { eleveId: true } } },
    orderBy: [{ pourLe: eleveId ? 'asc' : 'desc' }, { creeLe: 'desc' }],
    take: 200,
  });
  let effectif;
  if (enseignementId) {
    const { classeId: classe } = await chargerEnseignement(db, enseignementId);
    effectif = await db.inscription.count({ where: { classeId: classe, statut: 'INSCRIT' } });
  }
  return { devoirs: devoirs.map((d) => presenterDevoir(d, { eleveId, effectif })) };
}

export async function donnerDevoir(db, utilisateur, donnees, fichier) {
  const enseignement = await chargerEnseignement(db, donnees.enseignementId);
  verifierAuteur(utilisateur, enseignement);
  const stocke = await stockerFichier(utilisateur.ecoleId, 'devoirs', fichier);
  try {
    const devoir = await db.devoir.create({
      data: {
        enseignementId: enseignement.id,
        auteurId: utilisateur.id,
        titre: donnees.titre,
        consignes: donnees.consignes,
        pourLe: new Date(donnees.pourLe),
        ...stocke,
      },
      include: { ...INCLURE, faits: { select: { eleveId: true } } },
    });
    return { devoir: presenterDevoir(devoir) };
  } catch (erreur) {
    if (stocke.cheminFichier) await supprimerFichiers([stocke.cheminFichier]);
    throw erreur;
  }
}

export async function retirerDevoir(db, utilisateur, id) {
  const devoir = await db.devoir.findUnique({ where: { id } });
  if (!devoir) throw new ErreurApi(404, 'INTROUVABLE', 'Devoir introuvable');
  verifierAuteur(utilisateur, await chargerEnseignement(db, devoir.enseignementId));
  await db.devoir.delete({ where: { id } }); // les « fait » suivent (cascade)
  if (devoir.cheminFichier) await supprimerFichiers([devoir.cheminFichier]);
  return { retire: true };
}

export async function fichierDevoir(db, id, { classeId } = {}) {
  const devoir = await db.devoir.findUnique({
    where: { id },
    include: { enseignement: { select: { classeId: true } } },
  });
  if (!devoir?.cheminFichier || (classeId && devoir.enseignement.classeId !== classeId)) {
    throw new ErreurApi(404, 'INTROUVABLE', 'Document introuvable');
  }
  return {
    document: { typeMime: devoir.typeMime, nomFichier: devoir.nomFichier },
    contenu: await lireFichier(devoir.cheminFichier),
  };
}

/** L'élève coche (ou décoche) un devoir de sa classe ; rejouable sans effet de bord. */
export async function marquerDevoir(db, { eleveId, classeId, devoirId, fait }) {
  const devoir = await db.devoir.findFirst({
    where: { id: devoirId, enseignement: { classeId } },
    select: { id: true },
  });
  if (!devoir) throw new ErreurApi(404, 'INTROUVABLE', 'Devoir introuvable');
  if (fait) {
    await db.devoirFait.upsert({
      where: { devoirId_eleveId: { devoirId, eleveId } },
      update: {},
      create: { devoirId, eleveId },
    });
  } else {
    await db.devoirFait.deleteMany({ where: { devoirId, eleveId } });
  }
  return { fait };
}
