// Vérifie les règles métier garanties par PostgreSQL (contraintes et triggers),
// indépendamment du code applicatif.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ctx = {};
const empreinte = (c) => c.repeat(64);

beforeAll(async () => {
  const departement = await prisma.departement.create({ data: { code: 'AQ', nom: 'Atlantique' } });
  const commune = await prisma.commune.create({
    data: { nom: 'Abomey-Calavi', departementId: departement.id },
  });
  ctx.ecole = await prisma.ecole.create({
    data: {
      code: 'TEST-001',
      nom: 'CEG Test',
      statut: 'PUBLIC',
      type: 'CEG',
      ordres: ['GENERAL'],
      communeId: commune.id,
    },
  });
  ctx.enseignant = await prisma.utilisateur.create({
    data: {
      ecoleId: ctx.ecole.id,
      role: 'ENSEIGNANT',
      nom: 'AHOUNOU',
      prenoms: 'Marc',
      email: 'marc@test.bj',
      motDePasseHash: 'x',
    },
  });
  ctx.annee = await prisma.anneeScolaire.create({
    data: {
      ecoleId: ctx.ecole.id,
      libelle: '2025-2026',
      dateDebut: new Date('2025-10-01'),
      dateFin: new Date('2026-07-15'),
      estCourante: true,
    },
  });
  ctx.periode = await prisma.periode.create({
    data: {
      ecoleId: ctx.ecole.id,
      anneeScolaireId: ctx.annee.id,
      type: 'TRIMESTRE',
      numero: 1,
      dateDebut: new Date('2025-10-01'),
      dateFin: new Date('2025-12-20'),
    },
  });
  ctx.classe = await prisma.classe.create({
    data: { ecoleId: ctx.ecole.id, anneeScolaireId: ctx.annee.id, niveau: 'SIXIEME', nom: '6e A' },
  });
  const matiere = await prisma.matiere.create({
    data: { ecoleId: ctx.ecole.id, code: 'MATH', nom: 'Mathématiques' },
  });
  ctx.enseignement = await prisma.enseignement.create({
    data: {
      ecoleId: ctx.ecole.id,
      classeId: ctx.classe.id,
      matiereId: matiere.id,
      coefficient: 3,
      enseignantId: ctx.enseignant.id,
    },
  });
  ctx.evaluation = await prisma.evaluation.create({
    data: {
      ecoleId: ctx.ecole.id,
      enseignementId: ctx.enseignement.id,
      periodeId: ctx.periode.id,
      type: 'DEVOIR',
      libelle: 'Devoir 1',
      date: new Date('2025-11-10'),
      creeParId: ctx.enseignant.id,
    },
  });
  ctx.eleve = await prisma.eleve.create({
    data: {
      ecoleId: ctx.ecole.id,
      matricule: '2025-0001',
      nom: 'DOSSOU',
      prenoms: 'Afi',
      sexe: 'F',
      dateNaissance: new Date('2013-03-02'),
    },
  });
  ctx.eleve2 = await prisma.eleve.create({
    data: {
      ecoleId: ctx.ecole.id,
      matricule: '2025-0002',
      nom: 'HOUNSOU',
      prenoms: 'Koffi',
      sexe: 'M',
      dateNaissance: new Date('2013-07-19'),
    },
  });
});

afterAll(() => prisma.$disconnect());

const note = (eleveId, valeur) =>
  prisma.note.create({
    data: {
      ecoleId: ctx.ecole.id,
      evaluationId: ctx.evaluation.id,
      eleveId,
      valeur,
      saisieParId: ctx.enseignant.id,
    },
  });

