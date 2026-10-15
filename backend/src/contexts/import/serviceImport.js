// Import d'une liste d'élèves (Excel .xlsx ou CSV) en deux temps :
// 1. analyse : rien n'est enregistré ; chaque ligne est normalisée, contrôlée et
//    rapprochée des élèves déjà connus (aperçu affiché à l'utilisateur) ;
// 2. import : les lignes validées sont enregistrées en une seule transaction.
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { ErreurApi } from '../../middlewares/erreurs.js';
import { genererIdentifiantEleve } from '../../utils/identifiantEleve.js';
import { journaliser } from '../audit/journal.js';
import { anneeCourante } from '../scolarite/serviceAnnees.js';
import { anneeDebut, prochainsMatricules } from '../scolarite/serviceEleves.js';
import {
  cleIdentite,
  detecterEntetes,
  normaliserLigne,
  simplifier,
  valeurCellule,
} from './normalisation.js';

export const LIGNES_MAX = 2000;

/** « 6ème A », « 6eme a », « 6e A » → même clé ; « Terminale D1 » → « tled1 ». */
export function cleClasse(nom) {
  return simplifier(nom)
    .replace(/^(\d)(?:ieme|eme|em|e)/, '$1e')
    .replace(/^seconde|^2nd(?!e)/, '2nde')
    .replace(/^premiere|^1ere/, '1re')
    .replace(/^terminale/, 'tle');
}

/** Lit un fichier .xlsx ou .csv en tableau de lignes (tableaux de cellules). */
export async function lireLignes(contenu) {
  if (contenu.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    const classeur = new ExcelJS.Workbook();
    try {
      await classeur.xlsx.load(contenu);
    } catch {
      throw new ErreurApi(400, 'FICHIER_ILLISIBLE', 'Fichier Excel illisible');
    }
    const feuille = classeur.worksheets.find((f) => f.actualRowCount > 0);
    if (!feuille) return [];
    const lignes = [];
    feuille.eachRow({ includeEmpty: true }, (ligne) => {
      lignes.push(ligne.values.slice(1).map(valeurCellule));
    });
    return lignes;
  }
  if (contenu.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))) {
    throw new ErreurApi(
      400,
      'FORMAT_ANCIEN',
      'Ancien format Excel (.xls) : enregistrez le fichier au format .xlsx (Fichier → Enregistrer sous)',
    );
  }
  return lireCsv(contenu.toString('utf8').replace(/^\uFEFF/, ''));
}

function lireCsv(texte) {
  // Octets de contrôle en début de fichier : ce n'est pas du texte
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008]/.test(texte.slice(0, 2000))) {
    throw new ErreurApi(
      400,
      'FORMAT_INCONNU',
      'Format non reconnu : utilisez un fichier Excel (.xlsx) ou CSV',
    );
  }
  const premiere = texte.split(/\r?\n/, 1)[0];
  const separateur =
    (premiere.match(/;/g) ?? []).length >= (premiere.match(/,/g) ?? []).length ? ';' : ',';
  const lignes = [];
  let ligne = [];
  let cellule = '';
  let entreGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (entreGuillemets) {
      if (c === '"' && texte[i + 1] === '"') {
        cellule += '"';
        i++;
      } else if (c === '"') entreGuillemets = false;
      else cellule += c;
    } else if (c === '"') entreGuillemets = true;
    else if (c === separateur) {
      ligne.push(cellule);
      cellule = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i++;
      ligne.push(cellule);
      lignes.push(ligne);
      ligne = [];
      cellule = '';
    } else cellule += c;
  }
  if (cellule || ligne.length) lignes.push([...ligne, cellule]);
  return lignes;
}

