// Bulletins de période et relevés annuels archivés.
//
// Un document est produit une seule fois, quand la période (ou toute l'année) est
// clôturée : les notes ne peuvent alors plus changer. L'instantané des données,
// le PDF figé et son empreinte SHA-256 sont archivés ; PostgreSQL interdit toute
// modification ou suppression. Une correction (identité mal orthographiée…)
// produit un nouveau document qui référence l'ancien, lequel reste vérifiable
// avec la mention « remplacé ».
import { config } from '../../config/env.js';
import { ErreurApi } from '../../middlewares/erreurs.js';
import { empreinteSha256, enregistrerFichier, lireFichier } from '../../utils/fichiers.js';
import { formaterNumero, genererNumero } from '../../utils/numeroDocument.js';
import { arrondir, classer, moyenneAnnuelle, statistiques, surVingt } from '../notes/calcul.js';
import { resultatsClasse } from '../notes/serviceNotes.js';
import { appreciation, distinction } from './contenu.js';
import { rendrePdf } from './pdf.js';

const VERSION_DONNEES = 1;

// Fonction du signataire, imprimée sur le document
const FONCTIONS = { ADMIN_ECOLE: 'direction', SECRETARIAT: 'secrétariat' };

/** Adresse publique de vérification imprimée sur le document et dans son QR code. */
export const urlVerification = (numero) =>
  `${config.URL_PUBLIQUE_FRONTEND.replace(/\/$/, '')}/verifier/${formaterNumero(numero)}`;

const dateIso = (date) => (date ? new Date(date).toISOString().slice(0, 10) : null);

// --- Chargement du contexte ----------------------------------------------------

async function chargerClasse(db, classeId) {
  const classe = await db.classe.findUnique({
    where: { id: classeId },
    include: {
      serie: { select: { code: true } },
      anneeScolaire: { include: { periodes: { orderBy: { numero: 'asc' } } } },
      enseignements: {
        select: { id: true, enseignant: { select: { nom: true, prenoms: true } } },
      },
    },
  });
  if (!classe) throw new ErreurApi(404, 'INTROUVABLE', 'Classe introuvable');
  return classe;
}

/** Signataire : nom complet de l'utilisateur connecté (absent du jeton). */
const chargerSignataire = (db, utilisateur) =>
  db.utilisateur.findUnique({
    where: { id: utilisateur.id },
    select: { id: true, nom: true, prenoms: true, role: true, ecoleId: true },
  });

async function chargerEtablissement(db, ecoleId) {
  const e = await db.ecole.findUnique({
    where: { id: ecoleId },
    include: { commune: { include: { departement: { select: { nom: true } } } } },
  });
  return {
    nom: e.nom,
    code: e.code,
    type: e.type,
    statut: e.statut,
    commune: e.commune?.nom ?? null,
    departement: e.commune?.departement?.nom ?? null,
    telephone: e.telephone,
    chef: e.nomChefEtablissement,
  };
}

/** Élèves inscrits dans la classe, avec leur fiche complète. */
async function inscritsClasse(db, classeId) {
  const inscriptions = await db.inscription.findMany({
    where: { classeId, statut: 'INSCRIT' },
    include: { eleve: true },
    orderBy: [{ eleve: { nom: 'asc' } }, { eleve: { prenoms: 'asc' } }],
  });
  return inscriptions;
}

async function absencesPeriode(db, eleveIds, debut, fin) {
  const presences = await db.presence.findMany({
    where: {
      eleveId: { in: eleveIds },
      statut: { in: ['ABSENT', 'RETARD'] },
      appel: { date: { gte: debut, lte: fin } },
    },
    select: { eleveId: true, statut: true, justifiee: true },
  });
  const parEleve = new Map();
  for (const p of presences) {
    const a = parEleve.get(p.eleveId) ?? { absences: 0, nonJustifiees: 0, retards: 0 };
    if (p.statut === 'ABSENT') {
      a.absences++;
      if (!p.justifiee) a.nonJustifiees++;
    } else a.retards++;
    parEleve.set(p.eleveId, a);
  }
  return parEleve;
}

