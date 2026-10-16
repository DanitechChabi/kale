import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { rendreApp, simulerApi, UTILISATEUR_MINISTERE } from '../../test/aide.jsx';

const zone = (id, code, nom, valeurs = {}) => ({
  id,
  code,
  nom,
  etablissements: 1,
  etablissementsEnAttente: 0,
  effectif: 0,
  filles: 0,
  partFilles: null,
  elevesEvalues: 0,
  moyenneGenerale: null,
  tauxReussite: null,
  appels: 0,
  tauxAbsence: null,
  absencesNonJustifiees: 0,
  retards: 0,
  documentsDelivres: 0,
  bulletins: 0,
  releves: 0,
  corrections: 0,
  delaiBulletinJours: null,
  duplicatas: {
    demandes: 0,
    delivres: 0,
    rejetes: 0,
    enCours: 0,
    delaiMoyenHeures: null,
    partSous72h: null,
  },
  ...valeurs,
});
const BORGOU = zone('d-bo', 'BO', 'Borgou', {
  effectif: 4,
  partFilles: 50,
  moyenneGenerale: 11,
  tauxReussite: 75,
  tauxAbsence: 25,
});
const LITTORAL = zone('d-li', 'LI', 'Littoral', {
  effectif: 2,
  moyenneGenerale: 7.5,
  tauxReussite: 0,
  tauxAbsence: 100,
});
const TABLEAU = {
  annees: ['2026-2027', '2025-2026'],
  annee: '2026-2027',
  zone: { niveau: 'NATIONAL', nom: 'Bénin' },
  seuilReussite: 10,
  sourceReussite: 'TRIMESTRE-1',
  synthese: zone(null, null, 'Bénin', {
    etablissements: 2,
    effectif: 6,
    partFilles: 66.7,
    elevesEvalues: 6,
    moyenneGenerale: 9.83,
    tauxReussite: 50,
    appels: 2,
    tauxAbsence: 50,
    bulletins: 6,
    documentsDelivres: 6,
    delaiBulletinJours: 2,
    duplicatas: {
      demandes: 2,
      delivres: 2,
      rejetes: 0,
      enCours: 0,
      delaiMoyenHeures: 72,
      partSous72h: 50,
    },
  }),
  effectifsParNiveau: [{ niveau: 'SIXIEME', effectif: 6 }],
  resultatsParPeriode: [
    { cle: 'TRIMESTRE-1', elevesEvalues: 6, moyenneGenerale: 9.83, tauxReussite: 50 },
  ],
  parDepartement: [BORGOU, LITTORAL],
  detail: [
    { ...BORGOU, type: 'DEPARTEMENT' },
    { ...LITTORAL, type: 'DEPARTEMENT' },
  ],
  zones: [
    {
      id: 'd-bo',
      code: 'BO',
      nom: 'Borgou',
      communes: [{ id: 'c-pk', nom: 'Parakou', ecoles: [{ id: 'e1', nom: 'CEG Parakou' }] }],
    },
    {
      id: 'd-li',
      code: 'LI',
      nom: 'Littoral',
      communes: [{ id: 'c-ct', nom: 'Cotonou', ecoles: [{ id: 'e2', nom: 'CEG Cotonou' }] }],
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('tableau de bord du ministère', () => {
  it('présente les indicateurs, la carte et descend dans une zone', async () => {
    const { appels } = simulerApi({
      'POST /auth/rafraichir': [200, { jetonAcces: 'j', utilisateur: UTILISATEUR_MINISTERE }],
      'GET /ministere/tableau-de-bord': [200, TABLEAU],
    });
    rendreApp('/espace/tableau-de-bord');
    expect(
      await screen.findByRole('heading', { name: 'Tableau de bord national' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Trimestre 1 · moyenne ≥ 10 · 6 élèves/)).toBeInTheDocument();
    expect(screen.getByText('3,0 j')).toBeInTheDocument(); // délai moyen d'un duplicata (72 h)

    // Carte : un département par tracé, valeur dans le nom accessible
    expect(screen.getByRole('button', { name: 'Borgou : 4' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Réussite' }));
    expect(screen.getByRole('button', { name: 'Borgou : 75 %' })).toBeInTheDocument();

    // Détail : ouvrir le Borgou relance la requête filtrée
    fireEvent.click(
      within(screen.getAllByRole('table').at(-1)).getByRole('button', { name: /Borgou/ }),
    );
    await vi.waitFor(() =>
      expect(
        appels.some(
          (a) => a.cle === 'GET /ministere/tableau-de-bord' && a.url.includes('departementId=d-bo'),
        ),
      ).toBe(true),
    );
  });
});