async function contexteEtablissement(db) {
  const annee = await anneeCourante(db);
  const [classes, eleves] = await Promise.all([
    db.classe.findMany({ where: { anneeScolaireId: annee.id }, select: { id: true, nom: true } }),
    db.eleve.findMany({
      select: {
        id: true,
        matricule: true,
        nom: true,
        prenoms: true,
        dateNaissance: true,
        inscriptions: {
          where: { anneeScolaireId: annee.id },
          select: { classe: { select: { nom: true } } },
        },
      },
    }),
  ]);
  return {
    annee,
    classes,
    classeParCle: new Map(classes.map((c) => [cleClasse(c.nom), c])),
    parMatricule: new Map(eleves.map((e) => [e.matricule.toUpperCase(), e])),
    parIdentite: new Map(eleves.map((e) => [cleIdentite(e), e])),
  };
}

const eleveConnu = (ctx, d) =>
  (d.matricule && ctx.parMatricule.get(d.matricule.toUpperCase())) ||
  ctx.parIdentite.get(cleIdentite(d)) ||
  null;

export async function analyserFichier(db, contenu) {
  const lignes = await lireLignes(contenu);
  const { index, colonnes } = detecterEntetes(lignes);
  const champs = new Set(colonnes.map((c) => c.champ).filter(Boolean));
  if (index < 0 || !(champs.has('nomComplet') || (champs.has('nom') && champs.has('prenoms')))) {
    throw new ErreurApi(
      400,
      'ENTETES_INTROUVABLES',
      'Colonnes « Nom » et « Prénoms » (ou « Nom et prénoms ») introuvables. Téléchargez le modèle pour voir la présentation attendue.',
    );
  }

  const corps = lignes
    .slice(index + 1)
    .map((cellules, i) => ({ numero: index + i + 2, cellules }))
    .filter(({ cellules }) => cellules.some((c) => String(c ?? '').trim() !== ''));
  if (corps.length > LIGNES_MAX) {
    throw new ErreurApi(400, 'TROP_DE_LIGNES', `${LIGNES_MAX} élèves au maximum par fichier`);
  }

  const ctx = await contexteEtablissement(db);
  const dejaVues = new Map();
  const classesInconnues = new Set();

  const resultat = corps.map(({ numero, cellules }) => {
    const brute = Object.fromEntries(
      colonnes.filter((c) => c.champ).map((c) => [c.champ, cellules[c.position]]),
    );
    const { donnees, erreurs, avertissements } = normaliserLigne(brute);

    let classeId = null;
    if (donnees.classe) {
      const classe = ctx.classeParCle.get(cleClasse(donnees.classe));
      if (classe) classeId = classe.id;
      else {
        classesInconnues.add(donnees.classe);
        avertissements.push(`Classe « ${donnees.classe} » inconnue pour ${ctx.annee.libelle}`);
      }
    }

    let statut = 'nouveau';
    let eleveExistant = null;
    if (erreurs.length) statut = 'erreur';
    else {
      const cle = donnees.matricule
        ? `m:${donnees.matricule.toUpperCase()}`
        : `i:${cleIdentite(donnees)}`;
      if (dejaVues.has(cle)) {
        statut = 'doublon';
        avertissements.push(`Doublon de la ligne ${dejaVues.get(cle)} : ignoré`);
      } else {
        dejaVues.set(cle, numero);
        const connu = eleveConnu(ctx, donnees);
        if (connu) {
          statut = 'existant';
          const classeActuelle = connu.inscriptions[0]?.classe.nom;
          eleveExistant = { id: connu.id, classe: classeActuelle ?? null };
          avertissements.push(
            classeActuelle
              ? `Déjà inscrit en ${classeActuelle} : ignoré`
              : 'Élève déjà enregistré : sera seulement inscrit',
          );
        }
      }
    }

    return {
      numero,
      statut,
      donnees: {
        ...donnees,
        dateNaissance: donnees.dateNaissance?.toISOString().slice(0, 10) ?? null,
        classeId,
      },
      erreurs,
      avertissements,
      eleveExistant,
    };
  });

  const compter = (s) => resultat.filter((l) => l.statut === s).length;
  return {
    anneeScolaire: { id: ctx.annee.id, libelle: ctx.annee.libelle },
    colonnes: colonnes.filter((c) => c.entete).map(({ entete, champ }) => ({ entete, champ })),
    classes: ctx.classes,
    classesInconnues: [...classesInconnues],
    resume: {
      total: resultat.length,
      nouveaux: compter('nouveau'),
      existants: compter('existant'),
      erreurs: compter('erreur'),
      doublons: compter('doublon'),
    },
    lignes: resultat,
  };
}

