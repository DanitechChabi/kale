// EduCourses : cours en ligne de la 6e à la Terminale, selon le programme en vigueur.
//
// Le catalogue (programmes, chapitres, leçons) est national : il n'appartient à
// aucun établissement et se lit avec le client global (exception documentée dans
// CLAUDE.md). Chaque apprenant suivi a un « profil » rattaché à un compte :
// - un élève EduRelevé a un profil automatique, tenu à jour depuis sa classe ;
// - un parent crée des profils pour ses enfants (scolarisés dans n'importe quelle
//   école, ou reliés à un élève EduRelevé : la classe est alors lue avec le client
//   isolé de l'école de l'enfant, après contrôle du lien).
// La bonne réponse des quiz ne quitte jamais le serveur : la correction se fait ici.
import { config } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { prismaPourEcole } from '../../db/isolation.js';
import { ErreurApi } from '../../middlewares/erreurs.js';
import { hacherMotDePasse } from '../../utils/motDePasse.js';
import { accesEnfant, inscriptionActuelle } from '../suivi/serviceSuivi.js';

export const NIVEAUX = [
  'SIXIEME',
  'CINQUIEME',
  'QUATRIEME',
  'TROISIEME',
  'SECONDE',
  'PREMIERE',
  'TERMINALE',
];
export const SECOND_CYCLE = new Set(['SECONDE', 'PREMIERE', 'TERMINALE']);
const PROFILS_MAX = 8;

// Offre payante (EDUCOURSES_PAYANT) ; modifiable uniquement par les tests
let offrePayante = config.EDUCOURSES_PAYANT;
export const definirOffrePayante = (payant) => {
  offrePayante = payant;
};

const introuvable = (quoi = 'Leçon introuvable') => new ErreurApi(404, 'INTROUVABLE', quoi);

// --- Catalogue ---------------------------------------------------------------------------

/** Programmes d'un niveau (et d'une série au second cycle). */
const filtreProgrammes = ({ niveau, serie }) => ({
  niveau,
  ...(SECOND_CYCLE.has(niveau) && serie && { series: { has: serie } }),
});

async function resumesProgrammes(where) {
  const programmes = await prisma.ecProgramme.findMany({
    where,
    orderBy: [{ ordre: 'asc' }],
    select: {
      id: true,
      niveau: true,
      series: true,
      matiereCode: true,
      nomMatiere: true,
      confiance: true,
      chapitres: { select: { lecons: { select: { id: true, redigeeLe: true } } } },
    },
  });
  return programmes.map(({ chapitres, ...p }) => {
    const lecons = chapitres.flatMap((c) => c.lecons);
    return {
      ...p,
      chapitres: chapitres.length,
      lecons: lecons.length,
      redigees: lecons.filter((l) => l.redigeeLe).length,
      _idsLecons: lecons.map((l) => l.id),
    };
  });
}

const sansInterne = ({ _idsLecons, ...p }) => p;

/** Catalogue public : matières par niveau, avec l'avancement de la rédaction. */
export async function catalogue() {
  const [programmes, series] = await Promise.all([
    resumesProgrammes({}),
    prisma.serie.findMany({ select: { code: true, libelle: true }, orderBy: { code: 'asc' } }),
  ]);
  return {
    payant: offrePayante,
    series,
    niveaux: NIVEAUX.map((niveau) => ({
      niveau,
      programmes: programmes.filter((p) => p.niveau === niveau).map(sansInterne),
    })),
  };
}

/** Accès à une leçon : libre tant que l'offre est gratuite, puis 1re leçon de chaque chapitre. */
async function accesLibre(titulaireId, ordreLecon) {
  if (!offrePayante || ordreLecon === 1) return true;
  if (!titulaireId) return false;
  const maintenant = new Date();
  const abonnement = await prisma.ecAbonnement.findFirst({
    where: {
      titulaireId,
      statut: 'ACTIF',
      debut: { lte: maintenant },
      fin: { gt: maintenant },
    },
    select: { id: true },
  });
  return Boolean(abonnement);
}

const presenterProgression = (p) =>
  p && {
    terminee: Boolean(p.termineeLe),
    termineeLe: p.termineeLe,
    meilleurScore: p.meilleurScore,
    dernierScore: p.dernierScore,
    tentatives: p.tentatives,
  };