const nomEnseignant = (u) => (u ? `${u.prenoms.split(' ')[0][0]}. ${u.nom}` : null);

const identiteEleve = (eleve) => ({
  nom: eleve.nom,
  prenoms: eleve.prenoms,
  sexe: eleve.sexe,
  dateNaissance: dateIso(eleve.dateNaissance),
  lieuNaissance: eleve.lieuNaissance,
  matricule: eleve.matricule,
  identifiant: eleve.identifiant,
  npi: eleve.npi,
});

// --- Instantanés -----------------------------------------------------------------

/** Lignes « matières » d'un bulletin de période pour un élève. */
function matieresBulletin(resultats, eleveId, enseignants) {
  const { evaluations, moyennes } = resultats._interne;
  const ligneEleve = resultats.eleves.find((e) => e.id === eleveId);
  return resultats.enseignements.flatMap((e) => {
    const m = moyennes.get(`${eleveId}|${e.id}`);
    // Matière optionnelle non suivie : absente du bulletin
    if (m.moyenne === null && (e.estFacultative || e.groupeOption)) return [];
    const devoirs = evaluations
      .filter((ev) => ev.enseignementId === e.id && ev.type !== 'INTERROGATION')
      .map((ev) => ev.notes.find((n) => n.eleveId === eleveId))
      .filter((n) => n && !n.absent)
      .map((n) => {
        const ev = evaluations.find((x) => x.id === n.evaluationId);
        return arrondir(surVingt(n.valeur, ev.bareme));
      });
    const points =
      m.moyenne === null
        ? null
        : e.estFacultative
          ? arrondir(Math.max(0, m.moyenne - 10) * e.coefficient)
          : arrondir(m.moyenne * e.coefficient);
    return [
      {
        matiere: e.matiere,
        coefficient: e.coefficient,
        estFacultative: e.estFacultative,
        moyenneInterrogations: m.moyenneInterrogations,
        devoirs,
        moyenne: m.moyenne,
        points,
        rang: ligneEleve.moyennes[e.id].rang,
        appreciation: appreciation(m.moyenne),
        enseignant: nomEnseignant(enseignants.get(e.id)),
      },
    ];
  });
}

function contexteCommun({ etablissement, classe, inscription, generePar }) {
  return {
    version: VERSION_DONNEES,
    etablissement,
    anneeScolaire: classe.anneeScolaire.libelle,
    eleve: identiteEleve(inscription.eleve),
    classe: {
      nom: classe.nom,
      niveau: classe.niveau,
      serie: classe.serie?.code ?? null,
      redoublant: inscription.redoublant,
    },
    delivrance: {
      le: new Date().toISOString(),
      par: `${generePar.prenoms} ${generePar.nom}${
        FONCTIONS[generePar.role] ? ` (${FONCTIONS[generePar.role]})` : ''
      }`,
    },
  };
}

/** Instantanés des bulletins d'une période, pour chaque élève inscrit de la classe. */
async function instantanesBulletins(db, classe, periode, inscriptions, etablissement, generePar) {
  const resultats = await resultatsClasse(db, classe.id, periode.id);
  const enseignants = new Map(classe.enseignements.map((e) => [e.id, e.enseignant]));
  const absences = await absencesPeriode(
    db,
    inscriptions.map((i) => i.eleveId),
    periode.dateDebut,
    periode.dateFin,
  );
  const effectif = inscriptions.length;
  const classes = resultats.eleves.filter((e) => e.rang).length;

  return new Map(
    inscriptions.map((inscription) => {
      const ligne = resultats.eleves.find((e) => e.id === inscription.eleveId);
      const commun = contexteCommun({ etablissement, classe, inscription, generePar });
      return [
        inscription.eleveId,
        {
          ...commun,
          type: 'BULLETIN_PERIODE',
          periode: { type: periode.type, numero: periode.numero },
          classe: { ...commun.classe, effectif },
          matieres: matieresBulletin(resultats, inscription.eleveId, enseignants),
          resultats: {
            totalCoefficients: ligne?.totalCoefficients ?? 0,
            totalPoints: ligne?.totalPoints ?? null,
            moyenneGenerale: ligne?.moyenneGenerale ?? null,
            rang: ligne?.rang ?? null,
            exAequo: ligne?.exAequo ?? false,
            classes,
            moyenneClasse: resultats.statistiques.moyenne,
            plusForte: resultats.statistiques.max,
            plusFaible: resultats.statistiques.min,
            distinction: distinction(ligne?.moyenneGenerale),
          },
          absences: absences.get(inscription.eleveId) ?? null,
        },
      ];
    }),
  );
}

