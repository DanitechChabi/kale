// Vérification publique d'un document archivé, sans compte.
//
// Accès en lecture par numéro uniquement : le client Prisma global est utilisé
// volontairement (exception documentée à l'isolation) ; seuls les champs utiles à
// la vérification sont renvoyés. Le numéro comporte 40 bits aléatoires : il ne
// peut pas être deviné, et l'accès est en plus limité par adresse IP.
import { prisma } from '../../config/prisma.js';
import { formaterNumero, normaliserNumero } from '../../utils/numeroDocument.js';
import { urlVerification } from './serviceReleves.js';

/**
 * Fiche publique d'un document, ou { trouve: false }.
 * `saisie` : numéro tel que tapé ou lu dans le QR code (tirets, minuscules tolérés).
 */
export async function consulterDocument(saisie) {
  const numero = normaliserNumero(saisie);
  if (!numero) return { trouve: false, formatInvalide: true };

  const document = await prisma.releveArchive.findUnique({
    where: { numero },
    include: {
      remplace: { select: { numero: true } },
      remplacePar: { select: { numero: true, genereLe: true } },
      ecole: {
        select: {
          nom: true,
          code: true,
          commune: { select: { nom: true, departement: { select: { nom: true } } } },
        },
      },
    },
  });
  if (!document) return { trouve: false, numero: formaterNumero(numero) };

  const d = document.donnees;
  return {
    trouve: true,
    numero: formaterNumero(document.numero),
    type: document.type,
    statut: document.remplacePar ? 'REMPLACE' : 'EN_VIGUEUR',
    remplacePar: document.remplacePar && {
      numero: formaterNumero(document.remplacePar.numero),
      le: document.remplacePar.genereLe,
    },
    remplace: document.remplace && {
      numero: formaterNumero(document.remplace.numero),
      motif: document.motifCorrection,
    },
    delivreLe: document.genereLe,
    empreinteSha256: document.empreinteSha256,
    tailleOctets: document.tailleOctets,
    etablissement: {
      nom: document.ecole.nom,
      code: document.ecole.code,
      commune: document.ecole.commune?.nom ?? null,
      departement: document.ecole.commune?.departement?.nom ?? null,
    },
    eleve: {
      nom: d.eleve.nom,
      prenoms: d.eleve.prenoms,
      dateNaissance: d.eleve.dateNaissance,
    },
    anneeScolaire: d.anneeScolaire,
    periode: d.periode,
    periodes: d.periodes ?? null,
    classe: d.classe.nom,
    // Les moyennes permettent aussi de contrôler une copie papier
    matieres: d.matieres.map((m) => ({
      matiere: m.matiere,
      coefficient: m.coefficient,
      moyenne: m.moyenne,
      estFacultative: m.estFacultative,
    })),
    resultats: {
      moyenneGenerale: d.resultats.moyenneGenerale,
      rang: d.resultats.rang,
      exAequo: d.resultats.exAequo,
      classes: d.resultats.classes,
      distinction: d.resultats.distinction,
    },
    urlVerification: urlVerification(document.numero),
  };
}

/** Compare l'empreinte d'un fichier reçu (calculée par le vérificateur) à l'archive. */
export async function verifierEmpreinte(saisie, empreinte) {
  const fiche = await consulterDocument(saisie);
  if (!fiche.trouve) return { trouve: false, conforme: false };
  return {
    trouve: true,
    numero: fiche.numero,
    statut: fiche.statut,
    conforme: fiche.empreinteSha256 === empreinte.toLowerCase(),
  };
}
