// Comptes créés par l'établissement (« inscription par l'école ») et par
// l'administrateur de la plateforme. Chaque compte reçoit un mot de passe
// temporaire, affiché une seule fois, à changer à la première connexion.
import { prisma } from '../../config/prisma.js';
import { ErreurApi } from '../../middlewares/erreurs.js';
import { genererMotDePasseTemporaire, hacherMotDePasse } from '../../utils/motDePasse.js';
import { journaliser } from '../audit/journal.js';
import { revoquerSessions } from '../auth/serviceAuth.js';

/** Rôles qu'un compte d'établissement peut créer */
export const ROLES_CREABLES = {
  ADMIN_ECOLE: ['ADMIN_ECOLE', 'SECRETARIAT', 'ENSEIGNANT', 'ELEVE', 'PARENT'],
  SECRETARIAT: ['ELEVE', 'PARENT'],
};

const SELECTION_PUBLIQUE = {
  id: true,
  role: true,
  nom: true,
  prenoms: true,
  email: true,
  telephone: true,
  actif: true,
  doitChangerMotDePasse: true,
  derniereConnexionLe: true,
  creeLe: true,
};

async function verifierIdentifiantsLibres({ email, telephone }, client = prisma) {
  const existant = await client.utilisateur.findFirst({
    where: { OR: [...(email ? [{ email }] : []), ...(telephone ? [{ telephone }] : [])] },
  });
  if (existant) {
    throw new ErreurApi(
      409,
      'IDENTIFIANT_DEJA_UTILISE',
      'Ce numéro de téléphone ou cet e-mail est déjà associé à un compte',
    );
  }
}

/**
 * Crée un compte dans l'établissement de l'auteur.
 * - ELEVE : rattaché à une fiche élève de l'établissement qui n'a pas encore de compte.
 * - PARENT : sans établissement ; relié à un ou plusieurs élèves de l'établissement.
 *   Si un compte parent existe déjà avec ce téléphone ou cet e-mail, il est
 *   simplement relié aux élèves (un parent peut avoir des enfants dans plusieurs écoles).
 */
export async function creerCompteEcole(db, auteur, donnees) {
  const { role } = donnees;
  if (!ROLES_CREABLES[auteur.role]?.includes(role)) {
    throw new ErreurApi(403, 'ACCES_REFUSE', 'Vous ne pouvez pas créer ce type de compte');
  }
  const contexte = { utilisateurId: auteur.id, adresseIp: auteur.adresseIp };

  if (role === 'PARENT') return creerOuRelierParent(db, auteur, donnees, contexte);

  let eleve = null;
  if (role === 'ELEVE') {
    eleve = await db.eleve.findUnique({ where: { id: donnees.eleveId } });
    if (!eleve)
      throw new ErreurApi(404, 'ELEVE_INTROUVABLE', 'Élève introuvable dans votre établissement');
    if (eleve.utilisateurId)
      throw new ErreurApi(409, 'COMPTE_EXISTANT', 'Cet élève a déjà un compte');
  }

  await verifierIdentifiantsLibres(donnees);
  const motDePasseTemporaire = genererMotDePasseTemporaire();
  const compte = await db.utilisateur.create({
    data: {
      role,
      nom: (donnees.nom ?? eleve?.nom ?? '').toUpperCase(),
      prenoms: donnees.prenoms ?? eleve?.prenoms,
      email: donnees.email ?? null,
      telephone: donnees.telephone ?? null,
      motDePasseHash: await hacherMotDePasse(motDePasseTemporaire),
    },
    select: SELECTION_PUBLIQUE,
  });
  if (eleve) {
    await db.eleve.update({ where: { id: eleve.id }, data: { utilisateurId: compte.id } });
    compte.identifiantEleve = eleve.identifiant;
  }
  await journaliser(db, {
    ...contexte,
    action: 'CREATION',
    entite: 'Utilisateur',
    entiteId: compte.id,
    apres: { role, nom: compte.nom, prenoms: compte.prenoms },
  });
  return { compte, motDePasseTemporaire };
}