/** Instantanés des relevés annuels : moyennes de chaque période et moyenne annuelle. */
async function instantanesAnnuels(db, classe, inscriptions, etablissement, generePar) {
  const periodes = classe.anneeScolaire.periodes;
  const parPeriode = [];
  for (const p of periodes) parPeriode.push(await resultatsClasse(db, classe.id, p.id));
  const absences = await absencesPeriode(
    db,
    inscriptions.map((i) => i.eleveId),
    classe.anneeScolaire.dateDebut,
    classe.anneeScolaire.dateFin,
  );

  // Matières : celles de la dernière période (même ordre d'affichage)
  const enseignements = parPeriode.at(-1).enseignements;
  const ligne = (r, eleveId) => r.eleves.find((e) => e.id === eleveId);

  const annuels = inscriptions.map((inscription) => {
    const id = inscription.eleveId;
    const moyennesGenerales = parPeriode.map((r) => ligne(r, id)?.moyenneGenerale ?? null);
    const matieres = enseignements.map((e) => {
      const moyennesPeriodes = parPeriode.map((r) => ligne(r, id)?.moyennes[e.id]?.moyenne ?? null);
      return { e, moyennesPeriodes, moyenne: moyenneAnnuelle(moyennesPeriodes) };
    });
    return { id, moyennesGenerales, matieres, moyenne: moyenneAnnuelle(moyennesGenerales) };
  });

  const rangs = classer(annuels.map((a) => ({ id: a.id, moyenne: a.moyenne })));
  const rangsMatieres = new Map(
    enseignements.map((e) => [
      e.id,
      classer(
        annuels.map((a) => ({
          id: a.id,
          moyenne: a.matieres.find((m) => m.e.id === e.id).moyenne,
        })),
      ),
    ]),
  );
  const stats = statistiques(annuels.map((a) => a.moyenne));
  const effectif = inscriptions.length;

  return new Map(
    inscriptions.map((inscription) => {
      const a = annuels.find((x) => x.id === inscription.eleveId);
      const commun = contexteCommun({ etablissement, classe, inscription, generePar });
      const matieres = a.matieres
        .filter((m) => m.moyenne !== null || !(m.e.estFacultative || m.e.groupeOption))
        .map(({ e, moyennesPeriodes, moyenne }) => ({
          matiere: e.matiere,
          coefficient: e.coefficient,
          estFacultative: e.estFacultative,
          moyennesPeriodes,
          moyenne,
          points:
            moyenne === null
              ? null
              : arrondir(
                  e.estFacultative
                    ? Math.max(0, moyenne - 10) * e.coefficient
                    : moyenne * e.coefficient,
                ),
          rang: rangsMatieres.get(e.id).get(a.id)?.rang ?? null,
          appreciation: appreciation(moyenne),
        }));
      const retenues = matieres.filter((m) => !m.estFacultative && m.moyenne !== null);
      return [
        inscription.eleveId,
        {
          ...commun,
          type: 'RELEVE_ANNUEL',
          periode: null,
          periodes: periodes.map((p) => ({ type: p.type, numero: p.numero })),
          classe: { ...commun.classe, effectif },
          matieres,
          resultats: {
            totalCoefficients: retenues.reduce((s, m) => s + m.coefficient, 0),
            totalPoints: arrondir(matieres.reduce((s, m) => s + (m.points ?? 0), 0)),
            moyenneGenerale: a.moyenne,
            rang: rangs.get(a.id)?.rang ?? null,
            exAequo: rangs.get(a.id)?.exAequo ?? false,
            classes: rangs.size,
            moyenneClasse: stats.moyenne,
            plusForte: stats.max,
            plusFaible: stats.min,
            distinction: distinction(a.moyenne),
            periodes: periodes.map((p, i) => {
              const l = ligne(parPeriode[i], a.id);
              return {
                type: p.type,
                numero: p.numero,
                moyenne: a.moyennesGenerales[i],
                rang: l?.rang ?? null,
                exAequo: l?.exAequo ?? false,
              };
            }),
          },
          absences: absences.get(inscription.eleveId) ?? null,
        },
      ];
    }),
  );
}

