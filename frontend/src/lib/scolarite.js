// Libellés et utilitaires de la gestion scolaire.

export const NIVEAUX = [
  ['SIXIEME', '6e'],
  ['CINQUIEME', '5e'],
  ['QUATRIEME', '4e'],
  ['TROISIEME', '3e'],
  ['SECONDE', '2nde'],
  ['PREMIERE', '1re'],
  ['TERMINALE', 'Tle'],
];
export const LIBELLE_NIVEAU = Object.fromEntries(NIVEAUX);
export const SECOND_CYCLE = ['SECONDE', 'PREMIERE', 'TERMINALE'];

/** « 7KQ4M9X2PD » → « 7KQ4M-9X2PD » */
export const formaterIdentifiant = (id) => (id ? `${id.slice(0, 5)}-${id.slice(5)}` : '');

/** Libellé d'année scolaire proposé pour la rentrée en cours. */
export function anneeProposee(aujourdHui = new Date()) {
  const debut =
    aujourdHui.getMonth() >= 6 ? aujourdHui.getFullYear() : aujourdHui.getFullYear() - 1;
  return {
    libelle: `${debut}-${debut + 1}`,
    dateDebut: `${debut}-10-01`,
    dateFin: `${debut + 1}-07-15`,
  };
}

export const age = (dateNaissance) =>
  Math.floor((Date.now() - new Date(dateNaissance).getTime()) / (365.25 * 86_400_000));
