import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { rendreApp, simulerApi } from '../../test/aide.jsx';

const PARENT = {
  id: 'p1',
  role: 'PARENT',
  nom: 'HOUNKPATIN',
  prenoms: 'Rachelle',
  email: null,
  telephone: '+2290197554433',
  doitChangerMotDePasse: false,
  ecole: null,
};
const ENSEIGNANT = {
  id: 'e1',
  role: 'ENSEIGNANT',
  nom: 'KPADONOU',
  prenoms: 'Rodrigue',
  email: null,
  telephone: '+2290196123456',
  doitChangerMotDePasse: false,
  ecole: { id: 'ec1', nom: 'CEG Les Cocotiers', statutVerification: 'VERIFIEE' },
};
const SUIVI = {
  eleve: { id: 'el1', nom: 'HOUNKPATIN', prenoms: 'Sèna Marie-Ange' },
  ecole: { nom: 'CEG Les Cocotiers' },
  classe: { id: 'c1', nom: '6e A' },
  anneeScolaire: '2026-2027',
  lien: 'MERE',
  periodes: [
    {
      id: 't1',
      type: 'TRIMESTRE',
      numero: 1,
      dateDebut: '2026-09-14',
      dateFin: '2026-12-19',
      estCloturee: false,
      moyenneGenerale: 9.19,
      rang: null,
      exAequo: false,
      effectif: 6,
      moyenneClasse: 13.23,
      matieres: [
        {
          matiere: 'Mathématiques',
          coefficient: 3,
          estFacultative: false,
          moyenne: 10.42,
          moyenneClasse: 13.15,
          notes: [
            {
              type: 'DEVOIR',
              libelle: 'Devoir 1',
              date: '2026-10-06',
              absent: false,
              valeur: 12.75,
              bareme: 20,
              surVingt: 12.75,
            },
          ],
        },
      ],
    },
  ],
  absences: [
    {
      id: 'a1',
      date: '2026-10-16',
      heureDebut: '07:00',
      matiere: null,
      statut: 'ABSENT',
      minutesRetard: null,
      justifiee: false,
      motif: null,
    },
  ],
  documents: [],
};

afterEach(() => vi.unstubAllGlobals());