// --- Archivage -----------------------------------------------------------------

const anneeFin = (classe) => new Date(classe.anneeScolaire.dateFin).getUTCFullYear();

/** Produit le PDF, le stocke et crée l'enregistrement archivé (immuable). */
async function archiver(db, { donnees, eleveId, classe, periodeId, generePar, remplace = null }) {
  const numero = genererNumero(donnees.type === 'BULLETIN_PERIODE' ? 'B' : 'R', anneeFin(classe));
  const complet = {
    ...donnees,
    numero,
    remplace: remplace ? { numero: remplace.numero, motif: remplace.motif } : null,
  };
  const pdf = await rendrePdf(complet, { urlVerification: urlVerification(numero) });
  const cheminFichier = await enregistrerFichier(
    `releves/${generePar.ecoleId}/${classe.anneeScolaire.libelle}`,
    pdf,
    'pdf',
    { nom: numero },
  );
  return db.releveArchive.create({
    data: {
      numero,
      type: donnees.type,
      eleveId,
      anneeScolaireId: classe.anneeScolaireId,
      periodeId,
      cheminFichier,
      empreinteSha256: empreinteSha256(pdf),
      tailleOctets: pdf.length,
      donnees: complet,
      remplaceReleveId: remplace?.id ?? null,
      motifCorrection: remplace?.motif ?? null,
      genereParId: generePar.id,
    },
  });
}

/** Documents en vigueur (non remplacés) d'une classe pour une période ou l'année. */
async function documentsEnVigueur(db, { eleveIds, type, anneeScolaireId, periodeId }) {
  const documents = await db.releveArchive.findMany({
    where: { eleveId: { in: eleveIds }, type, anneeScolaireId, periodeId },
    select: {
      id: true,
      numero: true,
      eleveId: true,
      genereLe: true,
      remplaceReleveId: true,
      motifCorrection: true,
      tailleOctets: true,
    },
    orderBy: { genereLe: 'asc' },
  });
  const remplaces = new Set(documents.map((d) => d.remplaceReleveId).filter(Boolean));
  const parEleve = new Map();
  for (const d of documents) {
    const fiche = parEleve.get(d.eleveId) ?? { courant: null, versions: 0 };
    fiche.versions++;
    if (!remplaces.has(d.id)) fiche.courant = d;
    parEleve.set(d.eleveId, fiche);
  }
  return parEleve;
}

function verifierPeriodes(classe, periodeId) {
  if (periodeId) {
    const periode = classe.anneeScolaire.periodes.find((p) => p.id === periodeId);
    if (!periode) throw new ErreurApi(404, 'INTROUVABLE', 'Période introuvable pour cette classe');
    return { periode, cloturee: periode.estCloturee };
  }
  const periodes = classe.anneeScolaire.periodes;
  return { periode: null, cloturee: periodes.length > 0 && periodes.every((p) => p.estCloturee) };
}

