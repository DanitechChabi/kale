// Textes des SMS envoyés aux parents : courts (2 SMS au plus), sans emoji,
// lisibles sur un téléphone simple.
import { formaterNumero } from '../../utils/numeroDocument.js';
import { libellePeriode, note, rang } from '../releves/contenu.js';

const dateCourte = (date) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(date));

const heure = (date) => {
  const d = new Date(date);
  return `${d.getUTCHours()}h${String(d.getUTCMinutes()).padStart(2, '0')}`.replace('h00', 'h');
};

/** « +2290121304050 » → « 01 21 30 40 50 » */
const telephoneLocal = (numero) => numero.replace(/^\+229/, '').replace(/(\d{2})(?=\d)/g, '$1 ');

const prenomUsuel = (prenoms) => prenoms.split(/\s+/)[0];

export function messageAbsence({ eleve, ecole, appel, statut, minutesRetard }) {
  const qui = `${prenomUsuel(eleve.prenoms)} ${eleve.nom}`;
  const quand = `le ${dateCourte(appel.date)} à ${heure(appel.heureDebut)}`;
  const quoi =
    statut === 'RETARD'
      ? `est arrivé(e) en retard${minutesRetard ? ` de ${minutesRetard} min` : ''} ${quand}`
      : `était absent(e) ${quand}`;
  return `EduRelevé : ${qui} ${quoi} (${ecole.nom}). Pour toute justification, contactez l'établissement${ecole.telephone ? ` au ${telephoneLocal(ecole.telephone)}` : ''}.`;
}

export function messageBulletin({ eleve, donnees, numero, url }) {
  const qui = `${prenomUsuel(eleve.prenoms)} ${eleve.nom}`;
  const document =
    donnees.type === 'BULLETIN_PERIODE'
      ? `Le bulletin du ${libellePeriode(donnees.periode)}`
      : 'Le relevé annuel';
  const r = donnees.resultats;
  return `EduRelevé : ${document} de ${qui} est disponible. Moyenne ${note(r.moyenneGenerale)}/20, rang ${rang(r.rang, r.exAequo)} sur ${r.classes}. N° ${formaterNumero(numero)}, vérifiable sur ${url.replace(/^https?:\/\//, '')}`;
}

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** « 2026-10 » → « octobre » */
export const nomMois = (mois) => MOIS[Number(mois.slice(5, 7)) - 1];

const MOTS_VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', "l'", "d'"]);

/**
 * Nom court d'une matière pour un SMS : sigle usuel pour les intitulés longs
 * (« Sciences de la Vie et de la Terre » → « SVT », « Physique-Chimie et
 * Technologie » → « PCT »), nom complet sinon.
 */
export function matiereCourte(nom) {
  const mots = nom.split(/[\s-]+/).filter((m) => m && !MOTS_VIDES.has(m.toLowerCase()));
  if (mots.length >= 3) {
    return mots.map((m) => m.normalize('NFD').replace(/\p{M}/gu, '')[0].toUpperCase()).join('');
  }
  return nom.length <= 20 ? nom : mots[0];
}

/**
 * Récapitulatif mensuel : moyenne des notes du mois dans chaque matière (sur 20),
 * puis moyenne générale de la période à ce jour. Les matières qui ne tiennent pas
 * dans la longueur maximale sont résumées par « … ».
 */
export function messageRecapNotes(
  { eleve, mois, matieres, periode, moyenneGenerale, url },
  max = 480,
) {
  const debut = `EduRelevé : notes de ${prenomUsuel(eleve.prenoms)} ${eleve.nom} en ${nomMois(mois)} : `;
  const fin = [
    moyenneGenerale !== null && moyenneGenerale !== undefined
      ? ` Moyenne du ${libellePeriode(periode)} à ce jour : ${note(moyenneGenerale)}/20.`
      : '',
    url ? ` Détail : ${url.replace(/^https?:\/\//, '')}` : '',
  ].join('');
  const elements = matieres.map((m) => `${matiereCourte(m.matiere)} ${note(m.moyenne)}`);
  let liste = '';
  for (const [i, element] of elements.entries()) {
    const suivant = `${liste}${i ? ' ; ' : ''}${element}`;
    const reste = i < elements.length - 1 ? ' ; …' : '';
    if ((debut + suivant + reste + '.' + fin).length > max) {
      liste += ' ; …';
      break;
    }
    liste = suivant;
  }
  return `${debut}${liste}.${fin}`;
}
