// Menus USSD (*code#) pour les parents sans smartphone ni internet.
//
// Format des passerelles d'opérateurs et agrégateurs (Africa's Talking…) : à chaque
// touche, la passerelle renvoie le numéro de l'appelant et tout le parcours saisi
// (« 1*2 ») ; la réponse commence par « CON » (le menu continue) ou « END » (fin).
// Le numéro de l'appelant est fourni par l'opérateur : il identifie le parent,
// comme le contact enregistré par l'établissement ou le téléphone de son compte.
// Client global pour retrouver les enfants (le parent n'a pas d'établissement) ;
// chaque enfant est ensuite lu avec le client isolé de son école.
import { prisma } from '../../config/prisma.js';
import { prismaPourEcole } from '../../db/isolation.js';
import { formaterNumero } from '../../utils/numeroDocument.js';
import { libelleCourtPeriode, note, rang } from '../releves/contenu.js';
import { suiviEleve } from '../suivi/serviceSuivi.js';

const LONGUEUR_MAX = 182; // limite d'un écran USSD

const ecran = (type, texte) => {
  const complet = `${type} ${texte}`;
  return complet.length > LONGUEUR_MAX ? `${complet.slice(0, LONGUEUR_MAX - 1)}…` : complet;
};
const fin = (texte) => ecran('END', texte);
const suite = (texte) => ecran('CON', texte);

const ECOLE_OUVERTE = { statutVerification: 'VERIFIEE', actif: true };

/** Enfants associés à un numéro : comptes parents reliés et contacts déclarés. */
export async function enfantsDuTelephone(telephone) {
  const [parLien, parContact] = await Promise.all([
    prisma.lienParentEleve.findMany({
      where: { parent: { telephone, role: 'PARENT', actif: true }, ecole: ECOLE_OUVERTE },
      select: { eleve: { select: { id: true, ecoleId: true, nom: true, prenoms: true } } },
    }),
    prisma.eleve.findMany({
      where: { telephoneContactParent: telephone, ecole: ECOLE_OUVERTE },
      select: { id: true, ecoleId: true, nom: true, prenoms: true },
    }),
  ]);
  const enfants = new Map();
  for (const e of [...parLien.map((l) => l.eleve), ...parContact]) enfants.set(e.id, e);
  return [...enfants.values()].sort((a, b) => a.prenoms.localeCompare(b.prenoms));
}

const prenom = (e) => e.prenoms.split(/\s+/)[0];

function resumeMoyennes(enfant, suivi) {
  const lignes = suivi.periodes
    .filter((p) => p.moyenneGenerale !== null)
    .map(
      (p) =>
        `${libelleCourtPeriode(p)} : ${note(p.moyenneGenerale)}/20${
          p.estCloturee ? ` (${rang(p.rang)}/${p.effectif})` : ' (en cours)'
        }`,
    );
  if (!lignes.length) return `${prenom(enfant)} n'a pas encore de note cette année.`;
  // Matière la plus faible de la dernière période notée : le point à surveiller
  const derniere = suivi.periodes.filter((p) => p.moyenneGenerale !== null).at(-1);
  const faible = derniere.matieres
    .filter((m) => m.moyenne !== null)
    .sort((a, b) => a.moyenne - b.moyenne)[0];
  return [
    `${prenom(enfant)} ${enfant.nom}, ${suivi.classe?.nom ?? ''}`,
    ...lignes,
    faible && faible.moyenne < 10
      ? `À surveiller : ${faible.matiere} ${note(faible.moyenne)}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function resumeAbsences(enfant, suivi) {
  const absences = suivi.absences.filter((a) => a.statut === 'ABSENT');
  const retards = suivi.absences.filter((a) => a.statut === 'RETARD');
  if (!suivi.absences.length) return `${prenom(enfant)} : aucune absence cette année.`;
  const nonJustifiees = absences.filter((a) => !a.justifiee).length;
  const derniere = suivi.absences[0];
  const [, mois, jour] = derniere.date.split('-');
  return [
    `${prenom(enfant)} ${enfant.nom}`,
    `${absences.length} absence(s) dont ${nonJustifiees} non justifiée(s)`,
    `${retards.length} retard(s)`,
    `Dernière : ${jour}/${mois} à ${derniere.heureDebut.replace(':00', 'h').replace(':', 'h')}`,
  ].join('\n');
}

function resumeBulletins(enfant, suivi) {
  const enVigueur = suivi.documents.filter((d) => !d.remplacePar).slice(0, 3);
  if (!enVigueur.length) return `${prenom(enfant)} n'a pas encore de bulletin délivré.`;
  return [
    `Bulletins de ${prenom(enfant)} :`,
    ...enVigueur.map(
      (d) =>
        `${d.periode ? libelleCourtPeriode(d.periode) : 'Année'} ${d.anneeScolaire} : ${note(d.moyenneGenerale)} - N° ${formaterNumero(d.numero)}`,
    ),
  ].join('\n');
}

const RUBRIQUES = {
  1: resumeMoyennes,
  2: resumeAbsences,
  3: resumeBulletins,
};

/**
 * Réponse à une étape du parcours. `texte` : saisies cumulées séparées par « * ».
 */
export async function repondreUssd({ telephone, texte = '' }) {
  const saisies = texte ? texte.split('*').map((s) => s.trim()) : [];
  if (!saisies.length) {
    return suite('EduRelevé\n1. Notes et moyennes\n2. Absences\n3. Bulletins délivrés');
  }
  const rubrique = RUBRIQUES[saisies[0]];
  if (!rubrique) return fin('Choix invalide. Recomposez le code pour recommencer.');

  const enfants = await enfantsDuTelephone(telephone);
  if (!enfants.length) {
    return fin(
      "Aucun élève n'est associé à ce numéro. Demandez à l'établissement d'enregistrer votre téléphone.",
    );
  }

  let enfant = enfants[0];
  if (enfants.length > 1) {
    if (saisies.length < 2) {
      return suite(
        `Choisissez l'enfant :\n${enfants
          .slice(0, 8)
          .map((e, i) => `${i + 1}. ${prenom(e)} ${e.nom}`)
          .join('\n')}`,
      );
    }
    enfant = enfants[Number(saisies[1]) - 1];
    if (!enfant) return fin('Choix invalide. Recomposez le code pour recommencer.');
  }

  const suivi = await suiviEleve(prismaPourEcole(enfant.ecoleId), enfant.id);
  return fin(rubrique(enfant, suivi));
}