describe('comptes utilisateurs', () => {
  it('refuse un compte d’établissement sans école', async () => {
    await expect(
      prisma.utilisateur.create({
        data: {
          role: 'ENSEIGNANT',
          nom: 'X',
          prenoms: 'Y',
          email: 'a@test.bj',
          motDePasseHash: 'x',
        },
      }),
    ).rejects.toThrow(/utilisateurs_ecole_selon_role/);
  });

  it('refuse un parent rattaché à une école', async () => {
    await expect(
      prisma.utilisateur.create({
        data: {
          role: 'PARENT',
          ecoleId: ctx.ecole.id,
          nom: 'X',
          prenoms: 'Y',
          telephone: '+22990000001',
          motDePasseHash: 'x',
        },
      }),
    ).rejects.toThrow(/utilisateurs_ecole_selon_role/);
  });

  it('refuse un compte sans e-mail ni téléphone', async () => {
    await expect(
      prisma.utilisateur.create({
        data: { role: 'MINISTERE', nom: 'X', prenoms: 'Y', motDePasseHash: 'x' },
      }),
    ).rejects.toThrow(/utilisateurs_identifiant_requis/);
  });
});

describe('organisation scolaire', () => {
  it('refuse une seconde année courante pour la même école', async () => {
    await expect(
      prisma.anneeScolaire.create({
        data: {
          ecoleId: ctx.ecole.id,
          libelle: '2026-2027',
          dateDebut: new Date('2026-10-01'),
          dateFin: new Date('2027-07-15'),
          estCourante: true,
        },
      }),
    ).rejects.toThrow();
  });

  it('exige une série au second cycle et l’interdit au premier', async () => {
    const serie = await prisma.serie.create({
      data: { code: 'D', libelle: 'Biologie - Géologie', ordre: 'GENERAL' },
    });
    const base = { ecoleId: ctx.ecole.id, anneeScolaireId: ctx.annee.id };
    await expect(
      prisma.classe.create({ data: { ...base, niveau: 'SECONDE', nom: '2nde X' } }),
    ).rejects.toThrow(/classes_serie_selon_niveau/);
    await expect(
      prisma.classe.create({
        data: { ...base, niveau: 'SIXIEME', nom: '6e X', serieId: serie.id },
      }),
    ).rejects.toThrow(/classes_serie_selon_niveau/);
    await expect(
      prisma.classe.create({
        data: { ...base, niveau: 'SECONDE', nom: '2nde D1', serieId: serie.id },
      }),
    ).resolves.toBeTruthy();
  });

  it('interdit une matière en double dans le programme du premier cycle', async () => {
    const matiere = await prisma.matiereReference.create({
      data: { code: 'FR', nom: 'Français', nomCourt: 'Français' },
    });
    const ligne = { niveau: 'SIXIEME', matiereReferenceId: matiere.id, coefficient: 2 };
    await prisma.programmeMatiere.create({ data: ligne });
    await expect(prisma.programmeMatiere.create({ data: ligne })).rejects.toThrow();
  });

  it('exige des minutes de retard pour un retard, et seulement dans ce cas', async () => {
    const appel = await prisma.appel.create({
      data: {
        ecoleId: ctx.ecole.id,
        classeId: ctx.classe.id,
        date: new Date('2025-11-03'),
        heureDebut: new Date('1970-01-01T08:00:00Z'),
        faitParId: ctx.enseignant.id,
      },
    });
    const presence = (statut, minutesRetard) =>
      prisma.presence.create({
        data: {
          ecoleId: ctx.ecole.id,
          appelId: appel.id,
          eleveId: ctx.eleve.id,
          statut,
          minutesRetard,
        },
      });
    await expect(presence('RETARD', null)).rejects.toThrow(/presences_retard/);
    await expect(presence('ABSENT', 10)).rejects.toThrow(/presences_retard/);
    await expect(presence('RETARD', 10)).resolves.toBeTruthy();
  });
});

