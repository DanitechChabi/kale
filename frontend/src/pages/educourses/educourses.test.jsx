import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { rendreApp, simulerApi } from '../../test/aide.jsx';

const compte = (role) => ({
  id: `u-${role}`,
  role,
  nom: 'HOUNKPATIN',
  prenoms: 'Rachelle',
  email: null,
  telephone: '+2290197554433',
  doitChangerMotDePasse: false,
  ecole: role === 'PARENT' ? null : { id: 'ec1', nom: 'CEG', statutVerification: 'VERIFIEE' },
});
const PROFIL = { id: 'pr1', prenom: 'Sèna', niveau: 'SIXIEME', serie: null, relieAEleve: true };
const PROGRAMME = {
  id: 'pg1',
  niveau: 'SIXIEME',
  series: [],
  matiereCode: 'MATH',
  nomMatiere: 'Mathématiques',
  confiance: 'RECOUPE',
  chapitres: 4,
  lecons: 19,
  redigees: 19,
};
const LECON = {
  id: 'l1',
  titre: 'Solides usuels',
  objectifs: ['Reconnaître les solides'],
  duree: 45,
  chapitre: { ordre: 1, titre: 'Géométrie dans l’espace' },
  programme: { id: 'pg1', niveau: 'SIXIEME', series: [], nomMatiere: 'Mathématiques' },
  redigee: true,
  libre: true,
  precedente: null,
  suivante: { id: 'l2', titre: 'Perspective cavalière' },
  contenuHtml: '<h2>Le cube</h2><p>Un cube a 6 faces carrées.</p>',
  exercices: [
    {
      titre: 'Exercice 1',
      niveau: 'facile',
      enonceHtml: '<p>Compte les faces.</p>',
      corrigeHtml: '<p>6 faces.</p>',
    },
  ],
  quiz: [
    { question: '<p>Combien de faces a un cube ?</p>', choix: ['<p>4</p>', '<p>6</p>'] },
    { question: '<p>Un dé est-il un cube ?</p>', choix: ['<p>Oui</p>', '<p>Non</p>'] },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('EduCourses', () => {
  it('présente le catalogue par classe sans compte', async () => {
    simulerApi({
      'GET /educourses/catalogue': [
        200,
        {
          payant: false,
          series: [],
          niveaux: [
            { niveau: 'SIXIEME', programmes: [PROGRAMME] },
            {
              niveau: 'TERMINALE',
              programmes: [
                {
                  ...PROGRAMME,
                  id: 'pg2',
                  niveau: 'TERMINALE',
                  series: ['C'],
                  lecons: 30,
                  redigees: 0,
                },
                {
                  ...PROGRAMME,
                  id: 'pg3',
                  niveau: 'TERMINALE',
                  series: ['D'],
                  lecons: 25,
                  redigees: 0,
                },
              ],
            },
          ],
        },
      ],
    });
    rendreApp('/educourses');
    expect(await screen.findByText('19 leçons · 19 disponibles')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Tle' }));
    // Une matière, plusieurs programmes selon la série
    expect(await screen.findByText('55 leçons · C D')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Créer mon compte/ })).toBeInTheDocument();
  });

  it('ouvre un compte parent puis mène à ses apprenants', async () => {
    let connecte = false;
    const { appels } = simulerApi({
      'GET /educourses/catalogue': [200, { payant: false, series: [], niveaux: [] }],
      'POST /public/educourses/compte': [201, { cree: true }],
      'POST /auth/connexion': () => {
        connecte = true;
        return [200, { jetonAcces: 'j', utilisateur: compte('PARENT') }];
      },
      'GET /educourses/profils': [200, { profils: [], suggestions: [] }],
    });
    rendreApp('/educourses');
    const formulaire = (await screen.findByRole('button', { name: /Créer mon compte/ })).closest(
      'form',
    );
    const champ = (nom) => within(formulaire).getByLabelText(nom);
    fireEvent.change(champ(/^Nom/), { target: { value: 'Dossou' } });
    fireEvent.change(champ(/^Prénoms/), { target: { value: 'Afiavi' } });
    fireEvent.change(champ(/Téléphone/), { target: { value: '0197000000' } });
    fireEvent.change(champ(/Choisissez un mot de passe/), { target: { value: 'Cotonou2026' } });
    fireEvent.click(within(formulaire).getByRole('button', { name: /Créer mon compte/ }));
    expect(await screen.findByText('Qui travaille aujourd’hui ?')).toBeInTheDocument();
    expect(connecte).toBe(true);
    expect(
      JSON.parse(appels.find((a) => a.cle === 'POST /public/educourses/compte').options.body),
    ).toMatchObject({ nom: 'Dossou', telephone: '0197000000' });
  });

  it('le parent relie un enfant proposé puis voit ses matières', async () => {
    let relie = false;
    simulerApi({
      'POST /auth/rafraichir': [200, { jetonAcces: 'j', utilisateur: compte('PARENT') }],
      'GET /educourses/catalogue': [200, { payant: false, series: [], niveaux: [] }],
      'GET /educourses/profils': () => [
        200,
        relie
          ? { profils: [{ ...PROFIL, classe: '6e A' }], suggestions: [] }
          : {
              profils: [],
              suggestions: [
                { eleveId: 'el1', prenom: 'Sèna', niveau: 'SIXIEME', serie: null, classe: '6e A' },
              ],
            },
      ],
      'POST /educourses/profils': () => {
        relie = true;
        return [201, { profil: PROFIL }];
      },
      'GET /educourses/profils/pr1': [
        200,
        {
          profil: PROFIL,
          programmes: [{ ...PROGRAMME, terminees: 3, scoreMoyen: 80 }],
          activite: [
            {
              leconId: 'l1',
              titre: 'Solides usuels',
              programmeId: 'pg1',
              matiere: 'Mathématiques',
              terminee: true,
              meilleurScore: 80,
              le: '2026-10-15T10:00:00Z',
            },
          ],
        },
      ],
    });
    rendreApp('/espace/educourses');
    fireEvent.click(await screen.findByRole('button', { name: /Suivre les cours/ }));
    fireEvent.click(await screen.findByRole('link', { name: /Sèna/ }));
    expect(await screen.findByText('Les cours de Sèna')).toBeInTheDocument();
    expect(screen.getByText('3/19 terminées')).toBeInTheDocument();
    expect(screen.getByText('Travail récent')).toBeInTheDocument();
  });

  it('l’élève lit la leçon, fait corriger le quiz et la termine', async () => {
    const { appels } = simulerApi({
      'POST /auth/rafraichir': [200, { jetonAcces: 'j', utilisateur: compte('ELEVE') }],
      'GET /educourses/lecons/l1': [200, { lecon: LECON, progression: null }],
      'POST /educourses/lecons/l1/quiz': [
        200,
        {
          score: 50,
          corrections: [
            { bonne: 1, juste: true, explication: '<p>Six carrés.</p>' },
            { bonne: 0, juste: false, explication: null },
          ],
          progression: { terminee: false, meilleurScore: 50, dernierScore: 50, tentatives: 1 },
        },
      ],
      'PUT /educourses/lecons/l1/terminee': [
        200,
        { progression: { terminee: true, termineeLe: '2026-10-16T10:00:00Z', meilleurScore: 50 } },
      ],
    });
    rendreApp('/espace/educourses/pr1/lecons/l1');
    expect(await screen.findByRole('heading', { name: 'Le cube' })).toBeInTheDocument();
    expect(screen.getByText('Voir le corrigé')).toBeInTheDocument();

    const corriger = screen.getByRole('button', { name: 'Corriger mes réponses' });
    expect(corriger).toBeDisabled(); // toutes les questions d'abord
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]);
    fireEvent.click(radios[3]);
    fireEvent.click(corriger);
    expect(await screen.findByText('À revoir')).toBeInTheDocument();
    expect(screen.getByText('Six carrés.')).toBeInTheDocument();
    expect(
      JSON.parse(appels.find((a) => a.cle === 'POST /educourses/lecons/l1/quiz').options.body),
    ).toEqual({ profilId: 'pr1', reponses: [1, 1] });

    fireEvent.click(screen.getByRole('button', { name: /J’ai terminé/ }));
    await waitFor(() => expect(screen.getByText('Leçon terminée')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /Perspective cavalière/ })).toBeInTheDocument();
  });
});
