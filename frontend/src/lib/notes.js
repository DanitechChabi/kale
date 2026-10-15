// Utilitaires de saisie et d'affichage des notes.

export const LIBELLES_EVALUATIONS = {
  INTERROGATION: 'Interrogation',
  DEVOIR: 'Devoir',
  COMPOSITION: 'Composition',
};

/** « 12,5 » → 12.5 ; contrôle le barème et le nombre de décimales. */
export function lireNote(texte, bareme) {
  const brut = String(texte ?? '')
    .trim()
    .replace(',', '.');
  if (brut === '') return { valeur: null, erreur: null };
  if (!/^\d+(\.\d{1,2})?$/.test(brut)) return { valeur: null, erreur: 'Nombre invalide' };
  const valeur = Number(brut);
  if (valeur > bareme) return { valeur: null, erreur: `Maximum ${bareme}` };
  return { valeur, erreur: null };
}

/** 12.5 → « 12,50 » */
export const formaterNote = (n, decimales = 2) =>
  n === null || n === undefined ? '–' : n.toFixed(decimales).replace('.', ',');

export const formaterRang = (rang, exAequo) =>
  rang ? `${rang}${rang === 1 ? 'er' : 'e'}${exAequo ? ' ex æq.' : ''}` : '–';

/** Période proposée par défaut : celle en cours, sinon la première non clôturée. */
export function periodeParDefaut(periodes, aujourdHui = new Date()) {
  const ouvertes = periodes.filter((p) => !p.estCloturee);
  return (
    ouvertes.find(
      (p) => new Date(p.dateDebut) <= aujourdHui && aujourdHui <= new Date(p.dateFin),
    ) ??
    ouvertes[0] ??
    periodes[periodes.length - 1] ??
    null
  );
}

export const libellePeriode = (p) =>
  `${p.type === 'SEMESTRE' ? 'Semestre' : 'Trimestre'} ${p.numero}`;
export const libelleCourtPeriode = (p) => `${p.type === 'SEMESTRE' ? 'S' : 'T'}${p.numero}`;