describe('notes et clôture de période', () => {
  it('refuse une note supérieure au barème', async () => {
    await expect(note(ctx.eleve.id, 21)).rejects.toThrow(/barème/);
  });

  it('accepte une note valide puis la bloque après clôture', async () => {
    const n = await note(ctx.eleve.id, 14.5);
    await prisma.periode.update({
      where: { id: ctx.periode.id },
      data: { estCloturee: true, clotureeLe: new Date() },
    });

    await expect(prisma.note.update({ where: { id: n.id }, data: { valeur: 18 } })).rejects.toThrow(
      /clôturée/,
    );
    await expect(prisma.note.delete({ where: { id: n.id } })).rejects.toThrow(/clôturée/);
    await expect(note(ctx.eleve2.id, 12)).rejects.toThrow(/clôturée/);
  });

  it('refuse toute nouvelle évaluation dans une période clôturée', async () => {
    await expect(
      prisma.evaluation.create({
        data: {
          ecoleId: ctx.ecole.id,
          enseignementId: ctx.enseignement.id,
          periodeId: ctx.periode.id,
          type: 'INTERROGATION',
          libelle: 'Interro tardive',
          date: new Date('2025-12-18'),
          creeParId: ctx.enseignant.id,
        },
      }),
    ).rejects.toThrow(/clôturée/);
  });

  it('interdit de rouvrir une période clôturée', async () => {
    await expect(
      prisma.periode.update({ where: { id: ctx.periode.id }, data: { estCloturee: false } }),
    ).rejects.toThrow(/rouverte/);
  });
});

describe('tables en ajout seul', () => {
  it('interdit de modifier ou supprimer un relevé archivé', async () => {
    const releve = await prisma.releveArchive.create({
      data: {
        ecoleId: ctx.ecole.id,
        numero: 'ER-2026-000001',
        type: 'BULLETIN_PERIODE',
        eleveId: ctx.eleve.id,
        anneeScolaireId: ctx.annee.id,
        periodeId: ctx.periode.id,
        cheminFichier: 'releves/test.pdf',
        empreinteSha256: empreinte('a'),
        tailleOctets: 1024,
        donnees: { moyenne: 14.5 },
        genereParId: ctx.enseignant.id,
      },
    });
    await expect(
      prisma.releveArchive.update({ where: { id: releve.id }, data: { tailleOctets: 1 } }),
    ).rejects.toThrow(/ni modifiés ni supprimés/);
    await expect(prisma.releveArchive.delete({ where: { id: releve.id } })).rejects.toThrow(
      /ni modifiés ni supprimés/,
    );
  });

  it('exige un motif pour un relevé correctif', async () => {
    const [ancien] = await prisma.releveArchive.findMany({ take: 1 });
    await expect(
      prisma.releveArchive.create({
        data: {
          ecoleId: ctx.ecole.id,
          numero: 'ER-2026-000002',
          type: 'BULLETIN_PERIODE',
          eleveId: ctx.eleve.id,
          anneeScolaireId: ctx.annee.id,
          periodeId: ctx.periode.id,
          cheminFichier: 'releves/test2.pdf',
          empreinteSha256: empreinte('b'),
          tailleOctets: 1024,
          donnees: {},
          genereParId: ctx.enseignant.id,
          remplaceReleveId: ancien.id,
        },
      }),
    ).rejects.toThrow(/releves_motif_si_correction/);
  });

  it('interdit de modifier ou supprimer le journal d’audit', async () => {
    const entree = await prisma.journalAudit.create({
      data: {
        ecoleId: ctx.ecole.id,
        utilisateurId: ctx.enseignant.id,
        action: 'CREATION',
        entite: 'Note',
        entiteId: ctx.eleve.id,
        nouvelleValeur: { valeur: 14.5 },
      },
    });
    await expect(
      prisma.journalAudit.update({ where: { id: entree.id }, data: { entite: 'Autre' } }),
    ).rejects.toThrow(/ni modifiés ni supprimés/);
    await expect(prisma.journalAudit.delete({ where: { id: entree.id } })).rejects.toThrow(
      /ni modifiés ni supprimés/,
    );
  });
});