describe('espace parent', () => {
  it('présente chaque enfant puis son suivi détaillé', async () => {
    simulerApi({
      'POST /auth/rafraichir': [200, { jetonAcces: 'j', utilisateur: PARENT }],
      'GET /parent/enfants': [
        200,
        {
          enfants: [
            {
              id: 'el1',
              lien: 'MERE',
              nom: 'HOUNKPATIN',
              prenoms: 'Sèna Marie-Ange',
              ecole: 'CEG Les Cocotiers',
              classe: '6e A',
              anneeScolaire: '2026-2027',
              dernierePeriode: {
                type: 'TRIMESTRE',
                numero: 1,
                estCloturee: false,
                moyenneGenerale: 9.19,
                rang: null,
                effectif: 6,
              },
              absencesNonJustifiees: 1,
              documents: 0,
            },
          ],
        },
      ],
      'GET /parent/enfants/el1': [200, SUIVI],
    });
    rendreApp('/espace');
    expect(await screen.findByText('Sèna HOUNKPATIN')).toBeInTheDocument();
    expect(screen.getByText(/1 absence non justifiée/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Sèna HOUNKPATIN'));
    expect(await screen.findByText('Moyenne générale')).toBeInTheDocument();
    expect(screen.getByText('à la clôture')).toBeInTheDocument(); // pas de rang en cours de période
    fireEvent.click(screen.getByRole('button', { name: /Mathématiques/ }));
    expect(screen.getByText('12,75 / 20')).toBeInTheDocument();
    expect(screen.getByText('Non justifiée')).toBeInTheDocument();
  });

  it('le simulateur USSD déroule les menus', async () => {
    const { appels } = simulerApi({
      'POST /auth/rafraichir': [200, { jetonAcces: 'j', utilisateur: PARENT }],
      'GET /parent/messages': [200, { messages: [], codeUssd: '*123*45#' }],
      'POST /ussd/simulation': (options) => {
        const { texte } = JSON.parse(options.body);
        return [
          200,
          {
            telephone: PARENT.telephone,
            reponse: texte
              ? 'END Sèna HOUNKPATIN, 6e A\nT1 : 9,19/20 (en cours)'
              : 'CON EduRelevé\n1. Notes et moyennes',
          },
        ];
      },
    });
    rendreApp('/espace/messages');
    expect(await screen.findByText('Composez *123*45#')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Appeler' }));
    expect(await screen.findByText(/1\. Notes et moyennes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText(/T1 : 9,19\/20/)).toBeInTheDocument();
    const textes = appels
      .filter((a) => a.cle === 'POST /ussd/simulation')
      .map((a) => JSON.parse(a.options.body).texte);
    expect(textes).toEqual(['', '1']);
  });
});

describe('activation du compte parent', () => {
  it('ouvre le compte puis connecte le parent', async () => {
    let connecte = false;
    const { appels } = simulerApi({
      'POST /public/parents/activation': [201, { compteExistant: false }],
      'POST /auth/connexion': () => {
        connecte = true;
        return [200, { jetonAcces: 'j', utilisateur: PARENT }];
      },
      'GET /parent/enfants': [200, { enfants: [] }],
    });
    rendreApp('/parents');
    fireEvent.change(await screen.findByLabelText(/Identifiant EduRelevé/), {
      target: { value: 'r6ctd-1qey2' },
    });
    fireEvent.change(screen.getByLabelText(/Sa date de naissance/), {
      target: { value: '2013-03-01' },
    });
    fireEvent.change(screen.getByLabelText(/^Nom/), { target: { value: 'Hounkpatin' } });
    fireEvent.change(screen.getByLabelText(/^Prénoms/), { target: { value: 'Rachelle' } });
    fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: '0197554433' } });
    fireEvent.change(screen.getByLabelText(/Choisissez un mot de passe/), {
      target: { value: 'Cotonou2026' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir mon compte parent' }));
    expect(await screen.findByText(/Aucun enfant relié/)).toBeInTheDocument();
    expect(connecte).toBe(true);
    const corps = JSON.parse(
      appels.find((a) => a.cle === 'POST /public/parents/activation').options.body,
    );
    expect(corps).toMatchObject({ lien: 'MERE', identifiantEleve: 'r6ctd-1qey2' });
  });
});

describe('appel', () => {
  it('envoie seulement les absences et retards, puis annonce les SMS', async () => {
    const { appels } = simulerApi({
      'POST /auth/rafraichir': [200, { jetonAcces: 'j', utilisateur: ENSEIGNANT }],
      'GET /mes-enseignements': [
        200,
        { enseignements: [{ id: 'en1', matiere: 'Maths', classe: { id: 'c1', nom: '6e A' } }] },
      ],
      'GET /appels': [
        200,
        {
          classe: { id: 'c1', nom: '6e A' },
          enregistre: false,
          faitPar: null,
          appelsDuJour: [],
          creneaux: [{ id: 'cr1', heureDebut: '10:00', heureFin: '11:00', matiere: 'Maths' }],
          eleves: [
            {
              id: 'a',
              nom: 'AGOSSOU',
              prenoms: 'Koffi',
              statut: 'PRESENT',
              minutesRetard: null,
              justifiee: false,
            },
            {
              id: 'b',
              nom: 'BIO',
              prenoms: 'Issiaka',
              statut: 'PRESENT',
              minutesRetard: null,
              justifiee: false,
            },
          ],
        },
      ],
      'PUT /appels': [200, { smsEnFile: 1 }],
    });
    rendreApp('/espace/appel');
    const ligne = await screen.findByRole('radiogroup', { name: /BIO/ });
    fireEvent.click(within(ligne).getByRole('radio', { name: 'Absent' }));
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer l’appel/ }));
    expect(await screen.findByText(/1 SMS envoyé aux parents/)).toBeInTheDocument();
    const corps = JSON.parse(appels.find((a) => a.cle === 'PUT /appels').options.body);
    expect(corps).toMatchObject({
      classeId: 'c1',
      presences: [{ eleveId: 'b', statut: 'ABSENT' }],
    });
  });
});