async function creerOuRelierParent(db, auteur, donnees, contexte) {
  const enfants = donnees.enfants ?? [];
  if (!enfants.length) {
    throw new ErreurApi(400, 'ENFANT_REQUIS', 'Indiquez au moins un élève rattaché à ce parent');
  }
  const eleves = await db.eleve.findMany({ where: { id: { in: enfants.map((e) => e.eleveId) } } });
  if (eleves.length !== new Set(enfants.map((e) => e.eleveId)).size) {
    throw new ErreurApi(404, 'ELEVE_INTROUVABLE', 'Élève introuvable dans votre établissement');
  }

  // Un parent n'a pas d'établissement : recherche sur l'ensemble des comptes
  const existant = await prisma.utilisateur.findFirst({
    where: {
      OR: [
        ...(donnees.email ? [{ email: donnees.email }] : []),
        ...(donnees.telephone ? [{ telephone: donnees.telephone }] : []),
      ],
    },
  });
  if (existant && existant.role !== 'PARENT') {
    throw new ErreurApi(
      409,
      'IDENTIFIANT_DEJA_UTILISE',
      'Cet identifiant appartient à un autre type de compte',
    );
  }

  let motDePasseTemporaire = null;
  let parent = existant;
  if (!parent) {
    motDePasseTemporaire = genererMotDePasseTemporaire();
    parent = await prisma.utilisateur.create({
      data: {
        role: 'PARENT',
        nom: donnees.nom.toUpperCase(),
        prenoms: donnees.prenoms,
        email: donnees.email ?? null,
        telephone: donnees.telephone ?? null,
        motDePasseHash: await hacherMotDePasse(motDePasseTemporaire),
      },
    });
    await journaliser(db, {
      ...contexte,
      action: 'CREATION',
      entite: 'Utilisateur',
      entiteId: parent.id,
      apres: { role: 'PARENT', nom: parent.nom, prenoms: parent.prenoms },
    });
  }

  for (const { eleveId, lien } of enfants) {
    await db.lienParentEleve.upsert({
      where: { parentId_eleveId: { parentId: parent.id, eleveId } },
      update: { lien },
      create: { parentId: parent.id, eleveId, lien },
    });
  }

  const compte = await prisma.utilisateur.findUnique({
    where: { id: parent.id },
    select: SELECTION_PUBLIQUE,
  });
  return { compte, motDePasseTemporaire, compteExistant: Boolean(existant) };
}

/**
 * Crée d'un coup les comptes de tous les élèves d'une classe qui n'en ont pas.
 * Renvoie les fiches de connexion à imprimer (identifiant + mot de passe temporaire).
 */
export async function creerComptesClasse(db, auteur, classeId) {
  const classe = await db.classe.findUnique({
    where: { id: classeId },
    include: {
      inscriptions: {
        where: { statut: 'INSCRIT', eleve: { utilisateurId: null } },
        include: { eleve: true },
        orderBy: [{ eleve: { nom: 'asc' } }, { eleve: { prenoms: 'asc' } }],
      },
    },
  });
  if (!classe) throw new ErreurApi(404, 'INTROUVABLE', 'Classe introuvable');

  const fiches = [];
  // Par petits lots : le hachage des mots de passe est volontairement coûteux
  for (let i = 0; i < classe.inscriptions.length; i += 8) {
    const lot = classe.inscriptions.slice(i, i + 8);
    fiches.push(
      ...(await Promise.all(
        lot.map(async ({ eleve }) => {
          const motDePasseTemporaire = genererMotDePasseTemporaire();
          return {
            eleve,
            motDePasseTemporaire,
            hache: await hacherMotDePasse(motDePasseTemporaire),
          };
        }),
      )),
    );
  }

  await db.$transaction(async (tx) => {
    for (const fiche of fiches) {
      const compte = await tx.utilisateur.create({
        data: {
          role: 'ELEVE',
          nom: fiche.eleve.nom,
          prenoms: fiche.eleve.prenoms,
          motDePasseHash: fiche.hache,
        },
      });
      await tx.eleve.update({ where: { id: fiche.eleve.id }, data: { utilisateurId: compte.id } });
    }
    await journaliser(tx, {
      utilisateurId: auteur.id,
      adresseIp: auteur.adresseIp,
      action: 'CREATION',
      entite: 'Classe',
      entiteId: classeId,
      apres: { comptesEleves: fiches.length },
    });
  });

  return {
    classe: { id: classe.id, nom: classe.nom },
    fiches: fiches.map(({ eleve, motDePasseTemporaire }) => ({
      eleveId: eleve.id,
      nom: eleve.nom,
      prenoms: eleve.prenoms,
      identifiant: eleve.identifiant,
      motDePasseTemporaire,
    })),
  };
}