/** Plan d'un programme ; avec un profil, l'avancement de chaque leçon. */
export async function planProgramme(programmeId, { profil = null, titulaireId = null } = {}) {
  const programme = await prisma.ecProgramme.findUnique({
    where: { id: programmeId },
    include: {
      chapitres: {
        orderBy: { ordre: 'asc' },
        include: {
          lecons: {
            orderBy: { ordre: 'asc' },
            select: {
              id: true,
              ordre: true,
              titre: true,
              objectifs: true,
              duree: true,
              redigeeLe: true,
              ...(profil && {
                progressions: { where: { profilId: profil.id }, take: 1 },
              }),
            },
          },
        },
      },
    },
  });
  if (!programme) throw introuvable('Programme introuvable');
  const abonne = await accesLibre(titulaireId, 0);
  return {
    programme: {
      id: programme.id,
      niveau: programme.niveau,
      series: programme.series,
      matiereCode: programme.matiereCode,
      nomMatiere: programme.nomMatiere,
      confiance: programme.confiance,
      sources: programme.sources,
      chapitres: programme.chapitres.map((c) => ({
        id: c.id,
        ordre: c.ordre,
        titre: c.titre,
        lecons: c.lecons.map((l) => ({
          id: l.id,
          ordre: l.ordre,
          titre: l.titre,
          objectifs: l.objectifs,
          duree: l.duree,
          redigee: Boolean(l.redigeeLe),
          libre: abonne || l.ordre === 1,
          progression: presenterProgression(l.progressions?.[0] ?? null),
        })),
      })),
    },
  };
}

// --- Profils ------------------------------------------------------------------------------

const premierPrenom = (prenoms) => prenoms.trim().split(/\s+/)[0];

/** Niveau et série d'un élève EduRelevé, d'après sa classe actuelle. */
async function classeEleve(db, eleveId) {
  const inscription = await inscriptionActuelle(db, eleveId);
  if (!inscription) return null;
  const classe = await db.classe.findUnique({
    where: { id: inscription.classe.id },
    select: { nom: true, niveau: true, serie: { select: { code: true } } },
  });
  return {
    classe: classe.nom,
    niveau: classe.niveau,
    serie: SECOND_CYCLE.has(classe.niveau) ? (classe.serie?.code ?? null) : null,
  };
}

const presenterProfil = (p, extra = {}) => ({
  id: p.id,
  prenom: p.prenom,
  niveau: p.niveau,
  serie: p.serie,
  relieAEleve: Boolean(p.eleveId),
  ...extra,
});

/** Profil automatique de l'élève connecté, aligné sur sa classe. */
async function profilEleve(utilisateur) {
  const db = prismaPourEcole(utilisateur.ecoleId);
  const eleve = await db.eleve.findFirst({
    where: { utilisateurId: utilisateur.id },
    select: { id: true, prenoms: true },
  });
  if (!eleve) throw introuvable('Fiche élève introuvable');
  const classe = await classeEleve(db, eleve.id);
  if (!classe) {
    throw new ErreurApi(404, 'SANS_CLASSE', 'Aucune inscription en cours : cours indisponibles');
  }
  const donnees = {
    prenom: premierPrenom(eleve.prenoms),
    niveau: classe.niveau,
    serie: classe.serie,
  };
  const profil = await prisma.ecProfil.upsert({
    where: { titulaireId_eleveId: { titulaireId: utilisateur.id, eleveId: eleve.id } },
    update: donnees,
    create: { titulaireId: utilisateur.id, eleveId: eleve.id, ...donnees },
  });
  return presenterProfil(profil, { classe: classe.classe });
}

/**
 * Profils du compte. Élève : son profil automatique. Parent : ses profils (ceux
 * reliés à un enfant suivent sa classe) et les enfants reliés sans profil, à proposer.
 */
