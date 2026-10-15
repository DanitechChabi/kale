import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { rendreApp, simulerApi } from '../../test/aide.jsx';

const RESPONSABLE = {
  id: 'u2',
  role: 'ADMIN_ECOLE',
  nom: 'AGOSSOU',
  prenoms: 'Brice',
  email: null,
  telephone: '+2290197554433',
  doitChangerMotDePasse: false,
  ecole: {
    id: 'e1',
    nom: 'CEG Les Cocotiers',
    statutVerification: 'VERIFIEE',
    ordres: ['GENERAL'],
    typePeriode: 'TRIMESTRE',
  },
};
const session = { 'POST /auth/rafraichir': [200, { jetonAcces: 'j', utilisateur: RESPONSABLE }] };

describe('gestion scolaire', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('montre les matières du programme avant de créer une classe', async () => {
    const { appels } = simulerApi({
      ...session,
      'GET /classes': [200, { classes: [] }],
      'GET /referentiel/series': [200, { series: [] }],
      'GET /referentiel/programme': [
        200,
        {
          programme: [
            { matiere: { code: 'FR', nom: 'Français' }, coefficient: 2, groupeOption: null },
            { matiere: { code: 'MATH', nom: 'Mathématiques' }, coefficient: 3, groupeOption: null },
          ],
        },
      ],
      'POST /classes': [201, { classe: { id: 'c1', nom: '6e A' } }],
    });
    rendreApp('/espace/classes');
    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle classe' }));
    fireEvent.click(screen.getByRole('button', { name: '6e' }));

    expect(await screen.findByText('Mathématiques')).toBeInTheDocument();
    expect(screen.getByText('Matières ajoutées automatiquement')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Créer la classe' }));
    await vi.waitFor(() => expect(appels.some((a) => a.cle === 'POST /classes')).toBe(true));
    const corps = JSON.parse(appels.find((a) => a.cle === 'POST /classes').options.body);
    expect(corps).toEqual({ niveau: 'SIXIEME', serieId: null, nom: null });
  });

  it('affiche l’aperçu d’un import et n’envoie que les lignes valides', async () => {
    const ligne = (numero, statut, nom, erreurs = []) => ({
      numero,
      statut,
      erreurs,
      avertissements: [],
      eleveExistant: null,
      donnees: {
        nom,
        prenoms: 'Test',
        sexe: 'F',
        dateNaissance: '2014-03-12',
        classe: '6e A',
        classeId: 'c1',
      },
    });
    const { appels } = simulerApi({
      ...session,
      'POST /import/eleves/analyse': [
        200,
        {
          anneeScolaire: { id: 'a', libelle: '2025-2026' },
          colonnes: [{ entete: 'Nom et prénoms', champ: 'nomComplet' }],
          classes: [{ id: 'c1', nom: '6e A' }],
          classesInconnues: [],
          resume: { total: 3, nouveaux: 2, existants: 0, erreurs: 1, doublons: 0 },
          lignes: [
            ligne(5, 'nouveau', 'DOSSOU'),
            ligne(6, 'nouveau', 'HOUNSOU'),
            ligne(7, 'erreur', 'KPADONOU', ['Date de naissance manquante']),
          ],
        },
      ],
      'POST /import/eleves': [201, { crees: 2, inscrits: 2, ignores: [] }],
    });
    rendreApp('/espace/import');
    const entree = await screen.findByLabelText('Liste des élèves');
    fireEvent.change(entree, { target: { files: [new File(['x'], 'liste.xlsx')] } });

    expect(await screen.findByText('Date de naissance manquante')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Importer 2 élèves' }));
    expect(await screen.findByText('2 élèves enregistrés')).toBeInTheDocument();

    const envoi = JSON.parse(appels.find((a) => a.cle === 'POST /import/eleves').options.body);
    expect(envoi.lignes.map((l) => l.numero)).toEqual([5, 6]);
    expect(envoi.lignes[0]).not.toHaveProperty('classe');
  });

  it('propose la mise en route à un établissement qui démarre', async () => {
    simulerApi({
      ...session,
      'GET /annees': [200, { annees: [] }],
      'GET /classes': [
        409,
        { erreur: { code: 'ANNEE_ABSENTE', message: 'Créez d’abord l’année scolaire en cours' } },
      ],
      'GET /eleves': [200, { total: 0, eleves: [] }],
      'GET /utilisateurs': [200, { comptes: [] }],
    });
    rendreApp('/espace');
    const bloc = (await screen.findByText('Mise en route de l’établissement')).closest('section');
    expect(within(bloc).getByText('0/4')).toBeInTheDocument();
    expect(
      within(bloc).getByRole('link', { name: /Importer la liste des élèves/ }),
    ).toHaveAttribute('href', '/espace/import');
  });
});
