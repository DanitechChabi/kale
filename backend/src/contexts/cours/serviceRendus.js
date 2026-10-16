// Copies de devoirs rendues par les élèves : photos des pages ou PDF (5 au plus).
//
// Un élève rend une copie par devoir ; un nouvel envoi la remplace entièrement
// (anciens fichiers supprimés) et efface l'éventuelle appréciation. Rendre la copie
// coche aussi le devoir comme « fait ». L'enseignant de la matière consulte les
// copies de la classe et laisse une appréciation ; les parents voient l'état.
import { basename } from 'node:path';
import { ErreurApi } from '../../middlewares/erreurs.js';
import {
  detecterTypeFichier,
  empreinteSha256,
  enregistrerFichier,
  lireFichier,
  supprimerFichiers,
} from '../../utils/fichiers.js';

export const PAGES_MAX = 5;
const jour = (date) => new Date(date).toISOString().slice(0, 10);

async function devoirDeLaClasse(db, devoirId, classeId) {
  const devoir = await db.devoir.findFirst({
    where: { id: devoirId, ...(classeId && { enseignement: { classeId } }) },
    select: {
      id: true,
      pourLe: true,
      enseignement: { select: { classeId: true, enseignantId: true } },
    },
  });
  if (!devoir) throw new ErreurApi(404, 'INTROUVABLE', 'Devoir introuvable');
  return devoir;
}

/** Résumé d'une copie, pour l'élève, le parent et l'enseignant. */
export const resumeRendu = (rendu, pourLe) =>
  rendu && {
    id: rendu.id,
    rendLe: rendu.rendLe,
    enRetard: jour(rendu.rendLe) > jour(pourLe),
    pages: rendu.fichiers?.length ?? rendu._count?.fichiers ?? 0,
    commentaire: rendu.commentaire,
    vuLe: rendu.vuLe,
    appreciation: rendu.appreciation,
  };

/** L'élève rend (ou remplace) sa copie. `fichiers` : fichiers multer, dans l'ordre des pages. */
export async function rendreCopie(db, { eleveId, classeId, devoirId, commentaire, fichiers }) {
  const devoir = await devoirDeLaClasse(db, devoirId, classeId);
  if (!fichiers?.length) {
    throw new ErreurApi(
      400,
      'FICHIER_REQUIS',
      'Joignez au moins une photo ou un PDF de votre copie',
    );
  }
  if (fichiers.length > PAGES_MAX) {
    throw new ErreurApi(400, 'TROP_DE_PAGES', `${PAGES_MAX} pages au plus`);
  }
  const formats = fichiers.map((f) => detecterTypeFichier(f.buffer));
  const refus = fichiers.find((_, i) => !formats[i]);
  if (refus) {
    throw new ErreurApi(
      400,
      'FICHIER_INVALIDE',
      'Seuls les photos (JPEG, PNG) et les PDF sont acceptés',
      {
        fichier: refus.originalname,
      },
    );
  }

  // Écriture des nouveaux fichiers d'abord : en cas d'échec, l'ancienne copie reste intacte
  const nouveaux = [];
  try {
    for (const [i, f] of fichiers.entries()) {
      const contenu = f.buffer;
      nouveaux.push({
        ordre: i + 1,
        nomFichier: basename(f.originalname || `page-${i + 1}.${formats[i].extension}`).slice(
          0,
          255,
        ),
        cheminFichier: await enregistrerFichier(
          `rendus/${devoirId}`,
          contenu,
          formats[i].extension,
        ),
        typeMime: formats[i].typeMime,
        tailleOctets: contenu.length,
        empreinteSha256: empreinteSha256(contenu),
      });
    }
  } catch (erreur) {
    await supprimerFichiers(nouveaux.map((f) => f.cheminFichier));
    throw erreur;
  }

  const ancien = await db.renduDevoir.findUnique({
    where: { devoirId_eleveId: { devoirId, eleveId } },
    include: { fichiers: { select: { cheminFichier: true } } },
  });
  const donnees = {
    commentaire: commentaire || null,
    rendLe: new Date(),
    vuLe: null,
    appreciation: null,
  };
  let rendu;
  try {
    if (ancien) {
      await db.renduFichier.deleteMany({ where: { renduId: ancien.id } });
      rendu = await db.renduDevoir.update({ where: { id: ancien.id }, data: donnees });
    } else {
      rendu = await db.renduDevoir.create({ data: { devoirId, eleveId, ...donnees } });
    }
    await db.renduFichier.createMany({ data: nouveaux.map((f) => ({ ...f, renduId: rendu.id })) });
    await db.devoirFait.upsert({
      where: { devoirId_eleveId: { devoirId, eleveId } },
      update: {},
      create: { devoirId, eleveId },
    });
  } catch (erreur) {
    await supprimerFichiers(nouveaux.map((f) => f.cheminFichier));
    throw erreur;
  }
  if (ancien) await supprimerFichiers(ancien.fichiers.map((f) => f.cheminFichier));
  return { rendu: resumeRendu({ ...rendu, fichiers: nouveaux }, devoir.pourLe) };
}