/** État de l'archivage d'une classe : chaque élève et son document en vigueur. */
export async function etatClasse(db, classeId, periodeId) {
  const classe = await chargerClasse(db, classeId);
  const { periode, cloturee } = verifierPeriodes(classe, periodeId);
  const inscriptions = await inscritsClasse(db, classeId);
  const type = periode ? 'BULLETIN_PERIODE' : 'RELEVE_ANNUEL';
  const documents = await documentsEnVigueur(db, {
    eleveIds: inscriptions.map((i) => i.eleveId),
    type,
    anneeScolaireId: classe.anneeScolaireId,
    periodeId: periode?.id ?? null,
  });
  return {
    classe: { id: classe.id, nom: classe.nom },
    type,
    periode: periode && {
      id: periode.id,
      type: periode.type,
      numero: periode.numero,
      estCloturee: periode.estCloturee,
    },
    cloturee,
    eleves: inscriptions.map(({ eleve }) => {
      const fiche = documents.get(eleve.id);
      return {
        id: eleve.id,
        nom: eleve.nom,
        prenoms: eleve.prenoms,
        matricule: eleve.matricule,
        document: fiche?.courant
          ? {
              ...fiche.courant,
              numeroAffiche: formaterNumero(fiche.courant.numero),
              versions: fiche.versions,
            }
          : null,
      };
    }),
  };
}

/**
 * Génère les documents manquants d'une classe (bulletins d'une période clôturée,
 * ou relevés annuels quand toutes les périodes sont clôturées). Rejouable sans
 * doublon : un élève qui a déjà son document est ignoré.
 */
export async function genererClasse(db, utilisateur, { classeId, periodeId = null }) {
  const classe = await chargerClasse(db, classeId);
  const { periode, cloturee } = verifierPeriodes(classe, periodeId);
  if (!cloturee) {
    throw new ErreurApi(
      409,
      'PERIODE_OUVERTE',
      periode
        ? 'La période doit être clôturée avant de délivrer les bulletins'
        : 'Toutes les périodes de l’année doivent être clôturées avant de délivrer les relevés annuels',
    );
  }

  const inscriptions = await inscritsClasse(db, classeId);
  const type = periode ? 'BULLETIN_PERIODE' : 'RELEVE_ANNUEL';
  const existants = await documentsEnVigueur(db, {
    eleveIds: inscriptions.map((i) => i.eleveId),
    type,
    anneeScolaireId: classe.anneeScolaireId,
    periodeId: periode?.id ?? null,
  });
  const aGenerer = inscriptions.filter((i) => !existants.has(i.eleveId));
  if (!aGenerer.length) return { generes: 0, dejaArchives: inscriptions.length };

  const etablissement = await chargerEtablissement(db, utilisateur.ecoleId);
  const signataire = await chargerSignataire(db, utilisateur);
  const instantanes = periode
    ? await instantanesBulletins(db, classe, periode, inscriptions, etablissement, signataire)
    : await instantanesAnnuels(db, classe, inscriptions, etablissement, signataire);

  let generes = 0;
  for (const inscription of aGenerer) {
    try {
      await archiver(db, {
        donnees: instantanes.get(inscription.eleveId),
        eleveId: inscription.eleveId,
        classe,
        periodeId: periode?.id ?? null,
        generePar: signataire,
      });
      generes++;
    } catch (erreur) {
      // Génération simultanée (double clic, deux postes) : l'autre a déjà archivé
      if (erreur.code !== 'P2002') throw erreur;
    }
  }
  return { generes, dejaArchives: inscriptions.length - aGenerer.length };
}

/** Résumé d'un document pour l'espace de l'établissement. */
function resume(document) {
  const d = document.donnees;
  return {
    id: document.id,
    numero: document.numero,
    numeroAffiche: formaterNumero(document.numero),
    type: document.type,
    genereLe: document.genereLe,
    tailleOctets: document.tailleOctets,
    empreinteSha256: document.empreinteSha256,
    anneeScolaire: d.anneeScolaire,
    periode: d.periode,
    classe: d.classe.nom,
    moyenneGenerale: d.resultats.moyenneGenerale,
    rang: d.resultats.rang,
    exAequo: d.resultats.exAequo,
    effectif: d.resultats.classes,
    motifCorrection: document.motifCorrection,
    remplace: document.remplace
      ? { id: document.remplace.id, numero: document.remplace.numero }
      : null,
    remplacePar: document.remplacePar
      ? { id: document.remplacePar.id, numero: document.remplacePar.numero }
      : null,
    urlVerification: urlVerification(document.numero),
  };
}

