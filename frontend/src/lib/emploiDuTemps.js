// Emplois du temps : jours, horaires et couleurs des matières.

export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
export const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/** Plage affichée par la grille : 7 h à 19 h. */
export const DEBUT_JOURNEE = 7 * 60;
export const FIN_JOURNEE = 19 * 60;

/** « 08:30 » → 510 */
export const enMinutes = (heure) => {
  const [h, m] = heure.split(':').map(Number);
  return h * 60 + m;
};
/** 510 → « 08:30 » */
export const enHeure = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** « 08:30 » → « 8 h 30 », « 10:00 » → « 10 h » */
export const heureLisible = (heure) => {
  const [h, m] = heure.split(':');
  return `${Number(h)} h${m === '00' ? '' : ` ${m}`}`;
};

/** Jour de la semaine (1 = lundi … 7 = dimanche) d'une date locale. */
export const jourDe = (date = new Date()) => ((date.getDay() + 6) % 7) + 1;

/** Date locale « AAAA-MM-JJ ». */
export const dateLocale = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Teintes des matières : stables d'une semaine à l'autre (dérivées du code)
const TEINTES = [
  'bg-marque-50 text-marque-800 ring-marque-200',
  'bg-amber-50 text-amber-900 ring-amber-200',
  'bg-sky-50 text-sky-900 ring-sky-200',
  'bg-rose-50 text-rose-900 ring-rose-200',
  'bg-violet-50 text-violet-900 ring-violet-200',
  'bg-slate-100 text-slate-800 ring-slate-300',
  'bg-lime-50 text-lime-900 ring-lime-200',
  'bg-orange-50 text-orange-900 ring-orange-200',
];
export function teinteMatiere(code = '') {
  let h = 0;
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TEINTES[h % TEINTES.length];
}
