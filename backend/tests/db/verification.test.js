import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, avecJeton, connecter, creerCompte, creerEcole, PDF, prisma } from './aide.js';

async function ecoleAvecDossier() {
  const ecole = await creerEcole({ statutVerification: 'EN_ATTENTE', statut: 'PUBLIC' });
  const responsable = await creerCompte('ADMIN_ECOLE', { ecoleId: ecole.id });
  const piece = (type) => ({
    ecoleId: ecole.id,
    type,
    nomFichier: `${type}.pdf`,
    cheminFichier: `documents-ecoles/${ecole.id}/${type}.pdf`,
    typeMime: 'application/pdf',
    tailleOctets: PDF.length,
    empreinteSha256: 'c'.repeat(64),
  });
  await prisma.documentEcole.createMany({
    data: [piece('ACTE_NOMINATION_CHEF'), piece('PIECE_IDENTITE_RESPONSABLE')],
  });
  const documents = await prisma.documentEcole.findMany({ where: { ecoleId: ecole.id } });
  return { ecole, responsable, documents };
}

describe('vérification des établissements', () => {
  it('est réservée au ministère et au super-administrateur', async () => {
    const ecole = await creerEcole();
    for (const role of ['ADMIN_ECOLE', 'SECRETARIAT', 'ENSEIGNANT']) {
      const compte = await creerCompte(role, { ecoleId: ecole.id });
      const { jeton } = await connecter(compte);
      const reponse = await request(app).get('/api/verification/ecoles').set(avecJeton(jeton));
      expect(reponse.status, role).toBe(403);
    }
    for (const role of ['MINISTERE', 'SUPER_ADMIN']) {
      const { jeton } = await connecter(await creerCompte(role));
      expect(
        (await request(app).get('/api/verification/ecoles').set(avecJeton(jeton))).status,
      ).toBe(200);
    }
  });

  it('suit le circuit complet : examen des pièces, validation, ouverture des comptes', async () => {
    const { ecole, documents } = await ecoleAvecDossier();
    const enseignant = await creerCompte('ENSEIGNANT', { ecoleId: ecole.id });
    const { jeton } = await connecter(await creerCompte('MINISTERE'));
    const api = (methode, url) => request(app)[methode](url).set(avecJeton(jeton));

    const liste = await api('get', '/api/verification/ecoles?statut=EN_ATTENTE');
    expect(liste.body.ecoles.some((e) => e.id === ecole.id)).toBe(true);

    // Validation impossible tant que les pièces ne sont pas acceptées
    const tropTot = await api('post', `/api/verification/ecoles/${ecole.id}/decision`).send({
      statut: 'VERIFIEE',
    });
    expect(tropTot.status).toBe(409);
    expect(tropTot.body.erreur.code).toBe('PIECES_NON_ACCEPTEES');

    // Un refus de pièce doit être motivé
    const refusSansMotif = await api(
      'patch',
      `/api/verification/documents/${documents[0].id}`,
    ).send({ statut: 'REFUSE' });
    expect(refusSansMotif.status).toBe(400);

    for (const document of documents) {
      const examen = await api('patch', `/api/verification/documents/${document.id}`).send({
        statut: 'ACCEPTE',
      });
      expect(examen.status).toBe(200);
      expect(examen.body.document.statut).toBe('ACCEPTE');
    }

    const decision = await api('post', `/api/verification/ecoles/${ecole.id}/decision`).send({
      statut: 'VERIFIEE',
    });
    expect(decision.status).toBe(200);
    expect(decision.body.ecole.statutVerification).toBe('VERIFIEE');

    // Les comptes de l'établissement peuvent désormais se connecter
    expect((await connecter(enseignant)).reponse.status).toBe(200);

    // Traçabilité
    const journal = await prisma.journalAudit.findMany({ where: { ecoleId: ecole.id } });
    expect(journal.filter((j) => j.entite === 'DocumentEcole')).toHaveLength(2);
    expect(
      journal.some(
        (j) => j.entite === 'Ecole' && j.nouvelleValeur.statutVerification === 'VERIFIEE',
      ),
    ).toBe(true);
  });

  it('exige un motif pour rejeter et permet au responsable de soumettre à nouveau', async () => {
    const { ecole, responsable } = await ecoleAvecDossier();
    const { jeton } = await connecter(await creerCompte('SUPER_ADMIN'));

    const sansMotif = await request(app)
      .post(`/api/verification/ecoles/${ecole.id}/decision`)
      .set(avecJeton(jeton))
      .send({ statut: 'REJETEE' });
    expect(sansMotif.body.erreur.code).toBe('MOTIF_OBLIGATOIRE');

    const rejet = await request(app)
      .post(`/api/verification/ecoles/${ecole.id}/decision`)
      .set(avecJeton(jeton))
      .send({ statut: 'REJETEE', motif: 'Acte de nomination illisible' });
    expect(rejet.body.ecole).toMatchObject({
      statutVerification: 'REJETEE',
      motifDecision: 'Acte de nomination illisible',
    });

    const { jeton: jetonResponsable } = await connecter(responsable);
    const dossier = await request(app)
      .get('/api/mon-ecole/dossier')
      .set(avecJeton(jetonResponsable));
    expect(dossier.body.ecole.motifDecision).toBe('Acte de nomination illisible');

    const ajout = await request(app)
      .post('/api/mon-ecole/dossier/documents')
      .set(avecJeton(jetonResponsable))
      .field('type', 'ACTE_NOMINATION_CHEF')
      .attach('fichier', PDF, 'nomination-lisible.pdf');
    expect(ajout.status).toBe(201);

    const soumission = await request(app)
      .post('/api/mon-ecole/dossier/soumettre')
      .set(avecJeton(jetonResponsable));
    expect(soumission.status).toBe(200);
    expect(soumission.body.ecole.statutVerification).toBe('EN_ATTENTE');
  });

  it('refuse les transitions incohérentes', async () => {
    const ecole = await creerEcole({ statutVerification: 'VERIFIEE' });
    const { jeton } = await connecter(await creerCompte('MINISTERE'));
    const reponse = await request(app)
      .post(`/api/verification/ecoles/${ecole.id}/decision`)
      .set(avecJeton(jeton))
      .send({ statut: 'EN_EXAMEN' });
    expect(reponse.status).toBe(409);

    const suspension = await request(app)
      .post(`/api/verification/ecoles/${ecole.id}/decision`)
      .set(avecJeton(jeton))
      .send({ statut: 'SUSPENDUE', motif: 'Fermeture administrative' });
    expect(suspension.status).toBe(200);
  });
});
