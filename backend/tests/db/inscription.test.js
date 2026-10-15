import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, avecJeton, communeTest, PDF, PNG, prisma, unique } from './aide.js';

async function donneesInscription(surcharges = {}) {
  const commune = await communeTest();
  return {
    ecole: {
      code: `ceg-${unique()}`,
      nom: 'CEG Les Cocotiers',
      statut: 'PRIVE_LAIC',
      type: 'COMPLEXE_SCOLAIRE',
      ordres: ['GENERAL', 'TECHNIQUE', 'GENERAL'],
      nomChefEtablissement: 'M. Comlan HOUNSA',
      communeId: commune.id,
      telephone: '21 30 00 00',
      ...surcharges.ecole,
    },
    responsable: {
      nom: 'Agossou',
      prenoms: 'Brice',
      telephone: `9${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`,
      email: `brice.${unique()}@test.bj`,
      motDePasse: 'Ouidah2026',
      ...surcharges.responsable,
    },
    references: {
      AUTORISATION_CREATION_OUVERTURE: {
        referenceActe: 'N°2019-045/MESTFP',
        dateActe: '2019-08-12',
      },
    },
  };
}

const deposer = (donnees, pieces) => {
  const requete = request(app)
    .post('/api/inscription-ecole')
    .field('donnees', JSON.stringify(donnees));
  for (const [type, contenu, nom] of pieces) requete.attach(type, contenu, nom);
  return requete;
};

const PIECES_PRIVE = [
  ['AUTORISATION_CREATION_OUVERTURE', PDF, 'arrêté ouverture.pdf'],
  ['AUTORISATION_DIRIGER', PDF, 'autorisation.pdf'],
  ['PIECE_IDENTITE_RESPONSABLE', PNG, 'cni.png'],
];

describe('inscription d’un établissement', () => {
  it('crée l’établissement en attente, le compte du responsable et les pièces', async () => {
    const donnees = await donneesInscription();
    const reponse = await deposer(donnees, PIECES_PRIVE);
    expect(reponse.status).toBe(201);
    expect(reponse.body.ecole.statutVerification).toBe('EN_ATTENTE');

    const ecole = await prisma.ecole.findUnique({
      where: { id: reponse.body.ecole.id },
      include: { documents: true, utilisateurs: true },
    });
    expect(ecole.code).toBe(donnees.ecole.code.toUpperCase());
    expect(ecole.ordres).toEqual(['GENERAL', 'TECHNIQUE']);
    expect(ecole.telephone).toBe('+2290121300000');
    expect(ecole.utilisateurs).toHaveLength(1);
    expect(ecole.utilisateurs[0].role).toBe('ADMIN_ECOLE');
    expect(ecole.documents).toHaveLength(3);
    const arrete = ecole.documents.find((d) => d.type === 'AUTORISATION_CREATION_OUVERTURE');
    expect(arrete).toMatchObject({
      nomFichier: 'arrêté ouverture.pdf',
      typeMime: 'application/pdf',
      referenceActe: 'N°2019-045/MESTFP',
    });
    expect(arrete.empreinteSha256).toMatch(/^[0-9a-f]{64}$/);

    // Le responsable peut se connecter et consulter son dossier
    const connexion = await request(app)
      .post('/api/auth/connexion')
      .send({ identifiant: donnees.responsable.email, motDePasse: 'Ouidah2026' });
    const dossier = await request(app)
      .get('/api/mon-ecole/dossier')
      .set(avecJeton(connexion.body.jetonAcces));
    expect(dossier.status).toBe(200);
    expect(dossier.body.ecole.statutVerification).toBe('EN_ATTENTE');
    expect(dossier.body.documents).toHaveLength(3);

    const fichier = await request(app)
      .get(`/api/mon-ecole/dossier/documents/${arrete.id}/fichier`)
      .set(avecJeton(connexion.body.jetonAcces));
    expect(fichier.status).toBe(200);
    expect(fichier.headers['content-type']).toBe('application/pdf');
    expect(Buffer.from(fichier.body).equals(PDF)).toBe(true);
  });

  it('refuse un dossier incomplet en listant les pièces manquantes', async () => {
    const reponse = await deposer(await donneesInscription(), PIECES_PRIVE.slice(0, 1));
    expect(reponse.status).toBe(400);
    expect(reponse.body.erreur.details.manquantes).toEqual([
      'AUTORISATION_DIRIGER',
      'PIECE_IDENTITE_RESPONSABLE',
    ]);
  });

  it('exige l’acte de nomination pour un établissement public', async () => {
    const donnees = await donneesInscription({ ecole: { statut: 'PUBLIC', type: 'CEG' } });
    const refus = await deposer(donnees, PIECES_PRIVE);
    expect(refus.body.erreur.details.manquantes).toEqual(['ACTE_NOMINATION_CHEF']);
    const accepte = await deposer(donnees, [
      ['ACTE_NOMINATION_CHEF', PDF, 'nomination.pdf'],
      ['PIECE_IDENTITE_RESPONSABLE', PDF, 'cni.pdf'],
    ]);
    expect(accepte.status).toBe(201);
  });

  it('refuse un fichier déguisé (contenu qui n’est ni PDF ni image)', async () => {
    const pieces = [...PIECES_PRIVE];
    pieces[1] = ['AUTORISATION_DIRIGER', Buffer.from('<script>alert(1)</script>'), 'faux.pdf'];
    const reponse = await deposer(await donneesInscription(), pieces);
    expect(reponse.status).toBe(400);
    expect(reponse.body.erreur.code).toBe('FICHIER_INVALIDE');
  });

  it('valide les données du formulaire', async () => {
    const donnees = await donneesInscription({
      responsable: { motDePasse: 'faible', telephone: '12' },
      ecole: { ordres: [] },
    });
    const reponse = await deposer(donnees, PIECES_PRIVE);
    expect(reponse.status).toBe(400);
    const champs = reponse.body.erreur.details.map((d) => d.champ);
    expect(champs).toEqual(
      expect.arrayContaining(['ecole.ordres', 'responsable.motDePasse', 'responsable.telephone']),
    );
  });

  it('refuse un code d’établissement ou un téléphone déjà utilisé', async () => {
    const donnees = await donneesInscription();
    expect((await deposer(donnees, PIECES_PRIVE)).status).toBe(201);

    const memeCode = await deposer(
      {
        ...donnees,
        responsable: { ...donnees.responsable, telephone: '0196000000', email: undefined },
      },
      PIECES_PRIVE,
    );
    expect(memeCode.status).toBe(409);
    expect(memeCode.body.erreur.code).toBe('ECOLE_EXISTANTE');

    const memeTelephone = await deposer(
      { ...donnees, ecole: { ...donnees.ecole, code: `autre-${unique()}` } },
      PIECES_PRIVE,
    );
    expect(memeTelephone.status).toBe(409);
    expect(memeTelephone.body.erreur.code).toBe('IDENTIFIANT_DEJA_UTILISE');
  });

  it('liste les départements et communes pour le formulaire', async () => {
    await communeTest();
    const reponse = await request(app).get('/api/referentiel/departements');
    expect(reponse.status).toBe(200);
    expect(reponse.body.departements.find((d) => d.code === 'AQ').communes.length).toBeGreaterThan(
      0,
    );
  });
});