const facultatif = (schema) => schema.nullish().transform((v) => v ?? null);

export const schemaLigneImport = z.object({
  numero: z.number().int(),
  nom: z.string().trim().min(2).max(100),
  prenoms: z.string().trim().min(2).max(150),
  sexe: z.enum(['M', 'F']),
  dateNaissance: z.coerce.date(),
  lieuNaissance: facultatif(z.string().trim().max(100)),
  matricule: facultatif(z.string().trim().min(1).max(30)),
  npi: facultatif(z.string().regex(/^\d{6,20}$/)),
  classeId: facultatif(z.uuid()),
  nomContactParent: facultatif(z.string().trim().max(200)),
  telephoneContactParent: facultatif(z.string().regex(/^\+\d{8,15}$/)),
});

export async function importerEleves(db, auteur, { lignes, classeId: classeParDefaut }) {
  const ctx = await contexteEtablissement(db);
  const classesValides = new Set(ctx.classes.map((c) => c.id));
  if (classeParDefaut && !classesValides.has(classeParDefaut)) {
    throw new ErreurApi(400, 'CLASSE_INVALIDE', 'Classe introuvable pour l’année en cours');
  }

  const ignores = [];
  const nouveaux = [];
  const inscriptionsExistants = [];
  const vus = new Set();

  for (const ligne of lignes) {
    const classeId = ligne.classeId ?? classeParDefaut ?? null;
    if (classeId && !classesValides.has(classeId)) {
      ignores.push({ numero: ligne.numero, motif: 'Classe inconnue' });
      continue;
    }
    const cle = ligne.matricule ? `m:${ligne.matricule.toUpperCase()}` : `i:${cleIdentite(ligne)}`;
    if (vus.has(cle)) {
      ignores.push({ numero: ligne.numero, motif: 'Doublon dans le fichier' });
      continue;
    }
    vus.add(cle);

    const connu = eleveConnu(ctx, ligne);
    if (connu) {
      if (connu.inscriptions.length)
        ignores.push({ numero: ligne.numero, motif: 'Déjà inscrit cette année' });
      else if (!classeId) ignores.push({ numero: ligne.numero, motif: 'Élève déjà enregistré' });
      else inscriptionsExistants.push({ eleveId: connu.id, classeId });
      continue;
    }
    nouveaux.push({ ...ligne, classeId });
  }

  // Matricules et identifiants attribués en une fois
  const sansMatricule = nouveaux.filter((l) => !l.matricule);
  const matricules = await prochainsMatricules(db, anneeDebut(ctx.annee), sansMatricule.length);
  sansMatricule.forEach((l, i) => {
    l.matricule = matricules[i];
  });
  const identifiants = new Set();
  while (identifiants.size < nouveaux.length) identifiants.add(genererIdentifiantEleve());
  const pris = await db.eleve.findMany({
    where: { identifiant: { in: [...identifiants] } },
    select: { identifiant: true },
  });
  for (const { identifiant } of pris) identifiants.delete(identifiant);
  while (identifiants.size < nouveaux.length) identifiants.add(genererIdentifiantEleve());
  const listeIdentifiants = [...identifiants];

  const fiches = nouveaux.map((l, i) => ({
    id: randomUUID(),
    identifiant: listeIdentifiants[i],
    matricule: l.matricule,
    nom: l.nom.toUpperCase(),
    prenoms: l.prenoms,
    sexe: l.sexe,
    dateNaissance: l.dateNaissance,
    lieuNaissance: l.lieuNaissance,
    npi: l.npi,
    nomContactParent: l.nomContactParent,
    telephoneContactParent: l.telephoneContactParent,
  }));
  const inscriptions = [
    ...nouveaux
      .map((l, i) => ({ eleveId: fiches[i].id, classeId: l.classeId }))
      .filter((i) => i.classeId),
    ...inscriptionsExistants,
  ].map((i) => ({ ...i, anneeScolaireId: ctx.annee.id }));

  await db.$transaction(async (tx) => {
    if (fiches.length) await tx.eleve.createMany({ data: fiches });
    if (inscriptions.length) await tx.inscription.createMany({ data: inscriptions });
    await journaliser(tx, {
      utilisateurId: auteur.id,
      adresseIp: auteur.adresseIp,
      action: 'CREATION',
      entite: 'ImportEleves',
      entiteId: randomUUID(),
      apres: { eleves: fiches.length, inscriptions: inscriptions.length, ignores: ignores.length },
    });
  });

  return { crees: fiches.length, inscrits: inscriptions.length, ignores };
}

