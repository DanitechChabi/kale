// Phase 9 : tableau de bord du ministère (agrégats par zone, lecture seule).
// Année fictive propre à chaque exécution : aucune autre donnée n'y figure.
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  app,
  avecJeton,
  chargerReferentiel,
  connecter,
  creerCompte,
  creerEcole,
  creerEleve,
  prisma,
  unique,
} from './aide.js';
import { genererNumero } from '../../src/utils/numeroDocument.js';

const AN = 2100 + Math.floor(Math.random() * 800);
const ANNEE = `${AN}-${AN + 1}`;
const ctx = {};
const empreinte = () => createHash('sha256').update(unique()).digest('hex');
const jour = (s) => new Date(`${s}T00:00:00Z`);

/** Établissement de la commune donnée, avec une classe, des élèves et leurs bulletins. */
async function etablissement(nomCommune, { moyennes, sexes, absents, duplicata }) {
  const commune = await prisma.commune.findFirst({ where: { nom: nomCommune } });
  const ecole = await creerEcole();
  await prisma.ecole.update({ where: { id: ecole.id }, data: { communeId: commune.id } });
  const admin = await creerCompte('ADMIN_ECOLE', { ecoleId: ecole.id });
  const annee = await prisma.anneeScolaire.create({
    data: {
      ecoleId: ecole.id,
      libelle: ANNEE,
      dateDebut: jour(`${AN}-09-15`),
      dateFin: jour(`${AN + 1}-07-10`),
      periodes: {
        create: [1, 2, 3].map((numero) => ({
          ecoleId: ecole.id,
          type: 'TRIMESTRE',
          numero,
          dateDebut: jour(`${AN}-09-15`),
          dateFin: jour(`${AN}-12-20`),
        })),
      },
    },
    include: { periodes: { orderBy: { numero: 'asc' } } },
  });
  const t1 = annee.periodes[0];
  await prisma.periode.update({
    where: { id: t1.id },
    data: { estCloturee: true, clotureeLe: new Date(`${AN}-12-20T10:00:00Z`) },
  });
  const classe = await prisma.classe.create({
    data: {
      ecoleId: ecole.id,
      anneeScolaireId: annee.id,
      niveau: 'SIXIEME',
      nom: `6e ${unique()}`,
    },
  });
  const eleves = [];
  for (const [i, moyenne] of moyennes.entries()) {
    const eleve = await creerEleve(ecole.id);
    await prisma.eleve.update({ where: { id: eleve.id }, data: { sexe: sexes[i] } });
    await prisma.inscription.create({
      data: {
        ecoleId: ecole.id,
        eleveId: eleve.id,
        classeId: classe.id,
        anneeScolaireId: annee.id,
      },
    });
    // Bulletin du 1er trimestre archivé deux jours après la clôture
    const releve = await prisma.releveArchive.create({
      data: {
        ecoleId: ecole.id,
        numero: genererNumero('B', AN + 1),
        type: 'BULLETIN_PERIODE',
        eleveId: eleve.id,
        anneeScolaireId: annee.id,
        periodeId: t1.id,
        cheminFichier: `releves/test/${unique()}.pdf`,
        empreinteSha256: empreinte(),
        tailleOctets: 1000,
        donnees: { resultats: { moyenneGenerale: moyenne } },
        genereParId: admin.id,
        genereLe: new Date(`${AN}-12-22T10:00:00Z`),
      },
    });
    eleves.push({ ...eleve, releveId: releve.id });
  }
  // Un appel : `absents` élèves absents sur l'effectif de la classe
  const appel = await prisma.appel.create({
    data: {
      ecoleId: ecole.id,
      classeId: classe.id,
      date: jour(`${AN}-10-05`),
      heureDebut: new Date('1970-01-01T08:00:00Z'),
      faitParId: admin.id,
    },
  });
  for (const eleve of eleves.slice(0, absents)) {
    await prisma.presence.create({
      data: { ecoleId: ecole.id, appelId: appel.id, eleveId: eleve.id, statut: 'ABSENT' },
    });
  }
  if (duplicata) {
    await prisma.demandeDuplicata.create({
      data: {
        ecoleId: ecole.id,
        numeroSuivi: `D${unique()}`.toUpperCase(),
        nomDemandeur: 'Ancien élève',
        telephone: '+2290197000000',
        typeDocument: 'BULLETIN_PERIODE',
        nomEleve: 'ANCIEN',
        prenomsEleve: 'Élève',
        dateNaissance: jour('2000-01-01'),
        libelleAnnee: '2015-2016',
        statut: 'DELIVREE',
        eleveId: eleves[0].id,
        releveId: eleves[0].releveId,
        traiteParId: admin.id,
        demandeLe: new Date(`${AN}-11-02T08:00:00Z`),
        clotureLe: new Date(new Date(`${AN}-11-02T08:00:00Z`).getTime() + duplicata * 3600e3),
      },
    });
  }
  return { ecole, commune };
}

