import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { rendreApp, simulerApi } from '../../test/aide.jsx';

const ECOLE = { id: 'ec1', nom: 'CEG Les Cocotiers', statutVerification: 'VERIFIEE' };
const ELEVE = {
  id: 'u-el',
  role: 'ELEVE',
  nom: 'HOUNKPATIN',
  prenoms: 'Sèna',
  email: null,
  telephone: null,
  doitChangerMotDePasse: false,
  ecole: ECOLE,
};
const ADMIN = { ...ELEVE, id: 'u-ad', role: 'ADMIN_ECOLE', nom: 'AGBO', prenoms: 'Koffi' };
const PARENT = { ...ELEVE, id: 'u-pa', role: 'PARENT', prenoms: 'Rachelle', ecole: null };
const SERVICE = {
  fournisseur: 'aucun',
  simulation: false,
  domaineConfigure: false,
  domaine: null,
  creationActivee: false,
  raison: 'Aucun fournisseur de messagerie n’est configuré.',
  urlWebmail: null,
  consentement: { politique: 'toujours', age: null },
};
const SIMULATION = {
  ...SERVICE,
  fournisseur: 'simulation',
  simulation: true,
  domaine: 'edumail.test',
  creationActivee: true,
};
const session = (u) => ({ 'POST /auth/rafraichir': [200, { jetonAcces: 'j', utilisateur: u }] });
const compte = (statut, extra = {}) => ({
  id: 'd1',
  statut,
  adresse: null,
  simule: false,
  demandeLe: '2026-10-20T10:00:00Z',
  activeLe: null,
  derniereVerificationLe: '2026-10-20T10:00:00Z',
  motifDecision: null,
  motifSuspension: null,
  consentement: { requis: true, obtenu: false },
  ...extra,
});
const vue = (c, service = SERVICE) => ({
  service,
  eligibilite: { statut: 'ELIGIBLE', message: null },
  compte: c,
  signalements: [],
});

afterEach(() => vi.unstubAllGlobals());