export async function mesProfils(utilisateur) {
  if (utilisateur.role === 'ELEVE')
    return { profils: [await profilEleve(utilisateur)], suggestions: [] };
  if (utilisateur.role !== 'PARENT') return { profils: [], suggestions: [] };

  const profils = await prisma.ecProfil.findMany({
    where: { titulaireId: utilisateur.id },
    orderBy: { creeLe: 'asc' },
  });
  // Client global : liens du parent (compte sans établissement), comme dans serviceSuivi
  const liens = await prisma.lienParentEleve.findMany({
    where: { parentId: utilisateur.id },
    select: { eleveId: true, ecoleId: true, eleve: { select: { prenoms: true } } },
  });
  const resultat = [];
  for (const p of profils) {
    const lien = p.eleveId && liens.find((l) => l.eleveId === p.eleveId);
    const classe = lien && (await classeEleve(prismaPourEcole(lien.ecoleId), lien.eleveId));
    if (classe && (classe.niveau !== p.niveau || classe.serie !== p.serie)) {
      await prisma.ecProfil.update({
        where: { id: p.id },
        data: { niveau: classe.niveau, serie: classe.serie },
      });
      Object.assign(p, { niveau: classe.niveau, serie: classe.serie });
    }
    resultat.push(presenterProfil(p, { classe: classe?.classe ?? null }));
  }
  const suggestions = [];
  for (const lien of liens.filter((l) => !profils.some((p) => p.eleveId === l.eleveId))) {
    const classe = await classeEleve(prismaPourEcole(lien.ecoleId), lien.eleveId);
    if (classe) {
      suggestions.push({
        eleveId: lien.eleveId,
        prenom: premierPrenom(lien.eleve.prenoms),
        ...classe,
      });
    }
  }
  return { profils: resultat, suggestions };
}

/** Profil appartenant au compte connecté (sinon 404, sans rien révéler). */
export async function profilDuCompte(utilisateur, profilId) {
  const profil = await prisma.ecProfil.findFirst({
    where: { id: profilId, titulaireId: utilisateur.id },
  });
  if (!profil) throw introuvable('Profil introuvable');
  return profil;
}

async function verifierSerie(niveau, serie) {
  if (!SECOND_CYCLE.has(niveau)) return null;
  if (!serie) {
    throw new ErreurApi(400, 'SERIE_REQUISE', 'Précisez la série', { champ: 'serie' });
  }
  const existe = await prisma.serie.findUnique({ where: { code: serie }, select: { code: true } });
  if (!existe) throw new ErreurApi(400, 'SERIE_INCONNUE', 'Série inconnue', { champ: 'serie' });
  return serie;
}

/** Le parent crée un profil : libre (prénom, niveau, série) ou relié à un de ses enfants. */
export async function creerProfil(parent, { prenom, niveau, serie, eleveId }) {
  const nombre = await prisma.ecProfil.count({ where: { titulaireId: parent.id } });
  if (nombre >= PROFILS_MAX) {
    throw new ErreurApi(400, 'TROP_DE_PROFILS', `${PROFILS_MAX} profils au plus par compte`);
  }
  let donnees;
  if (eleveId) {
    const { db } = await accesEnfant(parent.id, eleveId);
    const classe = await classeEleve(db, eleveId);
    if (!classe) throw new ErreurApi(404, 'SANS_CLASSE', 'Cet enfant n’a pas de classe en cours');
    const eleve = await db.eleve.findUnique({ where: { id: eleveId }, select: { prenoms: true } });
    donnees = {
      eleveId,
      prenom: prenom ?? premierPrenom(eleve.prenoms),
      niveau: classe.niveau,
      serie: classe.serie,
    };
    const existant = await prisma.ecProfil.findUnique({
      where: { titulaireId_eleveId: { titulaireId: parent.id, eleveId } },
    });
    if (existant) return { profil: presenterProfil(existant, { classe: classe.classe }) };
  } else {
    donnees = { prenom, niveau, serie: await verifierSerie(niveau, serie) };
  }
  const profil = await prisma.ecProfil.create({ data: { titulaireId: parent.id, ...donnees } });
  return { profil: presenterProfil(profil) };
}

