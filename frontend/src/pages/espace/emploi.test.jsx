import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { rendreApp, simulerApi } from '../../test/aide.jsx';
import { abandonnerEnvoi, fileEnAttente } from '../../lib/horsLigne.js';
import { enHeure, enMinutes, heureLisible, teinteMatiere } from '../../lib/emploiDuTemps.js';

const ecole = { id: 'ec1', nom: 'CEG Les Cocotiers', statutVerification: 'VERIFIEE' };
const compte = (role) => ({
  id: `u-${role}`,
  role,
  nom: 'TEST',
  prenoms: 'Compte',
  email: null,
  telephone: '+2290196000000',
  doitChangerMotDePasse: false,
  ecole,
});
const CRENEAU = {
  id: 'cr1',
  jour: 1,
  heureDebut: '08:00',
  heureFin: '10:00',
  salle: 'B12',
  classe: { id: 'c1', nom: '3e A' },
  enseignementId: 'en1',
  matiere: 'Mathématiques',
  code: 'MATH',
  enseignant: { id: 'p1', nom: 'KPADONOU', prenoms: 'Rodrigue' },
};

afterEach(async () => {
  vi.unstubAllGlobals();
  for (const envoi of await fileEnAttente()) await abandonnerEnvoi(envoi.id);
});

describe('outils de l’emploi du temps', () => {
  it('convertit et affiche les heures, teinte stable par matière', () => {
    expect(enMinutes('08:30')).toBe(510);
    expect(enHeure(510)).toBe('08:30');
    expect(heureLisible('10:00')).toBe('10 h');
    expect(heureLisible('08:30')).toBe('8 h 30');
    expect(teinteMatiere('MATH')).toBe(teinteMatiere('MATH'));
  });
});