describe('EduMail : espace élève', () => {
  it('sans fournisseur : la demande est possible, le service est annoncé non disponible', async () => {
    let demande = false;
    simulerApi({
      ...session(ELEVE),
      'GET /edumail/moi': () => [200, vue(demande ? compte('EN_ATTENTE_CONSENTEMENT') : null)],
      'POST /edumail/moi/demande': () => {
        demande = true;
        return [201, { compte: compte('EN_ATTENTE_CONSENTEMENT'), deja: false }];
      },
    });
    rendreApp('/espace/edumail');
    expect(await screen.findByText('Service pas encore disponible')).toBeInTheDocument();
    expect(screen.getByText(/ni votre nom, ni votre téléphone/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Demander mon compte EduMail' }));
    expect(await screen.findByText('Consentement attendu')).toBeInTheDocument();
    expect(screen.getByText(/doit donner son accord/)).toBeInTheDocument();
  });

  it('compte en erreur : explication sans détail technique', async () => {
    simulerApi({ ...session(ELEVE), 'GET /edumail/moi': [200, vue(compte('ERREUR'))] });
    rendreApp('/espace/edumail');
    expect(await screen.findByText('Erreur de création')).toBeInTheDocument();
    expect(screen.getByText(/relancera la création/)).toBeInTheDocument();
  });

  it('compte actif simulé : adresse, avertissement et réinitialisation avec mot de passe', async () => {
    const { appels } = simulerApi({
      ...session(ELEVE),
      'GET /edumail/moi': [
        200,
        vue(
          compte('ACTIF', {
            adresse: 'k7m2q9x4bd@edumail.test',
            simule: true,
            activeLe: '2026-10-21T09:00:00Z',
            consentement: { requis: true, obtenu: true },
          }),
          SIMULATION,
        ),
      ],
      'POST /edumail/moi/reinitialisation': [
        200,
        { motDePasseTemporaire: 'Tmp-9xQ2', simule: true },
      ],
    });
    rendreApp('/espace/edumail');
    expect(await screen.findByText('k7m2q9x4bd@edumail.test')).toBeInTheDocument();
    expect(screen.getByText('Service en simulation')).toBeInTheDocument();
    expect(screen.getByText('Compte simulé (test)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser l’accès' }));
    fireEvent.change(screen.getByLabelText(/Mot de passe EduRelevé/), {
      target: { value: 'Cotonou2026' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    expect(await screen.findByText('Tmp-9xQ2')).toBeInTheDocument();
    const corps = JSON.parse(
      appels.find((a) => a.cle === 'POST /edumail/moi/reinitialisation').options.body,
    );
    expect(corps).toEqual({ motDePasse: 'Cotonou2026' });
  });

  it('élève non éligible : aucun bouton de demande', async () => {
    simulerApi({
      ...session(ELEVE),
      'GET /edumail/moi': [
        200,
        {
          ...vue(null),
          eligibilite: {
            statut: 'NON_ELIGIBLE',
            message: 'Votre établissement n’est pas encore vérifié.',
          },
        },
      ],
    });
    rendreApp('/espace/edumail');
    expect(await screen.findByText(/pas encore vérifié/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Demander mon compte EduMail' })).toBeNull();
  });

  it('avantages numériques : aucun partenariat revendiqué', async () => {
    simulerApi({
      ...session(ELEVE),
      'GET /edumail/avantages': [
        200,
        {
          avertissement: 'EduRelevé n’est partenaire d’aucun de ces services.',
          services: [
            {
              id: 'g',
              nom: 'GitHub Education',
              categorie: 'Programmation',
              description: 'Outils',
              url: 'https://education.github.com/pack',
              conditions: 'Vérifié par GitHub',
              verification: 'Par GitHub',
              statutConfiguration: 'INFORMATION',
            },
          ],
        },
      ],
    });
    rendreApp('/espace/avantages-numeriques');
    expect(await screen.findByText(/partenaire d’aucun/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Site officiel/ })).toHaveAttribute(
      'href',
      'https://education.github.com/pack',
    );
  });
});

const DETAIL = {
  service: SERVICE,
  droits: { decider: true, direction: true, utilisateurId: 'u-ad' },
  dossier: {
    id: 'd1',
    statut: 'EN_ATTENTE_DECISION',
    adresse: null,
    adressePrevue: 'k7m2q9x4bd',
    fournisseur: null,
    referenceFournisseur: null,
    simule: false,
    demandeLe: '2026-10-20T10:00:00Z',
    activeLe: null,
    aReexaminer: null,
    decision: null,
    tentatives: 0,
    derniereErreur: null,
  },
  eleve: { id: 'el1', nom: 'HOUNKPATIN', prenoms: 'Sèna', dateNaissance: '2011-03-01' },
  situation: {
    statut: 'ELIGIBLE',
    motif: null,
    inscription: { statut: 'INSCRIT', classe: '3e A', anneeScolaire: '2026-2027' },
  },
  consentement: {
    requis: true,
    obtenu: true,
    liste: [
      {
        id: 'c1',
        mode: 'ATTESTATION_ECRITE',
        valable: false,
        representantNom: 'HOUNKPATIN Rachelle',
        signeLe: '2026-10-19',
        recueilliPar: { nom: 'Ama SECRÉTAIRE' },
        recueilliParId: 'u-se',
        preuve: true,
        creeLe: '2026-10-20T11:00:00Z',
      },
    ],
  },
  evenements: [
    { id: 'e1', type: 'DEMANDE', statutApres: 'A_VERIFIER', le: '2026-10-20T10:00:00Z' },
  ],
  signalements: [],
};

describe('EduMail : établissement', () => {
  it('la direction vérifie la pièce puis approuve ; le service non configuré est annoncé', async () => {
    const { appels } = simulerApi({
      ...session(ADMIN),
      'GET /edumail/ecole/dossiers/d1': [200, DETAIL],
      'POST /edumail/ecole/dossiers/d1/consentements/c1/validation': [200, DETAIL],
      'POST /edumail/ecole/dossiers/d1/decision': [
        200,
        {
          ...DETAIL,
          dossier: { ...DETAIL.dossier, statut: 'APPROUVE' },
          creation: { activee: false, raison: SERVICE.raison, erreur: null },
        },
      ],
    });
    rendreApp('/espace/edumail/dossiers/d1');
    expect(await screen.findByText('Création des boîtes non activée')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pièce vérifiée' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Approuver' }));
    expect(await screen.findByRole('button', { name: 'Créer la boîte' })).toBeInTheDocument();
    expect(appels.map((a) => a.cle)).toContain('POST /edumail/ecole/dossiers/d1/decision');
  });

  it('sans délégation, le secrétariat ne voit pas les boutons de décision', async () => {
    simulerApi({
      ...session({ ...ADMIN, role: 'SECRETARIAT' }),
      'GET /edumail/ecole/dossiers/d1': [
        200,
        { ...DETAIL, droits: { decider: false, direction: false, utilisateurId: 'u-se' } },
      ],
    });
    rendreApp('/espace/edumail/dossiers/d1');
    expect(await screen.findByText(/la décision revient à la direction/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approuver' })).toBeNull();
    // La personne qui a saisi l'attestation ne peut pas la vérifier elle-même
    expect(screen.queryByRole('button', { name: 'Pièce vérifiée' })).toBeNull();
  });
});

describe('EduMail : espace parent', () => {
  it('le parent donne son accord pour la demande de son enfant', async () => {
    const enfant = {
      eleve: { id: 'el1', nom: 'HOUNKPATIN', prenoms: 'Sèna Marie' },
      ecole: { nom: 'CEG Les Cocotiers' },
      classe: { nom: '3e A' },
      anneeScolaire: '2026-2027',
      periodes: [],
      absences: [],
      documents: [],
    };
    const avant = {
      service: SERVICE,
      compte: compte('EN_ATTENTE_CONSENTEMENT'),
      consentement: { requis: true, obtenu: false, donneParMoi: false, donneLe: null },
    };
    simulerApi({
      ...session(PARENT),
      'GET /parent/enfants/el1': [200, enfant],
      'GET /edumail/parent/enfants/el1': [200, avant],
      'PUT /edumail/parent/enfants/el1/consentement': [
        200,
        {
          ...avant,
          compte: compte('EN_ATTENTE_DECISION'),
          consentement: {
            requis: true,
            obtenu: true,
            donneParMoi: true,
            donneLe: '2026-10-25T08:00:00Z',
          },
        },
      ],
    });
    rendreApp('/espace/enfants/el1?onglet=edumail');
    fireEvent.click(await screen.findByRole('button', { name: 'Je donne mon accord' }));
    expect(await screen.findByText(/Vous avez donné votre accord/)).toBeInTheDocument();
    expect(screen.getByText('Décision attendue')).toBeInTheDocument();
  });
});
