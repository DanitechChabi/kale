// Inscription d'un établissement : fiche, compte du responsable et pièces
// justificatives, déposés en une seule fois. L'établissement reste
// « EN_ATTENTE » jusqu'à sa vérification par le ministère ou l'administrateur.
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ErreurApi } from '../../middlewares/erreurs.js';
import { supprimerFichiers } from '../../utils/fichiers.js';
import { schemaEmail, schemaTelephone } from '../../utils/identifiants.js';
import { hacherMotDePasse, schemaMotDePasse } from '../../utils/motDePasse.js';
import { journaliser } from '../audit/journal.js';
import { analyserPiece, stockerPiece } from '../ecole/documents.js';
import { piecesObligatoires, TYPES_PIECES } from '../ecole/pieces.js';

const texte = (min, max) => z.string().trim().min(min).max(max);
const facultatif = (schema) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    schema.optional(),
  );

export const schemaInscriptionEcole = z.object({
  ecole: z.object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(2, 'Code trop court')
      .max(30)
      .regex(/^[A-Z0-9][A-Z0-9/-]*$/, 'Lettres, chiffres, « - » et « / » uniquement'),
    nom: texte(3, 200),
    sigle: facultatif(texte(1, 30)),
    statut: z.enum(['PUBLIC', 'PRIVE_LAIC', 'PRIVE_CONFESSIONNEL']),
    type: z.enum(['CEG', 'LYCEE', 'LYCEE_TECHNIQUE', 'COMPLEXE_SCOLAIRE']),
    ordres: z
      .array(z.enum(['GENERAL', 'TECHNIQUE']))
      .min(1, 'Choisissez au moins un ordre d’enseignement')
      .transform((ordres) => [...new Set(ordres)]),
    nomChefEtablissement: texte(3, 200),
    communeId: z.uuid('Commune invalide'),
    adresse: facultatif(texte(1, 255)),
    telephone: schemaTelephone,
    email: facultatif(schemaEmail),
    typePeriode: z.enum(['TRIMESTRE', 'SEMESTRE']).default('TRIMESTRE'),
  }),
  responsable: z.object({
    nom: texte(2, 100),
    prenoms: texte(2, 150),
    telephone: schemaTelephone,
    email: facultatif(schemaEmail),
    motDePasse: schemaMotDePasse,
  }),
  // Références des actes (facultatives), par type de pièce
  references: z
    .partialRecord(
      z.enum(TYPES_PIECES),
      z.object({
        referenceActe: facultatif(texte(1, 100)),
        dateActe: facultatif(z.coerce.date()),
      }),
    )
    .default({}),
});

/** Le formulaire multipart transporte les données dans un champ JSON « donnees ». */
export function lireDonneesMultipart(corps) {
  try {
    return JSON.parse(corps?.donnees ?? '');
  } catch {
    throw new ErreurApi(400, 'DONNEES_INVALIDES', 'Le champ « donnees » doit contenir du JSON');
  }
}

export async function inscrireEcole(donnees, fichiers = {}, { adresseIp } = {}) {
  const { ecole, responsable, references } = donnees;

  // 1. Pièces obligatoires présentes et fichiers valides
  const manquantes = piecesObligatoires(ecole.statut).filter((type) => !fichiers[type]?.length);
  if (manquantes.length) {
    throw new ErreurApi(400, 'PIECES_MANQUANTES', 'Des pièces obligatoires sont manquantes', {
      manquantes,
    });
  }
  const pieces = Object.entries(fichiers).flatMap(([type, liste]) =>
    liste.map((fichier) => ({ ...analyserPiece(type, fichier), ...references[type] })),
  );

  // 2. Contrôles de cohérence avec messages explicites
  const commune = await prisma.commune.findUnique({ where: { id: ecole.communeId } });
  if (!commune) throw new ErreurApi(400, 'COMMUNE_INVALIDE', 'Commune inconnue');

  if (await prisma.ecole.findUnique({ where: { code: ecole.code } })) {
    throw new ErreurApi(409, 'ECOLE_EXISTANTE', 'Un établissement avec ce code est déjà inscrit');
  }
  const compteExistant = await prisma.utilisateur.findFirst({
    where: {
      OR: [
        { telephone: responsable.telephone },
        ...(responsable.email ? [{ email: responsable.email }] : []),
      ],
    },
  });
  if (compteExistant) {
    throw new ErreurApi(
      409,
      'IDENTIFIANT_DEJA_UTILISE',
      'Ce numéro de téléphone ou cet e-mail est déjà associé à un compte',
    );
  }

  // 3. Écriture des fichiers puis des données ; les fichiers sont effacés si la base échoue
  const ecoleId = randomUUID();
  const fichiersEcrits = [];
  try {
    const documents = [];
    for (const piece of pieces) {
      const document = await stockerPiece(ecoleId, piece);
      fichiersEcrits.push(document.cheminFichier);
      documents.push(document);
    }
    const motDePasseHash = await hacherMotDePasse(responsable.motDePasse);

    await prisma.$transaction(async (tx) => {
      await tx.ecole.create({ data: { id: ecoleId, ...ecole } });
      const compte = await tx.utilisateur.create({
        data: {
          ecoleId,
          role: 'ADMIN_ECOLE',
          nom: responsable.nom.toUpperCase(),
          prenoms: responsable.prenoms,
          telephone: responsable.telephone,
          email: responsable.email ?? null,
          motDePasseHash,
          doitChangerMotDePasse: false,
        },
      });
      await tx.documentEcole.createMany({
        data: documents.map((d) => ({ ...d, ecoleId, deposeParId: compte.id })),
      });
      await journaliser(tx, {
        ecoleId,
        utilisateurId: compte.id,
        action: 'CREATION',
        entite: 'Ecole',
        entiteId: ecoleId,
        apres: { code: ecole.code, nom: ecole.nom, statutVerification: 'EN_ATTENTE' },
        adresseIp,
      });
    });
  } catch (erreur) {
    await supprimerFichiers(fichiersEcrits);
    throw erreur;
  }

  return { id: ecoleId, code: ecole.code, nom: ecole.nom, statutVerification: 'EN_ATTENTE' };
}