describe('planification par la direction', () => {
  it('ajoute un cours en touchant une heure libre et affiche les conflits', async () => {
    let tentative = 0;
    const { appels } = simulerApi({
      'POST /auth/rafraichir': [200, { jetonAcces: 'j', utilisateur: compte('ADMIN_ECOLE') }],
      'GET /classes': [200, { classes: [{ id: 'c1', nom: '3e A' }] }],
      'GET /classes/c1': [
        200,
        {
          classe: {
            id: 'c1',
            enseignements: [
              { id: 'en1', matiere: { nom: 'Mathématiques' }, enseignant: CRENEAU.enseignant },
              { id: 'en2', matiere: { nom: 'Français' }, enseignant: null },
            ],
          },
        },
      ],
      'GET /emplois-du-temps/classes/c1': [200, { classe: { id: 'c1' }, creneaux: [CRENEAU] }],
      'POST /creneaux': () =>
        ++tentative === 1
          ? [
              409,
              {
                erreur: {
                  code: 'CRENEAU_OCCUPE',
                  message: 'La classe a déjà Mathématiques de 08:00 à 10:00',
                },
              },
            ]
          : [201, { creneau: { ...CRENEAU, id: 'cr2' } }],
    });
    rendreApp('/espace/emploi-du-temps');
    expect((await screen.findAllByText('Mathématiques')).length).toBeGreaterThan(0);
    expect(screen.getByText(/de cours par semaine/)).toHaveTextContent('2 h de cours par semaine');

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un cours le mardi à 9 h' }));
    fireEvent.change(await screen.findByLabelText(/Matière/), { target: { value: 'en2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText(/La classe a déjà Mathématiques/)).toBeInTheDocument();
    const corps = JSON.parse(appels.find((a) => a.cle === 'POST /creneaux').options.body);
    expect(corps).toEqual({
      enseignementId: 'en2',
      jour: 2,
      heureDebut: '09:00',
      heureFin: '10:00',
      salle: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(screen.queryByText('Ajouter un cours')).not.toBeInTheDocument());
  });
});

describe('devoirs de l’élève', () => {
  const DEVOIR = {
    id: 'd1',
    matiere: 'Mathématiques',
    titre: 'Exercices 4 à 7',
    consignes: 'Sur le cahier.',
    pourLe: '2999-01-15',
    fichier: null,
    fait: false,
  };

  it('coche un devoir, et le garde en file sans réseau', async () => {
    let enLigne = true;
    const { appels } = simulerApi({
      'POST /auth/rafraichir': [200, { jetonAcces: 'j', utilisateur: compte('ELEVE') }],
      'GET /moi/devoirs': [200, { devoirs: [DEVOIR] }],
      'PUT /moi/devoirs/d1/fait': () => {
        if (!enLigne) throw new TypeError('Failed to fetch');
        return [200, { fait: true }];
      },
    });
    rendreApp('/espace/devoirs');
    const caseFait = await screen.findByRole('checkbox', { name: /Exercices 4 à 7/ });
    fireEvent.click(caseFait);
    await waitFor(() => expect(caseFait).toHaveAttribute('aria-checked', 'true'));
    expect(
      JSON.parse(appels.find((a) => a.cle === 'PUT /moi/devoirs/d1/fait').options.body),
    ).toEqual({ fait: true });

    enLigne = false;
    fireEvent.click(caseFait);
    await waitFor(async () => expect(await fileEnAttente()).toHaveLength(1));
    expect(caseFait).toHaveAttribute('aria-checked', 'false');
    expect((await fileEnAttente())[0]).toMatchObject({
      chemin: '/moi/devoirs/d1/fait',
      corps: { fait: false },
    });
  });
});

describe('copie rendue par l’élève', () => {
  it('envoie les pages choisies et affiche la copie rendue', async () => {
    const { appels } = simulerApi({
      'POST /auth/rafraichir': [200, { jetonAcces: 'j', utilisateur: compte('ELEVE') }],
      'GET /moi/devoirs': [
        200,
        {
          devoirs: [
            {
              id: 'd1',
              matiere: 'Maths',
              titre: 'Problème du jardin',
              consignes: '…',
              pourLe: '2999-01-15',
              fichier: null,
              fait: false,
              rendu: null,
            },
          ],
        },
      ],
      'PUT /moi/devoirs/d1/copie': [
        200,
        {
          rendu: {
            id: 'r1',
            rendLe: '2026-10-16T09:00:00Z',
            enRetard: false,
            pages: 1,
            appreciation: null,
          },
        },
      ],
    });
    rendreApp('/espace/devoirs');
    await screen.findByText('Problème du jardin', { exact: false });
    fireEvent.click(await screen.findByRole('button', { name: /Rendre ma copie/ }));
    const page = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'page1.png', {
      type: 'image/png',
    });
    fireEvent.change(screen.getByLabelText('Choisir des photos ou un PDF'), {
      target: { files: [page] },
    });
    expect(await screen.findByText(/1\/5/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText(/Copie rendue le/)).toBeInTheDocument();
    const envoi = appels.find((a) => a.cle === 'PUT /moi/devoirs/d1/copie');
    expect(envoi.options.body).toBeInstanceOf(FormData);
    expect(envoi.options.body.getAll('pages')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Remplacer ma copie/ })).toBeInTheDocument();
  });
});

describe('appel depuis l’emploi du temps', () => {
  it('rattache l’appel au cours du jour choisi', async () => {
    const { appels } = simulerApi({
      'POST /auth/rafraichir': [200, { jetonAcces: 'j', utilisateur: compte('ENSEIGNANT') }],
      'GET /mes-enseignements': [
        200,
        { enseignements: [{ id: 'en1', matiere: 'Maths', classe: { id: 'c1', nom: '3e A' } }] },
      ],
      'GET /appels': [
        200,
        {
          classe: { id: 'c1', nom: '3e A' },
          enregistre: false,
          faitPar: null,
          appelsDuJour: [],
          creneaux: [
            { id: 'cr1', heureDebut: '08:00', heureFin: '10:00', matiere: 'Mathématiques' },
          ],
          eleves: [
            {
              id: 'a',
              nom: 'AGOSSOU',
              prenoms: 'Koffi',
              statut: 'PRESENT',
              minutesRetard: null,
              justifiee: false,
            },
          ],
        },
      ],
      'PUT /appels': [200, { smsEnFile: 0 }],
    });
    rendreApp('/espace/appel?heure=11:00');
    fireEvent.click(await screen.findByRole('button', { name: /08:00 · Mathématiques/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Enregistrer l’appel/ }));
    await screen.findByText('Appel enregistré.');
    const corps = JSON.parse(appels.find((a) => a.cle === 'PUT /appels').options.body);
    expect(corps).toMatchObject({ heureDebut: '08:00', creneauId: 'cr1' });
  });
});