/** Modèle Excel à remplir, avec la liste des classes de l'année en cours. */
export async function genererModele(db) {
  const annee = await db.anneeScolaire.findFirst({ where: { estCourante: true } });
  const classes = annee
    ? await db.classe.findMany({
        where: { anneeScolaireId: annee.id },
        orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
      })
    : [];

  const classeur = new ExcelJS.Workbook();
  classeur.creator = 'EduRelevé';
  const feuille = classeur.addWorksheet('Élèves', { views: [{ state: 'frozen', ySplit: 1 }] });
  feuille.columns = [
    { header: 'Matricule', key: 'matricule', width: 14 },
    { header: 'NOM', key: 'nom', width: 20 },
    { header: 'Prénoms', key: 'prenoms', width: 26 },
    { header: 'Sexe', key: 'sexe', width: 8 },
    {
      header: 'Date de naissance',
      key: 'dateNaissance',
      width: 18,
      style: { numFmt: 'dd/mm/yyyy' },
    },
    { header: 'Lieu de naissance', key: 'lieuNaissance', width: 20 },
    { header: 'NPI', key: 'npi', width: 16 },
    { header: 'Classe', key: 'classe', width: 12 },
    { header: 'Nom du parent', key: 'nomContactParent', width: 26 },
    { header: 'Téléphone du parent', key: 'telephoneContactParent', width: 20 },
  ];
  const entete = feuille.getRow(1);
  entete.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  entete.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F33' } };
  entete.height = 22;

  const exemple = classes[0]?.nom ?? '6e A';
  feuille.addRow({
    nom: 'DOSSOU',
    prenoms: 'Afi Mireille',
    sexe: 'F',
    dateNaissance: new Date(Date.UTC(2014, 2, 12)),
    lieuNaissance: 'Cotonou',
    classe: exemple,
    nomContactParent: 'DOSSOU Marc',
    telephoneContactParent: '01 97 00 00 00',
  });
  feuille.addRow({
    nom: 'HOUNSOU',
    prenoms: 'Koffi',
    sexe: 'M',
    dateNaissance: new Date(Date.UTC(2013, 8, 5)),
    lieuNaissance: 'Abomey-Calavi',
    classe: exemple,
  });
  for (let ligne = 2; ligne <= LIGNES_MAX + 1; ligne++) {
    feuille.getCell(`D${ligne}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"M,F"'],
      showErrorMessage: true,
      error: 'M ou F',
    };
  }

  const aide = classeur.addWorksheet('Classes');
  aide.columns = [{ header: `Classes ${annee?.libelle ?? ''}`.trim(), width: 24 }];
  aide.getRow(1).font = { bold: true };
  classes.forEach((c) => aide.addRow([c.nom]));

  return classeur.xlsx.writeBuffer();
}