/** Pages d'une copie (lecture par l'élève, son parent ou l'enseignant). */
export async function pagesRendu(db, { devoirId, eleveId }) {
  const rendu = await db.renduDevoir.findUnique({
    where: { devoirId_eleveId: { devoirId, eleveId } },
    include: { fichiers: { orderBy: { ordre: 'asc' } } },
  });
  return rendu;
}

export async function fichierRendu(db, fichierId, { eleveId } = {}) {
  const fichier = await db.renduFichier.findUnique({
    where: { id: fichierId },
    include: { rendu: { select: { eleveId: true } } },
  });
  if (!fichier || (eleveId && fichier.rendu.eleveId !== eleveId)) {
    throw new ErreurApi(404, 'INTROUVABLE', 'Fichier introuvable');
  }
  return {
    document: { typeMime: fichier.typeMime, nomFichier: fichier.nomFichier },
    contenu: await lireFichier(fichier.cheminFichier),
  };
}

// --- Enseignant -------------------------------------------------------------------------

function verifierEnseignant(utilisateur, devoir) {
  if (utilisateur.role === 'ADMIN_ECOLE') return;
  if (devoir.enseignement.enseignantId !== utilisateur.id) {
    throw new ErreurApi(403, 'ACCES_REFUSE', 'Réservé à l’enseignant de la matière');
  }
}

/** Élèves de la classe et leur copie (rendue ou non), pour corriger. */
export async function copiesDuDevoir(db, utilisateur, devoirId) {
  const devoir = await devoirDeLaClasse(db, devoirId);
  verifierEnseignant(utilisateur, devoir);
  const [inscriptions, rendus] = await Promise.all([
    db.inscription.findMany({
      where: { classeId: devoir.enseignement.classeId, statut: 'INSCRIT' },
      select: { eleve: { select: { id: true, nom: true, prenoms: true } } },
      orderBy: [{ eleve: { nom: 'asc' } }, { eleve: { prenoms: 'asc' } }],
    }),
    db.renduDevoir.findMany({
      where: { devoirId },
      include: {
        fichiers: {
          orderBy: { ordre: 'asc' },
          select: { id: true, nomFichier: true, typeMime: true, ordre: true },
        },
      },
    }),
  ]);
  const parEleve = new Map(rendus.map((r) => [r.eleveId, r]));
  return {
    pourLe: jour(devoir.pourLe),
    copies: inscriptions.map(({ eleve }) => {
      const r = parEleve.get(eleve.id);
      return {
        eleve,
        rendu: r ? { ...resumeRendu(r, devoir.pourLe), fichiers: r.fichiers } : null,
      };
    }),
  };
}

export async function apprecierCopie(db, utilisateur, renduId, appreciation) {
  const rendu = await db.renduDevoir.findUnique({
    where: { id: renduId },
    select: { devoirId: true },
  });
  if (!rendu) throw new ErreurApi(404, 'INTROUVABLE', 'Copie introuvable');
  verifierEnseignant(utilisateur, await devoirDeLaClasse(db, rendu.devoirId));
  await db.renduDevoir.update({
    where: { id: renduId },
    data: { appreciation: appreciation || null, vuLe: new Date() },
  });
  return { vu: true };
}

/** Fichier d'une copie, pour l'enseignant de la matière. */
export async function fichierCopiePourEnseignant(db, utilisateur, fichierId) {
  const fichier = await db.renduFichier.findUnique({
    where: { id: fichierId },
    include: { rendu: { select: { devoirId: true } } },
  });
  if (!fichier) throw new ErreurApi(404, 'INTROUVABLE', 'Fichier introuvable');
  verifierEnseignant(utilisateur, await devoirDeLaClasse(db, fichier.rendu.devoirId));
  return fichierRendu(db, fichierId);
}
