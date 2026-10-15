import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { app, avecJeton, chargerReferentiel, connecter, creerCompte, creerEcole } from './aide.js';

const ctx = {};

async function classeurListe(lignes) {
  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet('Liste');
  feuille.addRow(['CEG LES COCOTIERS']);
  feuille.addRow(['Liste des élèves — année 2025-2026']);
  feuille.addRow([]);
  feuille.addRow([
    'N°',
    'Nom et prénoms',
    'Sexe',
    'Né(e) le',
    'Lieu de naissance',
    'Classe',
    'Tél. parent',
  ]);
  lignes.forEach((l, i) => feuille.addRow([i + 1, ...l]));
  return Buffer.from(await classeur.xlsx.writeBuffer());
}

beforeAll(async () => {
  await chargerReferentiel();
  ctx.ecole = await creerEcole();
  const { jeton } = await connecter(await creerCompte('SECRETARIAT', { ecoleId: ctx.ecole.id }));
  const { jeton: jetonAdmin } = await connecter(
    await creerCompte('ADMIN_ECOLE', { ecoleId: ctx.ecole.id }),
  );
  ctx.jeton = jeton;
  await request(app)
    .post('/api/annees')
    .set(avecJeton(jetonAdmin))
    .send({ libelle: '2025-2026', dateDebut: '2025-10-01', dateFin: '2026-07-15' });
  for (const niveau of ['SIXIEME', 'CINQUIEME']) {
    await request(app).post('/api/classes').set(avecJeton(jetonAdmin)).send({ niveau });
  }
});

const analyser = (contenu, nom = 'liste.xlsx') =>
  request(app)
    .post('/api/import/eleves/analyse')
    .set(avecJeton(ctx.jeton))
    .attach('fichier', contenu, nom);

describe('import d’une liste d’élèves', () => {
  it('analyse une liste réelle sans rien enregistrer', async () => {
    const fichier = await classeurListe([
      [
        'DOSSOU Afi Mireille',
        'F',
        new Date(Date.UTC(2014, 2, 12)),
        'Cotonou',
        '6ème A',
        '97 00 11 22',
      ],
      ['HOUNSOU Koffi', 'G', '05/09/13', 'Abomey', '6e A', ''],
      ['AGBO Rachidatou', 'Féminin', '1er janvier 2013', 'Parakou', '5e A', ''],
      ['DOSSOU Afi Mireille', 'F', '12/03/2014', 'Cotonou', '6e A', ''], // doublon
      ['KPADONOU', 'M', '', '', '6e A', ''], // incomplet
      ['ZINSOU Marc', 'M', '02/02/2012', '', '6e Z', ''], // classe inconnue
    ]);
    const reponse = await analyser(fichier);
    expect(reponse.status).toBe(200);
    expect(reponse.body.resume).toEqual({
      total: 6,
      nouveaux: 4,
      existants: 0,
      erreurs: 1,
      doublons: 1,
    });
    expect(reponse.body.classesInconnues).toEqual(['6e Z']);

    const [afi, koffi] = reponse.body.lignes;
    expect(afi.numero).toBe(5);
    expect(afi.donnees).toMatchObject({
      nom: 'DOSSOU',
      prenoms: 'Afi Mireille',
      sexe: 'F',
      dateNaissance: '2014-03-12',
      telephoneContactParent: '+2290197001122',
    });
    expect(afi.donnees.classeId).toBeTruthy();
    expect(koffi.donnees).toMatchObject({ sexe: 'M', dateNaissance: '2013-09-05' });
    expect(reponse.body.lignes[4].erreurs).toContain('Prénoms manquants');
    ctx.analyse = reponse.body;
  });

  it('importe les lignes valides et inscrit les élèves dans leurs classes', async () => {
    const lignes = ctx.analyse.lignes
      .filter((l) => l.statut === 'nouveau')
      .map((l) => ({ numero: l.numero, ...l.donnees }));
    const reponse = await request(app)
      .post('/api/import/eleves')
      .set(avecJeton(ctx.jeton))
      .send({ lignes });
    expect(reponse.status).toBe(201);
    expect(reponse.body).toMatchObject({ crees: 4, inscrits: 3 });

    const liste = await request(app).get('/api/eleves?parPage=50').set(avecJeton(ctx.jeton));
    expect(liste.body.total).toBe(4);
    expect(liste.body.eleves.map((e) => e.matricule).sort()).toEqual([
      '2025-0001',
      '2025-0002',
      '2025-0003',
      '2025-0004',
    ]);
  });

  it('reconnaît au second passage les élèves déjà enregistrés', async () => {
    const fichier = await classeurListe([
      ['DOSSOU Afi Mireille', 'F', '12/03/2014', 'Cotonou', '6e A', ''],
      ['ZINSOU Marc', 'M', '02/02/2012', '', '5e A', ''],
    ]);
    const reponse = await analyser(fichier);
    expect(reponse.body.resume).toMatchObject({ existants: 2, nouveaux: 0 });
    expect(reponse.body.lignes[0].avertissements[0]).toMatch(/Déjà inscrit en 6e A/);
    expect(reponse.body.lignes[1].avertissements[0]).toMatch(/sera seulement inscrit/);

    // Marc était sans classe : il est inscrit en 5e A, sans nouvelle fiche
    const lignes = reponse.body.lignes.map((l) => ({ numero: l.numero, ...l.donnees }));
    const resultat = await request(app)
      .post('/api/import/eleves')
      .set(avecJeton(ctx.jeton))
      .send({ lignes });
    expect(resultat.body).toMatchObject({ crees: 0, inscrits: 1 });
    expect(resultat.body.ignores).toEqual([{ numero: 5, motif: 'Déjà inscrit cette année' }]);
  });

  it('accepte un CSV avec point-virgule et refuse l’ancien format .xls', async () => {
    const csv = Buffer.from(
      '﻿Nom;Prénoms;Sexe;Date de naissance\nAHOUANDJINOU;Jean-Baptiste;M;05/09/2013\n',
      'utf8',
    );
    const reponse = await analyser(csv, 'liste.csv');
    expect(reponse.status).toBe(200);
    expect(reponse.body.lignes[0].donnees).toMatchObject({
      nom: 'AHOUANDJINOU',
      prenoms: 'Jean-Baptiste',
    });

    const xls = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), Buffer.alloc(100)]);
    const refus = await analyser(xls, 'liste.xls');
    expect(refus.body.erreur.code).toBe('FORMAT_ANCIEN');
  });

  it('explique quand les colonnes ne sont pas reconnues', async () => {
    const reponse = await analyser(Buffer.from('Moyenne;Rang\n12;3\n'), 'notes.csv');
    expect(reponse.status).toBe(400);
    expect(reponse.body.erreur.code).toBe('ENTETES_INTROUVABLES');
  });

  it('fournit un modèle Excel avec la liste des classes', async () => {
    const reponse = await request(app)
      .get('/api/import/eleves/modele')
      .set(avecJeton(ctx.jeton))
      .buffer(true)
      .parse((res, rappel) => {
        const morceaux = [];
        res.on('data', (m) => morceaux.push(m));
        res.on('end', () => rappel(null, Buffer.concat(morceaux)));
      });
    expect(reponse.status).toBe(200);
    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load(reponse.body);
    expect(classeur.getWorksheet('Élèves').getRow(1).getCell(2).value).toBe('NOM');
    const classes = [];
    classeur.getWorksheet('Classes').eachRow((r, i) => i > 1 && classes.push(r.getCell(1).value));
    expect(classes).toEqual(['6e A', '5e A']);
  });
});
