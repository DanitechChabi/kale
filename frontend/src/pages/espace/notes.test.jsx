import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { rendreApp, simulerApi } from '../../test/aide.jsx';
import { abandonnerEnvoi, fileEnAttente, mettreEnFile, synchroniser } from '../../lib/horsLigne.js';
import { lireNote, periodeParDefaut } from '../../lib/notes.js';

const ENSEIGNANT = {
  id: 'p1',
  role: 'ENSEIGNANT',
  nom: 'KPADONOU',
  prenoms: 'Rodrigue',
  email: null,
  telephone: '+2290196123456',
  doitChangerMotDePasse: false,
  ecole: {
    id: 'e1',
    nom: 'CEG Les Cocotiers',
    statutVerification: 'VERIFIEE',
    ordres: ['GENERAL'],
  },
};

const FEUILLE = {
  evaluation: {
    id: 'ev1',
    type: 'DEVOIR',
    libelle: 'Devoir 1',
    date: '2025-11-10',
    bareme: 20,
    periode: { id: 't1', numero: 1, type: 'TRIMESTRE', estCloturee: false },
    enseignement: { id: 'en1', matiere: 'Mathématiques', classe: { id: 'c1', nom: '6e A' } },
  },
  eleves: [
    { id: 'a', nom: 'ADJOVI', prenoms: 'Grâce', note: null },
    { id: 'b', nom: 'BIO', prenoms: 'Issiaka', note: null },
  ],
  statistiques: { moyenne: null },
};

async function viderFile() {
  for (const envoi of await fileEnAttente()) await abandonnerEnvoi(envoi.id);
}

describe('saisie des notes', () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    await viderFile();
  });

  it('lit les notes saisies avec une virgule et contrôle le barème', () => {
    expect(lireNote('12,5', 20)).toEqual({ valeur: 12.5, erreur: null });
    expect(lireNote('', 20)).toEqual({ valeur: null, erreur: null });
    expect(lireNote('21', 20).erreur).toBe('Maximum 20');
    expect(lireNote('12,555', 20).erreur).toBe('Nombre invalide');
    expect(lireNote('abc', 20).erreur).toBe('Nombre invalide');
  });

  it('propose la période en cours, sinon la première non clôturée', () => {
    const periodes = [
      { id: 't1', dateDebut: '2025-10-01', dateFin: '2025-12-20', estCloturee: true },
      { id: 't2', dateDebut: '2025-12-21', dateFin: '2026-03-31', estCloturee: false },
      { id: 't3', dateDebut: '2026-04-01', dateFin: '2026-07-15', estCloturee: false },
    ];
    expect(periodeParDefaut(periodes, new Date('2026-05-02')).id).toBe('t3');
    expect(periodeParDefaut(periodes, new Date('2025-11-02')).id).toBe('t2');
  });

  it('garde les envois sans réseau et les vide au retour de la connexion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await mettreEnFile({
      cle: 'notes:ev1',
      chemin: '/evaluations/ev1/notes',
      methode: 'PUT',
      corps: { notes: [] },
    });
    // Une nouvelle feuille pour la même évaluation remplace la précédente
    await mettreEnFile({
      cle: 'notes:ev1',
      chemin: '/evaluations/ev1/notes',
      methode: 'PUT',
      corps: { notes: [{ eleveId: 'a' }] },
    });
    expect(await fileEnAttente()).toHaveLength(1);

    expect(await synchroniser()).toBe(0);
    expect(await fileEnAttente()).toHaveLength(1);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
    );
    expect(await synchroniser()).toBe(1);
    expect(await fileEnAttente()).toHaveLength(0);
  });

  it('enregistre la feuille sur le téléphone quand le réseau manque', async () => {
    const { fetch } = simulerApi({
      'POST /auth/rafraichir': [200, { jetonAcces: 'j', utilisateur: ENSEIGNANT }],
      'GET /evaluations/ev1/notes': [200, FEUILLE],
    });
    rendreApp('/espace/notes/evaluation/ev1');
    const champ = await screen.findByLabelText(/ADJOVI/);
    fireEvent.change(champ, { target: { value: '14,5' } });
    expect(screen.getByText('14,50')).toBeInTheDocument(); // moyenne en direct

    // Coupure réseau au moment d'enregistrer
    fetch.mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(
      await screen.findByText(/partiront automatiquement au retour de la connexion/),
    ).toBeInTheDocument();

    const [envoi] = await fileEnAttente();
    expect(envoi.chemin).toBe('/evaluations/ev1/notes');
    expect(envoi.corps.notes).toEqual([
      { eleveId: 'a', valeur: 14.5, absent: false },
      { eleveId: 'b', valeur: null, absent: false },
    ]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled());
  });
});

describe('ouverture sans réseau', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ouvre l’espace avec le dernier profil connu et les copies locales', async () => {
    const { memoriser } = await import('../../lib/horsLigne.js');
    await memoriser('session:profil', ENSEIGNANT);
    await memoriser('/mes-enseignements', {
      annee: {
        id: 'a',
        libelle: '2026-2027',
        periodes: [
          {
            id: 't1',
            numero: 1,
            type: 'TRIMESTRE',
            dateDebut: '2026-10-01',
            dateFin: '2027-01-10',
            estCloturee: false,
          },
        ],
      },
      enseignements: [
        {
          id: 'en1',
          matiere: 'Mathématiques',
          coefficient: 3,
          classe: { id: 'c1', nom: '6e A' },
          effectif: 8,
        },
      ],
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    rendreApp('/espace/notes');
    expect(
      await screen.findByText('Dernière liste enregistrée sur ce téléphone.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mathématiques/ })).toBeInTheDocument();
  });
});

describe('retour du réseau après une ouverture hors connexion', () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    await viderFile();
  });

  it('rouvre la session avant d’envoyer les notes en attente', async () => {
    const { definirJetonAcces } = await import('../../lib/api.js');
    definirJetonAcces(null);
    await mettreEnFile({
      cle: 'notes:ev9',
      chemin: '/evaluations/ev9/notes',
      methode: 'PUT',
      corps: { notes: [] },
    });
    const appels = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        appels.push(
          `${options.method} ${url.replace('/api', '')} ${options.headers.Authorization ?? 'sans jeton'}`,
        );
        if (url.endsWith('/auth/rafraichir'))
          return {
            ok: true,
            status: 200,
            json: async () => ({ jetonAcces: 'neuf', utilisateur: ENSEIGNANT }),
          };
        if (!options.headers.Authorization)
          return {
            ok: false,
            status: 401,
            json: async () => ({
              erreur: { code: 'NON_AUTHENTIFIE', message: 'Authentification requise' },
            }),
          };
        return { ok: true, status: 200, json: async () => ({}) };
      }),
    );
    expect(await synchroniser()).toBe(1);
    expect(appels).toEqual([
      'PUT /evaluations/ev9/notes sans jeton',
      'POST /auth/rafraichir sans jeton',
      'PUT /evaluations/ev9/notes Bearer neuf',
    ]);
    expect(await fileEnAttente()).toHaveLength(0);
  });
});