const AVEC_LIENS = {
  remplace: { select: { id: true, numero: true } },
  remplacePar: { select: { id: true, numero: true } },
};

/** Tous les documents d'un élève (y compris ceux remplacés), du plus récent au plus ancien. */
export async function documentsEleve(db, eleveId) {
  const documents = await db.releveArchive.findMany({
    where: { eleveId },
    include: AVEC_LIENS,
    orderBy: { genereLe: 'desc' },
  });
  return { documents: documents.map(resume) };
}

export async function detailDocument(db, id) {
  const document = await db.releveArchive.findUnique({
    where: { id },
    include: { ...AVEC_LIENS, eleve: { select: { id: true, nom: true, prenoms: true } } },
  });
  if (!document) throw new ErreurApi(404, 'INTROUVABLE', 'Document introuvable');
  return { document: { ...resume(document), eleve: document.eleve } };
}

/** Contenu PDF figé d'un document (contrôle de l'empreinte à chaque lecture). */
export async function contenuDocument(db, id, { eleveId } = {}) {
  const document = await db.releveArchive.findUnique({ where: { id } });
  if (!document || (eleveId && document.eleveId !== eleveId)) {
    throw new ErreurApi(404, 'INTROUVABLE', 'Document introuvable');
  }
  const contenu = await lireFichier(document.cheminFichier);
  if (empreinteSha256(contenu) !== document.empreinteSha256) {
    // Ne jamais servir un fichier altéré sur le support de stockage
    throw new ErreurApi(
      500,
      'ARCHIVE_ALTEREE',
      'Le fichier archivé ne correspond plus à son empreinte',
    );
  }
  return { document, contenu };
}

/**
 * Correction : nouveau document produit avec les données actuelles (identité de
 * l'élève, établissement…) ; les notes, elles, sont figées par la clôture.
 */
export async function corrigerDocument(db, utilisateur, id, motif) {
  const ancien = await db.releveArchive.findUnique({ where: { id }, include: AVEC_LIENS });
  if (!ancien) throw new ErreurApi(404, 'INTROUVABLE', 'Document introuvable');
  if (ancien.remplacePar) {
    throw new ErreurApi(
      409,
      'DEJA_REMPLACE',
      `Ce document a déjà été remplacé par le n° ${formaterNumero(ancien.remplacePar.numero)}`,
    );
  }
  const inscription = await db.inscription.findFirst({
    where: { eleveId: ancien.eleveId, anneeScolaireId: ancien.anneeScolaireId },
    include: { eleve: true },
  });
  if (!inscription)
    throw new ErreurApi(409, 'INSCRIPTION_ABSENTE', 'Inscription de l’élève introuvable');
  const classe = await chargerClasse(db, inscription.classeId);
  const etablissement = await chargerEtablissement(db, utilisateur.ecoleId);
  const signataire = await chargerSignataire(db, utilisateur);
  const inscriptions = await inscritsClasse(db, classe.id);
  const periode = ancien.periodeId
    ? classe.anneeScolaire.periodes.find((p) => p.id === ancien.periodeId)
    : null;
  const instantanes = periode
    ? await instantanesBulletins(db, classe, periode, inscriptions, etablissement, signataire)
    : await instantanesAnnuels(db, classe, inscriptions, etablissement, signataire);
  const donnees = instantanes.get(ancien.eleveId) ??
    // Élève qui a quitté la classe depuis : on repart de l'ancien instantané
    { ...ancien.donnees, eleve: identiteEleve(inscription.eleve), etablissement };

  try {
    const nouveau = await archiver(db, {
      donnees,
      eleveId: ancien.eleveId,
      classe,
      periodeId: ancien.periodeId,
      generePar: signataire,
      remplace: { id: ancien.id, numero: ancien.numero, motif },
    });
    return detailDocument(db, nouveau.id);
  } catch (erreur) {
    if (erreur.code === 'P2002') {
      throw new ErreurApi(409, 'DEJA_REMPLACE', 'Ce document vient d’être remplacé');
    }
    throw erreur;
  }
}
