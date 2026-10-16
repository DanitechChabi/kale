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
