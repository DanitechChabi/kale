import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { rendreApp, simulerApi } from '../test/aide.jsx';
import { adresseVerification, titreDocument } from '../lib/releves.js';

const ECOLE = { id: 'e1', nom: 'CEG Les Cocotiers', statutVerification: 'VERIFIEE' };
const SECRETARIAT = {
  id: 's1',
  role: 'SECRETARIAT',
  nom: 'ADJOVI',
  prenoms: 'Rose',
  email: null,
  telephone: '+2290196000111',
  doitChangerMotDePasse: false,
  ecole: ECOLE,
};
const ANNEE = {
  id: 'a1',
  libelle: '2025-2026',
  estCourante: true,
  periodes: [
    { id: 't1', numero: 1, type: 'TRIMESTRE', estCloturee: true },
    { id: 't2', numero: 2, type: 'TRIMESTRE', estCloturee: false },
  ],
};
const eleve = (id, nom, document = null) => ({
  id,
  nom,
  prenoms: 'Test',
  matricule: `2025-000${id}`,
  document,
});

afterEach(() => vi.unstubAllGlobals());

describe('libellés', () => {
  it('nomme les documents et prépare l’adresse de vérification', () => {
    expect(
      titreDocument({ type: 'BULLETIN_PERIODE', periode: { numero: 1, type: 'TRIMESTRE' } }),
    ).toBe('Bulletin du 1er trimestre');
    expect(titreDocument({ type: 'RELEVE_ANNUEL' })).toBe('Relevé annuel');
    expect(adresseVerification(' b26 7k3m ')).toBe('/verifier?numero=B267K3M');
  });
});

describe('bulletins de l’établissement', () => {
  it('délivre les bulletins manquants d’une période clôturée', async () => {
    let generes = false;
    const document = {
      id: 'r1',
      numero: 'B26AAAABBBBC',
      numeroAffiche: 'B26-AAAA-BBBBC',
      genereLe: '2026-01-10',
      versions: 1,
    };
    const { appels } = simulerApi({
      'POST /auth/rafraichir': [200, { jetonAcces: 'j', utilisateur: SECRETARIAT }],
      'GET /classes': [200, { classes: [{ id: 'c1', nom: '6e A' }] }],
      'GET /annees': [200, { annees: [ANNEE] }],
      'GET /releves/classe': () => [
        200,
        {
          classe: { id: 'c1', nom: '6e A' },
          type: 'BULLETIN_PERIODE',
          cloturee: true,
          eleves: [eleve('1', 'AGOSSOU', generes ? document : null), eleve('2', 'DOSSOU', null)],
        },
      ],
      'POST /releves/generation': () => {
        generes = true;
        return [201, { generes: 1, dejaArchives: 0 }];
      },
    });
    rendreApp('/espace/bulletins');

    const bouton = await screen.findByRole('button', { name: 'Délivrer les 2 bulletins' });
    expect(screen.getAllByText('Non délivré')).toHaveLength(2);
    fireEvent.click(bouton);

    expect(await screen.findByText('Documents archivés')).toBeInTheDocument();
    expect(await screen.findByText('B26-AAAA-BBBBC')).toBeInTheDocument();
    const envoi = appels.find((a) => a.cle === 'POST /releves/generation');
    expect(JSON.parse(envoi.options.body)).toEqual({ classeId: 'c1', periodeId: 't1' });
  });

  it('explique qu’une période ouverte doit d’abord être clôturée', async () => {
    simulerApi({
      'POST /auth/rafraichir': [200, { jetonAcces: 'j', utilisateur: SECRETARIAT }],
      'GET /classes': [200, { classes: [{ id: 'c1', nom: '6e A' }] }],
      'GET /annees': [200, { annees: [ANNEE] }],
      'GET /releves/classe': [
        200,
        { classe: { id: 'c1', nom: '6e A' }, type: 'RELEVE_ANNUEL', cloturee: false, eleves: [] },
      ],
    });
    rendreApp('/espace/bulletins?classe=c1&document=annuel');
    expect(await screen.findByText('Année non clôturée')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Délivrer/ })).not.toBeInTheDocument();
  });
});

