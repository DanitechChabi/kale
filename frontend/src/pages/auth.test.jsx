import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { rendreApp, simulerApi, UTILISATEUR_MINISTERE } from '../test/aide.jsx';

const remplir = (libelle, valeur) =>
  fireEvent.change(screen.getByLabelText(libelle), { target: { value: valeur } });

describe('connexion et accès', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renvoie vers la connexion quand on ouvre l’espace sans session', async () => {
    simulerApi();
    rendreApp('/espace');
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
  });

  it('connecte puis ouvre l’espace adapté au rôle', async () => {
    const { appels } = simulerApi({
      'POST /auth/connexion': [
        200,
        { jetonAcces: 'jeton-test', utilisateur: UTILISATEUR_MINISTERE },
      ],
      'GET /verification/ecoles': [
        200,
        { total: 0, page: 1, parPage: 20, compteurs: {}, ecoles: [] },
      ],
    });
    rendreApp('/connexion');
    await screen.findByRole('heading', { name: 'Connexion' });

    remplir(/E-mail ou téléphone/, '01 96 00 05 55');
    remplir(/^Mot de passe/, 'Cotonou2026');
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(
      await screen.findByRole('heading', { name: 'Vérification des établissements' }),
    ).toBeInTheDocument();
    const connexion = appels.find((a) => a.cle === 'POST /auth/connexion');
    expect(JSON.parse(connexion.options.body)).toEqual({
      identifiant: '01 96 00 05 55',
      motDePasse: 'Cotonou2026',
    });
    // Le jeton d'accès accompagne les appels suivants
    const liste = appels.find((a) => a.cle === 'GET /verification/ecoles');
    expect(liste.options.headers.Authorization).toBe('Bearer jeton-test');
  });

  it('affiche un message clair en cas d’identifiants incorrects', async () => {
    simulerApi({
      'POST /auth/connexion': [
        401,
        {
          erreur: {
            code: 'IDENTIFIANTS_INVALIDES',
            message: 'Identifiant ou mot de passe incorrect',
          },
        },
      ],
    });
    rendreApp('/connexion');
    await screen.findByRole('heading', { name: 'Connexion' });
    remplir(/E-mail ou téléphone/, 'x@test.bj');
    remplir(/^Mot de passe/, 'mauvais');
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Identifiant ou mot de passe incorrect',
    );
  });

  it('impose le changement d’un mot de passe temporaire', async () => {
    simulerApi({
      'POST /auth/rafraichir': [
        200,
        { jetonAcces: 'j', utilisateur: { ...UTILISATEUR_MINISTERE, doitChangerMotDePasse: true } },
      ],
    });
    rendreApp('/espace/verification');
    expect(
      await screen.findByRole('heading', { name: 'Choisissez votre mot de passe' }),
    ).toBeInTheDocument();
  });

  it('refuse une page réservée à un autre rôle', async () => {
    simulerApi({
      'POST /auth/rafraichir': [
        200,
        {
          jetonAcces: 'j',
          utilisateur: {
            ...UTILISATEUR_MINISTERE,
            role: 'ENSEIGNANT',
            ecole: { id: 'e', nom: 'CEG Test', statutVerification: 'VERIFIEE' },
          },
        },
      ],
    });
    rendreApp('/espace/verification');
    expect(await screen.findByRole('heading', { name: /Bonjour Pascal/ })).toBeInTheDocument();
  });
});

describe('inscription d’un établissement', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('contrôle chaque étape avant de passer à la suivante', async () => {
    simulerApi({
      'GET /referentiel/departements': [
        200,
        {
          departements: [
            {
              id: 'd1',
              code: 'AQ',
              nom: 'Atlantique',
              communes: [{ id: 'c1', nom: 'Abomey-Calavi' }],
            },
          ],
        },
      ],
    });
    rendreApp('/inscription-ecole');
    await screen.findByLabelText(/Nom de l’établissement/);

    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));
    expect(await screen.findByText('Indiquez le nom de l’établissement')).toBeInTheDocument();
    expect(screen.getByText('Choisissez la commune')).toBeInTheDocument();

    remplir(/Nom de l’établissement/, 'CEG Les Cocotiers');
    remplir(/Code officiel/, 'CEG-001');
    fireEvent.click(screen.getByLabelText(/Privé laïc/));
    fireEvent.change(screen.getByLabelText(/^Type/), { target: { value: 'CEG' } });
    remplir(/Chef d’établissement/, 'M. Comlan HOUNSA');
    fireEvent.change(screen.getByLabelText(/Département/), { target: { value: 'd1' } });
    fireEvent.change(screen.getByLabelText(/^Commune/), { target: { value: 'c1' } });
    remplir(/Téléphone de l’établissement/, '01 21 30 00 00');
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));

    expect(await screen.findByLabelText(/^Prénoms/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Responsable'),
    );
  });
});
