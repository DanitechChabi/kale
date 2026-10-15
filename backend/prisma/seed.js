// Chargement des données de référence nationales (idempotent : peut être relancé).
// - départements et communes du Bénin
// - séries, catalogue des matières et programmes par défaut
// Usage : npm run prisma:seed
import { PrismaClient } from '@prisma/client';
import { departements } from './donnees/geographie.js';
import { matieres, programmes, series } from './donnees/referentiel-pedagogique.js';

const prisma = new PrismaClient();

async function chargerGeographie() {
  for (const { code, nom, communes } of departements) {
    const departement = await prisma.departement.upsert({
      where: { code },
      update: { nom },
      create: { code, nom },
    });
    for (const nomCommune of communes) {
      await prisma.commune.upsert({
        where: { departementId_nom: { departementId: departement.id, nom: nomCommune } },
        update: {},
        create: { nom: nomCommune, departementId: departement.id },
      });
    }
  }
}

async function chargerReferentiel() {
  const idsSeries = {};
  for (const { code, libelle, ordre } of series) {
    const serie = await prisma.serie.upsert({
      where: { code },
      update: { libelle, ordre },
      create: { code, libelle, ordre },
    });
    idsSeries[code] = serie.id;
  }

  const idsMatieres = {};
  for (const { code, nom, nomCourt, ordreAffichage } of matieres) {
    const matiere = await prisma.matiereReference.upsert({
      where: { code },
      update: { nom, nomCourt, ordreAffichage },
      create: { code, nom, nomCourt, ordreAffichage },
    });
    idsMatieres[code] = matiere.id;
  }

  // Les lignes déjà vérifiées par le ministère ne sont jamais écrasées
  for (const p of programmes) {
    const cle = {
      niveau: p.niveau,
      serieId: p.serie ? idsSeries[p.serie] : null,
      matiereReferenceId: idsMatieres[p.matiere],
    };
    const donnees = {
      coefficient: p.coefficient,
      groupeOption: p.groupeOption,
      estFacultative: p.estFacultative,
      source: p.source,
    };
    const existante = await prisma.programmeMatiere.findFirst({ where: cle });
    if (!existante) {
      await prisma.programmeMatiere.create({ data: { ...cle, ...donnees, estVerifie: false } });
    } else if (!existante.estVerifie) {
      await prisma.programmeMatiere.update({ where: { id: existante.id }, data: donnees });
    }
  }
}

try {
  await chargerGeographie();
  await chargerReferentiel();
  const [nbDep, nbCom, nbSeries, nbMat, nbProg] = await Promise.all([
    prisma.departement.count(),
    prisma.commune.count(),
    prisma.serie.count(),
    prisma.matiereReference.count(),
    prisma.programmeMatiere.count(),
  ]);
  console.log(
    `✔ Référentiel chargé : ${nbDep} départements, ${nbCom} communes, ${nbSeries} séries, ${nbMat} matières, ${nbProg} lignes de programme`,
  );
} finally {
  await prisma.$disconnect();
}