/** Comptes de l'établissement, et parents de ses élèves. */
export async function listerComptes(db, ecoleId, { role }) {
  if (role === 'PARENT') {
    return prisma.utilisateur.findMany({
      where: { role: 'PARENT', enfants: { some: { ecoleId } } },
      select: SELECTION_PUBLIQUE,
      orderBy: [{ nom: 'asc' }, { prenoms: 'asc' }],
    });
  }
  return db.utilisateur.findMany({
    where: role ? { role } : {},
    select: SELECTION_PUBLIQUE,
    orderBy: [{ role: 'asc' }, { nom: 'asc' }, { prenoms: 'asc' }],
  });
}

/** Compte géré par l'établissement : ses propres comptes, ou un parent de ses élèves. */
async function trouverCompteGere(db, ecoleId, id) {
  const compte =
    (await db.utilisateur.findUnique({ where: { id } })) ??
    (await prisma.utilisateur.findFirst({
      where: { id, role: 'PARENT', enfants: { some: { ecoleId } } },
    }));
  if (!compte) throw new ErreurApi(404, 'INTROUVABLE', 'Compte introuvable');
  return compte;
}

export async function changerStatutCompte(db, auteur, id, actif) {
  if (id === auteur.id) {
    throw new ErreurApi(
      400,
      'ACTION_IMPOSSIBLE',
      'Vous ne pouvez pas désactiver votre propre compte',
    );
  }
  const compte = await trouverCompteGere(db, auteur.ecoleId, id);
  if (compte.role === 'PARENT') {
    throw new ErreurApi(
      403,
      'ACCES_REFUSE',
      'Un compte parent peut concerner plusieurs établissements : contactez l’administrateur',
    );
  }
  if (!ROLES_CREABLES[auteur.role]?.includes(compte.role)) {
    throw new ErreurApi(403, 'ACCES_REFUSE', 'Vous ne pouvez pas modifier ce compte');
  }
  const misAJour = await db.utilisateur.update({
    where: { id },
    data: { actif },
    select: SELECTION_PUBLIQUE,
  });
  if (!actif) await revoquerSessions(id);
  await journaliser(db, {
    utilisateurId: auteur.id,
    adresseIp: auteur.adresseIp,
    action: 'MODIFICATION',
    entite: 'Utilisateur',
    entiteId: id,
    avant: { actif: compte.actif },
    apres: { actif },
  });
  return misAJour;
}

export async function reinitialiserMotDePasse(db, auteur, id) {
  const compte = await trouverCompteGere(db, auteur.ecoleId, id);
  if (!ROLES_CREABLES[auteur.role]?.includes(compte.role)) {
    throw new ErreurApi(403, 'ACCES_REFUSE', 'Vous ne pouvez pas modifier ce compte');
  }
  const motDePasseTemporaire = genererMotDePasseTemporaire();
  await prisma.utilisateur.update({
    where: { id },
    data: {
      motDePasseHash: await hacherMotDePasse(motDePasseTemporaire),
      doitChangerMotDePasse: true,
    },
  });
  await revoquerSessions(id);
  await journaliser(db, {
    utilisateurId: auteur.id,
    adresseIp: auteur.adresseIp,
    action: 'MODIFICATION',
    entite: 'Utilisateur',
    entiteId: id,
    apres: { motDePasse: 'réinitialisé' },
  });
  return { motDePasseTemporaire };
}

/** Comptes nationaux (ministère, administrateurs), créés par un SUPER_ADMIN. */
export async function creerCompteNational(auteur, donnees) {
  await verifierIdentifiantsLibres(donnees);
  const motDePasseTemporaire = genererMotDePasseTemporaire();
  const compte = await prisma.utilisateur.create({
    data: {
      role: donnees.role,
      nom: donnees.nom.toUpperCase(),
      prenoms: donnees.prenoms,
      email: donnees.email ?? null,
      telephone: donnees.telephone ?? null,
      motDePasseHash: await hacherMotDePasse(motDePasseTemporaire),
    },
    select: SELECTION_PUBLIQUE,
  });
  await journaliser(prisma, {
    utilisateurId: auteur.id,
    adresseIp: auteur.adresseIp,
    action: 'CREATION',
    entite: 'Utilisateur',
    entiteId: compte.id,
    apres: { role: compte.role, nom: compte.nom, prenoms: compte.prenoms },
  });
  return { compte, motDePasseTemporaire };
}
