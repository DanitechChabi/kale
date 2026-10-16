// EduCourses : libellés des niveaux et des matières, chemins de l'espace.

export const NIVEAUX = [
  ['SIXIEME', '6e'],
  ['CINQUIEME', '5e'],
  ['QUATRIEME', '4e'],
  ['TROISIEME', '3e'],
  ['SECONDE', '2nde'],
  ['PREMIERE', '1re'],
  ['TERMINALE', 'Tle'],
];
const COURTS = Object.fromEntries(NIVEAUX);
export const SECOND_CYCLE = ['SECONDE', 'PREMIERE', 'TERMINALE'];

/** « 6e », « 1re D », « Tle C » */
export const classeProfil = ({ niveau, serie }) =>
  `${COURTS[niveau] ?? niveau}${serie ? ` ${serie}` : ''}`;

export const LIBELLES_NIVEAUX = {
  SIXIEME: 'Sixième',
  CINQUIEME: 'Cinquième',
  QUATRIEME: 'Quatrième',
  TROISIEME: 'Troisième',
  SECONDE: 'Seconde',
  PREMIERE: 'Première',
  TERMINALE: 'Terminale',
};

export const CONFIANCES = {
  OFFICIEL: ['Programme officiel', 'vert'],
  RECOUPE: ['Programme recoupé', 'bleu'],
  RECONSTITUE: ['Programme reconstitué', 'ambre'],
};

export const cheminProfil = (profilId) => `/espace/educourses/${profilId}`;
export const cheminProgramme = (profilId, programmeId) =>
  `/espace/educourses/${profilId}/programmes/${programmeId}`;
export const cheminLecon = (profilId, leconId) =>
  `/espace/educourses/${profilId}/lecons/${leconId}`;

export const pourcentage = (fait, total) => (total ? Math.round((100 * fait) / total) : 0);

/** « 45 min », « 1 h 30 » */
export function duree(minutes) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}