export async function modifierProfil(parent, profilId, { prenom, niveau, serie }) {
  const profil = await profilDuCompte(parent, profilId);
  const data = { ...(prenom && { prenom }) };
  if (niveau) {
    if (profil.eleveId) {
      throw new ErreurApi(400, 'PROFIL_RELIE', 'Le niveau suit la classe de l’élève');
    }
    data.niveau = niveau;
    data.serie = await verifierSerie(niveau, serie);
  }
  const maj = await prisma.ecProfil.update({ where: { id: profil.id }, data });
  return { profil: presenterProfil(maj) };
}

export async function supprimerProfil(parent, profilId) {
  const profil = await profilDuCompte(parent, profilId);
  await prisma.ecProfil.delete({ where: { id: profil.id } }); // progressions en cascade
  return { supprime: true };
}

/** Matières du profil avec son avancement, et ses dernières leçons travaillées. */
export async function tableauProfil(utilisateur, profilId) {
  const profil = await profilDuCompte(utilisateur, profilId);
  const [programmes, progressions] = await Promise.all([
    resumesProgrammes(filtreProgrammes(profil)),
    prisma.ecProgression.findMany({
      where: { profilId: profil.id },
      orderBy: { majLe: 'desc' },
      select: {
        leconId: true,
        termineeLe: true,
        meilleurScore: true,
        majLe: true,
        lecon: {
          select: {
            titre: true,
            chapitre: { select: { programme: { select: { id: true, nomMatiere: true } } } },
          },
        },
      },
    }),
  ]);
  const parLecon = new Map(progressions.map((p) => [p.leconId, p]));
  return {
    profil: presenterProfil(profil),
    programmes: programmes.map((p) => {
      const faites = p._idsLecons.map((id) => parLecon.get(id)).filter(Boolean);
      const scores = faites.map((f) => f.meilleurScore).filter((s) => s !== null);
      return {
        ...sansInterne(p),
        terminees: faites.filter((f) => f.termineeLe).length,
        scoreMoyen: scores.length
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null,
      };
    }),
    activite: progressions.slice(0, 8).map((p) => ({
      leconId: p.leconId,
      titre: p.lecon.titre,
      programmeId: p.lecon.chapitre.programme.id,
      matiere: p.lecon.chapitre.programme.nomMatiere,
      terminee: Boolean(p.termineeLe),
      meilleurScore: p.meilleurScore,
      le: p.majLe,
    })),
  };
}

// --- Leçons ---------------------------------------------------------------------------------

async function chargerLecon(leconId) {
  const lecon = await prisma.ecLecon.findUnique({
    where: { id: leconId },
    include: {
      chapitre: {
        select: {
          ordre: true,
          titre: true,
          programme: {
            select: { id: true, niveau: true, series: true, nomMatiere: true, matiereCode: true },
          },
        },
      },
    },
  });
  if (!lecon) throw introuvable();
  return lecon;
}

/** Leçons voisines dans l'ordre du programme (chapitre puis leçon). */
async function voisines(lecon) {
  const toutes = await prisma.ecLecon.findMany({
    where: { chapitre: { programmeId: lecon.chapitre.programme.id } },
    orderBy: [{ chapitre: { ordre: 'asc' } }, { ordre: 'asc' }],
    select: { id: true, titre: true },
  });
  const i = toutes.findIndex((l) => l.id === lecon.id);
  return { precedente: toutes[i - 1] ?? null, suivante: toutes[i + 1] ?? null };
}

/**
 * Leçon complète pour l'apprenant : cours, exercices (avec corrigés, affichés à la
 * demande), quiz SANS la bonne réponse, et l'avancement du profil s'il est donné.
 */
export async function lireLecon(utilisateur, leconId, profilId) {
  const lecon = await chargerLecon(leconId);
  const profil = profilId ? await profilDuCompte(utilisateur, profilId) : null;
  const libre = await accesLibre(utilisateur.id, lecon.ordre);
  const progression = profil
    ? await prisma.ecProgression.findUnique({
        where: { profilId_leconId: { profilId: profil.id, leconId: lecon.id } },
      })
    : null;
  const entete = {
    id: lecon.id,
    titre: lecon.titre,
    objectifs: lecon.objectifs,
    duree: lecon.duree,
    chapitre: { ordre: lecon.chapitre.ordre, titre: lecon.chapitre.titre },
    programme: lecon.chapitre.programme,
    redigee: Boolean(lecon.redigeeLe),
    libre,
    ...(await voisines(lecon)),
  };
  if (!libre || !lecon.redigeeLe) {
    return { lecon: { ...entete, contenuHtml: null, exercices: [], quiz: [] }, progression: null };
  }
  return {
    lecon: {
      ...entete,
      contenuHtml: lecon.contenuHtml,
      exercices: lecon.exercices ?? [],
      quiz: (lecon.quiz ?? []).map(({ question, choix }) => ({ question, choix })),
    },
    progression: presenterProgression(progression),
  };
}

