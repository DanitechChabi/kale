// Années scolaires et périodes (trimestres ou semestres) d'un établissement.
import { ErreurApi } from '../../middlewares/erreurs.js';

/** Découpe l'année en périodes de durées égales selon le choix de l'établissement. */
export function decouperAnnee(dateDebut, dateFin, typePeriode) {
  const nombre = typePeriode === 'SEMESTRE' ? 2 : 3;
  const debut = dateDebut.getTime();
  const pas = (dateFin.getTime() - debut) / nombre;
  const jour = 86_400_000;
  return Array.from({ length: nombre }, (_, i) => ({
    type: typePeriode,
    numero: i + 1,
    dateDebut: new Date(Math.round((debut + i * pas) / jour) * jour + (i ? jour : 0)),
    dateFin:
      i === nombre - 1 ? dateFin : new Date(Math.round((debut + (i + 1) * pas) / jour) * jour),
  }));
}

export function listerAnnees(db) {
  return db.anneeScolaire.findMany({
    orderBy: { dateDebut: 'desc' },
    include: { periodes: { orderBy: { numero: 'asc' } } },
  });
}

export async function anneeCourante(db) {
  const annee = await db.anneeScolaire.findFirst({ where: { estCourante: true } });
  if (!annee) {
    throw new ErreurApi(409, 'ANNEE_ABSENTE', 'Créez d’abord l’année scolaire en cours');
  }
  return annee;
}

export async function creerAnnee(db, ecoleId, { libelle, dateDebut, dateFin, estCourante }) {
  if (dateFin <= dateDebut) {
    throw new ErreurApi(400, 'DATES_INVALIDES', 'La fin de l’année doit suivre son début');
  }
  const ecole = await db.ecole.findUnique({ where: { id: ecoleId } });
  const periodes = decouperAnnee(dateDebut, dateFin, ecole.typePeriode);

  return db.$transaction(async (tx) => {
    if (estCourante)
      await tx.anneeScolaire.updateMany({
        where: { estCourante: true },
        data: { estCourante: false },
      });
    const annee = await tx.anneeScolaire.create({
      data: { libelle, dateDebut, dateFin, estCourante },
    });
    await tx.periode.createMany({
      data: periodes.map((p) => ({ ...p, anneeScolaireId: annee.id })),
    });
    return tx.anneeScolaire.findUnique({
      where: { id: annee.id },
      include: { periodes: { orderBy: { numero: 'asc' } } },
    });
  });
}

export async function definirAnneeCourante(db, id) {
  return db.$transaction(async (tx) => {
    const annee = await tx.anneeScolaire.findUnique({ where: { id } });
    if (!annee) throw new ErreurApi(404, 'INTROUVABLE', 'Année scolaire introuvable');
    await tx.anneeScolaire.updateMany({
      where: { estCourante: true },
      data: { estCourante: false },
    });
    return tx.anneeScolaire.update({ where: { id }, data: { estCourante: true } });
  });
}

export async function modifierPeriode(db, id, { dateDebut, dateFin }) {
  const periode = await db.periode.findUnique({ where: { id } });
  if (!periode) throw new ErreurApi(404, 'INTROUVABLE', 'Période introuvable');
  if (periode.estCloturee)
    throw new ErreurApi(409, 'PERIODE_CLOTUREE', 'Une période clôturée ne peut plus être modifiée');
  return db.periode.update({ where: { id }, data: { dateDebut, dateFin } });
}
