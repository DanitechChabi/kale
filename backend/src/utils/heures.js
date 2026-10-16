// Heures de cours (colonnes TIME) : « 08:30 » ↔ Date du 1er janvier 1970.
export const versHeure = (texte) => new Date(`1970-01-01T${texte}:00.000Z`);
export const depuisHeure = (date) => new Date(date).toISOString().slice(11, 16);