async function leconAccessible(utilisateur, leconId) {
  const lecon = await chargerLecon(leconId);
  if (!lecon.redigeeLe) throw new ErreurApi(409, 'LECON_NON_REDIGEE', 'Leçon pas encore rédigée');
  if (!(await accesLibre(utilisateur.id, lecon.ordre))) {
    throw new ErreurApi(402, 'ABONNEMENT_REQUIS', 'Leçon réservée aux abonnés EduCourses');
  }
  return lecon;
}

/** Corrige le quiz ; avec un profil, enregistre le score (dernier et meilleur). */
export async function corrigerQuiz(utilisateur, leconId, { profilId, reponses }) {
  const lecon = await leconAccessible(utilisateur, leconId);
  const quiz = lecon.quiz ?? [];
  if (reponses.length !== quiz.length) {
    throw new ErreurApi(400, 'REPONSES_INCOMPLETES', 'Répondez à toutes les questions');
  }
  const corrections = quiz.map((q, i) => ({
    bonne: q.bonne,
    juste: reponses[i] === q.bonne,
    explication: q.explication,
  }));
  const score = Math.round((100 * corrections.filter((c) => c.juste).length) / quiz.length);
  let progression = null;
  if (profilId) {
    const profil = await profilDuCompte(utilisateur, profilId);
    const cle = { profilId_leconId: { profilId: profil.id, leconId } };
    const avant = await prisma.ecProgression.findUnique({ where: cle });
    progression = await prisma.ecProgression.upsert({
      where: cle,
      update: {
        dernierScore: score,
        meilleurScore: Math.max(score, avant?.meilleurScore ?? 0),
        tentatives: { increment: 1 },
      },
      create: {
        profilId: profil.id,
        leconId,
        dernierScore: score,
        meilleurScore: score,
        tentatives: 1,
      },
    });
  }
  return { score, corrections, progression: presenterProgression(progression) };
}

/** « J'ai terminé » (ou annulation) : rejouable sans effet de bord. */
export async function marquerTerminee(utilisateur, leconId, { profilId, terminee }) {
  await leconAccessible(utilisateur, leconId);
  const profil = await profilDuCompte(utilisateur, profilId);
  const cle = { profilId_leconId: { profilId: profil.id, leconId } };
  const avant = await prisma.ecProgression.findUnique({ where: cle });
  const termineeLe = terminee ? (avant?.termineeLe ?? new Date()) : null;
  const progression = await prisma.ecProgression.upsert({
    where: cle,
    update: { termineeLe },
    create: { profilId: profil.id, leconId, termineeLe },
  });
  return { progression: presenterProgression(progression) };
}

// --- Compte EduCourses ----------------------------------------------------------------------

/**
 * Ouverture d'un compte « parent » EduCourses, sans enfant scolarisé sur EduRelevé.
 * Client global : unicité nationale du numéro de téléphone (exception documentée).
 */
export async function ouvrirCompte({ nom, prenoms, telephone, motDePasse }) {
  const existant = await prisma.utilisateur.findUnique({
    where: { telephone },
    select: { id: true },
  });
  if (existant) {
    throw new ErreurApi(
      409,
      'IDENTIFIANT_DEJA_UTILISE',
      'Ce numéro a déjà un compte EduRelevé : connectez-vous avec lui',
    );
  }
  await prisma.utilisateur.create({
    data: {
      role: 'PARENT',
      nom: nom.toUpperCase(),
      prenoms,
      telephone,
      motDePasseHash: await hacherMotDePasse(motDePasse),
      doitChangerMotDePasse: false,
    },
  });
  return { cree: true };
}