const api = (jeton, url) => request(app).get(url).set(avecJeton(jeton));

beforeAll(async () => {
  await chargerReferentiel();
  // Parakou (Borgou) : 4 élèves, moyennes 8, 12, 14, 10 ; 1 absent ; duplicata en 24 h
  ctx.parakou = await etablissement('Parakou', {
    moyennes: [8, 12, 14, 10],
    sexes: ['F', 'M', 'F', 'M'],
    absents: 1,
    duplicata: 24,
  });
  // Cotonou (Littoral) : 2 élèves, moyennes 6 et 9 ; 2 absents ; duplicata en 120 h
  ctx.cotonou = await etablissement('Cotonou', {
    moyennes: [6, 9],
    sexes: ['F', 'F'],
    absents: 2,
    duplicata: 120,
  });
  ctx.jeton = (await connecter(await creerCompte('MINISTERE'))).jeton;
});

describe('tableau de bord du ministère', () => {
  it('agrège tout le pays, pondéré par élève', async () => {
    const { status, body } = await api(ctx.jeton, `/api/ministere/tableau-de-bord?annee=${ANNEE}`);
    expect(status).toBe(200);
    expect(body.annees).toContain(ANNEE);
    expect(body.zone).toEqual({ niveau: 'NATIONAL', nom: 'Bénin' });
    expect(body.sourceReussite).toBe('TRIMESTRE-1');
    expect(body.synthese).toMatchObject({
      effectif: 6,
      filles: 4,
      elevesEvalues: 6,
      moyenneGenerale: 9.83, // (8+12+14+10+6+9)/6, pas la moyenne des deux écoles
      tauxReussite: 50, // 12, 14, 10 sur 6 élèves
      tauxAbsence: 50, // 3 absents sur 6 attendus
      documentsDelivres: 6,
      delaiBulletinJours: 2,
      duplicatas: { demandes: 2, delivres: 2, delaiMoyenHeures: 72, partSous72h: 50 },
    });
    expect(body.effectifsParNiveau.find((n) => n.niveau === 'SIXIEME').effectif).toBe(6);
    expect(body.resultatsParPeriode).toEqual([
      { cle: 'TRIMESTRE-1', elevesEvalues: 6, moyenneGenerale: 9.83, tauxReussite: 50 },
    ]);
    // Carte : chaque département, détail = départements
    const borgou = body.parDepartement.find((d) => d.code === 'BO');
    expect(borgou).toMatchObject({ effectif: 4, moyenneGenerale: 11, tauxReussite: 75 });
    expect(body.parDepartement).toHaveLength(12);
    expect(body.detail.map((d) => d.type)).toEqual(Array(12).fill('DEPARTEMENT'));
  });

  it('descend par département, commune puis établissement', async () => {
    const borgou = await prisma.departement.findUnique({ where: { code: 'BO' } });
    const dep = await api(
      ctx.jeton,
      `/api/ministere/tableau-de-bord?annee=${ANNEE}&departementId=${borgou.id}`,
    );
    expect(dep.body.zone).toEqual({ niveau: 'DEPARTEMENT', nom: borgou.nom });
    expect(dep.body.synthese).toMatchObject({ effectif: 4, tauxAbsence: 25 });
    expect(dep.body.detail.find((c) => c.nom === 'Parakou')).toMatchObject({
      type: 'COMMUNE',
      effectif: 4,
    });

    const commune = await api(
      ctx.jeton,
      `/api/ministere/tableau-de-bord?annee=${ANNEE}&departementId=${borgou.id}&communeId=${ctx.parakou.commune.id}`,
    );
    const ligne = commune.body.detail.find((e) => e.id === ctx.parakou.ecole.id);
    expect(ligne).toMatchObject({ type: 'ETABLISSEMENT', effectif: 4, partFilles: 50 });

    const ecole = await api(
      ctx.jeton,
      `/api/ministere/tableau-de-bord?annee=${ANNEE}&ecoleId=${ctx.cotonou.ecole.id}`,
    );
    expect(ecole.body.zone.niveau).toBe('ETABLISSEMENT');
    expect(ecole.body.synthese).toMatchObject({
      etablissements: 1,
      effectif: 2,
      tauxReussite: 0,
      duplicatas: { delaiMoyenHeures: 120, partSous72h: 0 },
    });
    expect(ecole.body.detail).toEqual([]);
  });

  it('ne compte qu’une fois un bulletin corrigé (version en vigueur)', async () => {
    const ancien = await prisma.releveArchive.findFirst({
      where: {
        ecoleId: ctx.cotonou.ecole.id,
        donnees: { path: ['resultats', 'moyenneGenerale'], equals: 9 },
      },
    });
    await prisma.releveArchive.create({
      data: {
        ...Object.fromEntries(
          Object.entries(ancien).filter(
            ([k]) => !['id', 'remplaceReleveId', 'motifCorrection'].includes(k),
          ),
        ),
        numero: genererNumero('B', AN + 1),
        empreinteSha256: empreinte(),
        donnees: { resultats: { moyenneGenerale: 10.5 } },
        remplaceReleveId: ancien.id,
        motifCorrection: 'Erreur de saisie',
      },
    });
    const { body } = await api(
      ctx.jeton,
      `/api/ministere/tableau-de-bord?annee=${ANNEE}&ecoleId=${ctx.cotonou.ecole.id}`,
    );
    expect(body.synthese).toMatchObject({
      elevesEvalues: 2,
      moyenneGenerale: 8.25,
      tauxReussite: 50,
      corrections: 1,
    });
  });

  it('exporte le détail en CSV pour un tableur', async () => {
    const reponse = await api(ctx.jeton, `/api/ministere/tableau-de-bord.csv?annee=${ANNEE}`);
    expect(reponse.status).toBe(200);
    expect(reponse.headers['content-type']).toContain('text/csv');
    const lignes = reponse.text.replace(/^\uFEFF/, '').split('\r\n');
    expect(lignes[0]).toContain('Taux de réussite (%)');
    expect(lignes).toHaveLength(13);
    expect(lignes.find((l) => l.startsWith('Borgou'))).toContain(';4;50;4;11;75;25;');
  });

  it('reste réservé aux comptes nationaux', async () => {
    const admin = await creerCompte('ADMIN_ECOLE', { ecoleId: ctx.parakou.ecole.id });
    const refus = await api((await connecter(admin)).jeton, '/api/ministere/tableau-de-bord');
    expect(refus.status).toBe(403);
    const anonyme = await request(app).get('/api/ministere/tableau-de-bord');
    expect(anonyme.status).toBe(401);
    const inconnue = await api(ctx.jeton, '/api/ministere/tableau-de-bord?annee=1990-1991');
    expect(inconnue.status).toBe(404);
  });
});
