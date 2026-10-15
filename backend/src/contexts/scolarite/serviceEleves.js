// Élèves (fiches) et inscriptions dans les classes.
import { ErreurApi } from '../../middlewares/erreurs.js';
import { identifiantEleveLibre } from '../../utils/identifiantEleve.js';
import { anneeCourante } from './serviceAnnees.js';

/** Prochain matricule libre « AAAA-0001 » pour l'année de début donnée. */
export async function prochainsMatricules(db, anneeDebut, nombre = 1) {
  const prefixe = `${anneeDebut}-`;
  const existants = await db.eleve.findMany({
    where: { matricule: { startsWith: prefixe } },
    select: { matricule: true },
  });
  let max = existants.reduce((m, { matricule }) => {
    const n = Number(matricule.slice(prefixe.length));
    return Number.isInteger(n) && n > m ? n : m;
  }, 0);
  return Array.from({ length: nombre }, () => `${prefixe}${String(++max).padStart(4, '0')}`);
}

export const anneeDebut = (annee) => annee.libelle.slice(0, 4);

const SELECTION_LISTE = {
  id: true,
  identifiant: true,
  matricule: true,
  npi: true,
  nom: true,
  prenoms: true,
  sexe: true,
  dateNaissance: true,
  utilisateurId: true,
};

export async function listerEleves(db, { recherche, classeId, sansClasse, page, parPage }) {
  const annee = await db.anneeScolaire.findFirst({ where: { estCourante: true } });
  const mots = recherche?.split(/\s+/).filter(Boolean) ?? [];
  const where = {
    AND: [
      ...mots.map((mot) => ({
        OR: [
          { nom: { contains: mot, mode: 'insensitive' } },
          { prenoms: { contains: mot, mode: 'insensitive' } },
          { matricule: { contains: mot, mode: 'insensitive' } },
          { identifiant: { contains: mot.replace(/-/g, '').toUpperCase() } },
        ],
      })),
      ...(classeId ? [{ inscriptions: { some: { classeId, statut: 'INSCRIT' } } }] : []),
      ...(sansClasse && annee ? [{ inscriptions: { none: { anneeScolaireId: annee.id } } }] : []),
    ],
  };
  const [total, eleves] = await Promise.all([
    db.eleve.count({ where }),
    db.eleve.findMany({
      where,
      select: {
        ...SELECTION_LISTE,
        inscriptions: {
          where: annee
            ? { anneeScolaireId: annee.id }
            : { id: '00000000-0000-0000-0000-000000000000' },
          select: { id: true, statut: true, classe: { select: { id: true, nom: true } } },
        },
      },
      orderBy: [{ nom: 'asc' }, { prenoms: 'asc' }],
      skip: (page - 1) * parPage,
      take: parPage,
    }),
  ]);
  return {
    total,
    page,
    parPage,
    eleves: eleves.map(({ inscriptions, ...e }) => ({
      ...e,
      inscription: inscriptions[0] ?? null,
    })),
  };
}

async function verifierClasseCourante(db, classeId) {
  const classe = await db.classe.findUnique({
    where: { id: classeId },
    include: { anneeScolaire: true },
  });
  if (!classe) throw new ErreurApi(404, 'INTROUVABLE', 'Classe introuvable');
  return classe;
}

export async function creerEleve(db, { classeId, matricule, ...donnees }) {
  const classe = classeId ? await verifierClasseCourante(db, classeId) : null;
  const annee = classe?.anneeScolaire ?? (await anneeCourante(db));
  const identifiant = await identifiantEleveLibre(db);
  const [matriculeAuto] = matricule
    ? [matricule]
    : await prochainsMatricules(db, anneeDebut(annee));

  return db.$transaction(async (tx) => {
    const eleve = await tx.eleve.create({
      data: { ...donnees, identifiant, matricule: matriculeAuto },
    });
    if (classe) {
      await tx.inscription.create({
        data: { eleveId: eleve.id, classeId: classe.id, anneeScolaireId: classe.anneeScolaireId },
      });
    }
    return lireEleve(tx, eleve.id);
  });
}