describe('duplicata en ligne', () => {
  it('envoie la demande et affiche le numéro de suivi', async () => {
    const { appels } = simulerApi({
      'GET /public/etablissements': [
        200,
        { etablissements: [{ id: 'e1', nom: 'CEG Les Cocotiers', commune: 'Cotonou' }] },
      ],
      'POST /public/duplicata': [
        201,
        {
          numeroSuivi: 'D26-4HX9-K2M7Q',
          etablissement: 'CEG Les Cocotiers',
          demandeLe: '2026-10-15T10:00:00Z',
        },
      ],
    });
    rendreApp('/duplicata');

    fireEvent.change(await screen.findByLabelText(/Établissement fréquenté/), {
      target: { value: 'Cocotiers' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /CEG Les Cocotiers/ }));
    fireEvent.change(screen.getByLabelText(/Année scolaire/), { target: { value: '2019-2020' } });
    fireEvent.change(screen.getByLabelText(/^Nom \*/), { target: { value: 'Agossou' } });
    fireEvent.change(screen.getByLabelText(/^Prénoms/), { target: { value: 'Koffi' } });
    fireEvent.change(screen.getByLabelText(/Date de naissance/), {
      target: { value: '2003-06-12' },
    });
    fireEvent.change(screen.getByLabelText(/demandeur/), { target: { value: 'AGOSSOU Koffi' } });
    fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: '0197554433' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));

    expect(await screen.findByText('D26-4HX9-K2M7Q')).toBeInTheDocument();
    const corps = JSON.parse(appels.find((a) => a.cle === 'POST /public/duplicata').options.body);
    expect(corps).toMatchObject({
      ecoleId: 'e1',
      typeDocument: 'BULLETIN_PERIODE',
      numeroPeriode: '1',
      libelleAnnee: '2019-2020',
      nomEleve: 'Agossou',
    });
    // Champs facultatifs vides : non transmis
    expect(corps).not.toHaveProperty('email');
  });

  it('le suivi propose le téléchargement du document délivré', async () => {
    simulerApi({
      'POST /public/duplicata/suivi': [
        200,
        {
          demande: {
            numeroSuivi: 'D26-4HX9-K2M7Q',
            etablissement: 'CEG Les Cocotiers',
            typeDocument: 'RELEVE_ANNUEL',
            libelleAnnee: '2019-2020',
            numeroPeriode: null,
            eleve: 'AGOSSOU Koffi',
            statut: 'DELIVREE',
            demandeLe: '2026-10-15T10:00:00Z',
            priseEnChargeLe: '2026-10-15T11:00:00Z',
            clotureLe: '2026-10-15T12:00:00Z',
            document: { numero: 'R20-AAAA-BBBBC', jetonTelechargement: 'jeton' },
          },
        },
      ],
    });
    rendreApp('/duplicata/suivi?numero=D26-4HX9-K2M7Q');
    fireEvent.change(await screen.findByLabelText(/Téléphone/), {
      target: { value: '0197554433' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Consulter' }));
    const lien = await screen.findByRole('link', { name: /Télécharger le PDF/ });
    expect(lien).toHaveAttribute('href', '/api/public/duplicata/telechargement/jeton');
    expect(screen.getByRole('link', { name: /Page de vérification/ })).toHaveAttribute(
      'href',
      '/verifier/R20-AAAA-BBBBC',
    );
  });
});

describe('espace élève', () => {
  it('liste les documents et signale ceux qui ont été remplacés', async () => {
    simulerApi({
      'POST /auth/rafraichir': [
        200,
        {
          jetonAcces: 'j',
          utilisateur: {
            ...SECRETARIAT,
            id: 'el',
            role: 'ELEVE',
            nom: 'AGOSSOU',
            prenoms: 'Koffi',
          },
        },
      ],
      'GET /releves/mes-documents': [
        200,
        {
          documents: [
            {
              id: 'r2',
              numeroAffiche: 'B26-CCCC-DDDDE',
              type: 'BULLETIN_PERIODE',
              periode: { numero: 1, type: 'TRIMESTRE' },
              anneeScolaire: '2025-2026',
              classe: '6e A',
              moyenneGenerale: 12.5,
              rang: 3,
              effectif: 40,
              genereLe: '2026-01-12',
              remplacePar: null,
              urlVerification: 'https://exemple.bj/verifier/B26-CCCC-DDDDE',
            },
            {
              id: 'r1',
              numeroAffiche: 'B26-AAAA-BBBBC',
              type: 'BULLETIN_PERIODE',
              periode: { numero: 1, type: 'TRIMESTRE' },
              anneeScolaire: '2025-2026',
              classe: '6e A',
              moyenneGenerale: 12.5,
              rang: 3,
              effectif: 40,
              genereLe: '2026-01-10',
              remplacePar: { id: 'r2', numero: 'B26CCCCDDDDE' },
              urlVerification: 'https://exemple.bj/verifier/B26-AAAA-BBBBC',
            },
          ],
        },
      ],
    });
    rendreApp('/espace/mes-documents');
    const cartes = await screen.findAllByRole('listitem');
    await waitFor(() => expect(cartes).toHaveLength(2));
    expect(within(cartes[0]).getByText('Partager le lien de vérification')).toBeInTheDocument();
    expect(within(cartes[1]).getByText(/Remplacé par le document corrigé/)).toBeInTheDocument();
    expect(within(cartes[1]).queryByText('Partager le lien de vérification')).toBeNull();
  });
});