export async function lireEleve(db, id) {
  const eleve = await db.eleve.findUnique({
    where: { id },
    include: {
      inscriptions: {
        include: {
          classe: { select: { id: true, nom: true } },
          anneeScolaire: { select: { id: true, libelle: true, estCourante: true } },
        },
        orderBy: { anneeScolaire: { dateDebut: 'desc' } },
      },
      parents: {
        include: {
          parent: { select: { id: true, nom: true, prenoms: true, telephone: true, email: true } },
        },
      },
      utilisateur: {
        select: { id: true, actif: true, doitChangerMotDePasse: true, derniereConnexionLe: true },
      },
    },
  });
  if (!eleve) throw new ErreurApi(404, 'INTROUVABLE', 'Élève introuvable');
  return eleve;
}

export async function modifierEleve(db, id, donnees) {
  await db.eleve.update({ where: { id }, data: donnees });
  return lireEleve(db, id);
}

/** Suppression d'une fiche saisie par erreur (impossible dès qu'elle a un historique). */
export async function supprimerEleve(db, id) {
  const eleve = await db.eleve.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          notes: true,
          presences: true,
          relevesArchives: true,
          demandesDuplicata: true,
          parents: true,
        },
      },
    },
  });
  if (!eleve) throw new ErreurApi(404, 'INTROUVABLE', 'Élève introuvable');
  const c = eleve._count;
  if (
    c.notes ||
    c.presences ||
    c.relevesArchives ||
    c.demandesDuplicata ||
    c.parents ||
    eleve.utilisateurId
  ) {
    throw new ErreurApi(
      409,
      'ELEVE_UTILISE',
      'Cet élève a déjà un historique (notes, présences, compte ou parents) : sa fiche ne peut pas être supprimée',
    );
  }
  await db.$transaction(async (tx) => {
    const inscriptions = await tx.inscription.findMany({
      where: { eleveId: id },
      select: { id: true },
    });
    await tx.choixOption.deleteMany({
      where: { inscriptionId: { in: inscriptions.map((i) => i.id) } },
    });
    await tx.inscription.deleteMany({ where: { eleveId: id } });
    await tx.eleve.delete({ where: { id } });
  });
}

// --- Inscriptions -------------------------------------------------------------

export async function inscrire(db, { eleveId, classeId, redoublant }) {
  const [eleve, classe] = await Promise.all([
    db.eleve.findUnique({ where: { id: eleveId } }),
    verifierClasseCourante(db, classeId),
  ]);
  if (!eleve) throw new ErreurApi(404, 'INTROUVABLE', 'Élève introuvable');
  const existante = await db.inscription.findFirst({
    where: { eleveId, anneeScolaireId: classe.anneeScolaireId },
    include: { classe: { select: { nom: true } } },
  });
  if (existante) {
    throw new ErreurApi(
      409,
      'DEJA_INSCRIT',
      `Élève déjà inscrit en ${existante.classe.nom} cette année : changez plutôt sa classe`,
    );
  }
  return db.inscription.create({
    data: {
      eleveId,
      classeId,
      anneeScolaireId: classe.anneeScolaireId,
      redoublant: redoublant ?? false,
    },
    include: { classe: { select: { id: true, nom: true } } },
  });
}

export async function modifierInscription(db, id, { classeId, statut, redoublant }) {
  const inscription = await db.inscription.findUnique({ where: { id } });
  if (!inscription) throw new ErreurApi(404, 'INTROUVABLE', 'Inscription introuvable');
  if (classeId) {
    const classe = await verifierClasseCourante(db, classeId);
    if (classe.anneeScolaireId !== inscription.anneeScolaireId) {
      throw new ErreurApi(
        400,
        'ANNEE_DIFFERENTE',
        'La nouvelle classe doit être de la même année scolaire',
      );
    }
  }
  return db.inscription.update({
    where: { id },
    data: { classeId, statut, redoublant },
    include: { classe: { select: { id: true, nom: true } } },
  });
}
