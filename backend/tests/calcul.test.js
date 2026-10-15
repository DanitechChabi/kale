import { describe, expect, it } from 'vitest';
import {
  arrondir,
  classer,
  moyenneAnnuelle,
  moyenneGenerale,
  moyenneMatiere,
  statistiques,
} from '../src/contexts/notes/calcul.js';
import { detecterAnomalies } from '../src/contexts/notes/anomalies.js';

const note = (type, valeur, bareme = 20, absent = false) => ({ type, valeur, bareme, absent });

describe('moyenne d’une matière (formule APC)', () => {
  it('compte la moyenne des interrogations pour un seul élément', () => {
    // MI = (12 + 16) / 2 = 14 ; (14 + 10 + 13) / 3 = 12,33
    const r = moyenneMatiere([
      note('INTERROGATION', 12),
      note('INTERROGATION', 16),
      note('DEVOIR', 10),
      note('DEVOIR', 13),
    ]);
    expect(r.moyenneInterrogations).toBe(14);
    expect(r.moyenne).toBe(12.33);
    expect(r.nombreNotes).toBe(4);
  });

  it('ramène les notes sur 20 et ignore les absences', () => {
    const r = moyenneMatiere([
      note('INTERROGATION', 7, 10),
      note('DEVOIR', null, 20, true),
      note('DEVOIR', 15),
    ]);
    expect(r.moyenne).toBe(14.5); // (14 + 15) / 2
  });

  it('renvoie une moyenne vide sans aucune note', () => {
    expect(moyenneMatiere([note('DEVOIR', null, 20, true)]).moyenne).toBeNull();
  });
});

describe('moyenne générale', () => {
  it('pondère par les coefficients', () => {
    const r = moyenneGenerale([
      { enseignementId: 'svt', coefficient: 5, moyenne: 15.5 },
      { enseignementId: 'math', coefficient: 4, moyenne: 13.75 },
      { enseignementId: 'fr', coefficient: 3, moyenne: 12 },
    ]);
    // (77,5 + 55 + 36) / 12 = 14,04
    expect(r.moyenne).toBe(14.04);
    expect(r.totalCoefficients).toBe(12);
  });

  it('ne retient qu’une matière par groupe d’options : celle suivie', () => {
    const r = moyenneGenerale([
      { enseignementId: 'fr', coefficient: 2, moyenne: 10 },
      { enseignementId: 'all', coefficient: 2, moyenne: 18, groupeOption: 'LV2', suivie: false },
      { enseignementId: 'esp', coefficient: 2, moyenne: 12, groupeOption: 'LV2', suivie: true },
    ]);
    expect(r.enseignementsRetenus).toEqual(['fr', 'esp']);
    expect(r.moyenne).toBe(11);
  });

  it('n’ajoute que les points au-dessus de 10 d’une matière facultative', () => {
    const base = [{ enseignementId: 'fr', coefficient: 2, moyenne: 12 }];
    const bonus = moyenneGenerale([
      ...base,
      { enseignementId: 'info', coefficient: 1, moyenne: 16, estFacultative: true },
    ]);
    expect(bonus.bonusFacultatif).toBe(6);
    expect(bonus.totalCoefficients).toBe(2);
    expect(bonus.moyenne).toBe(15); // (24 + 6) / 2
    const malus = moyenneGenerale([
      ...base,
      { enseignementId: 'info', coefficient: 1, moyenne: 6, estFacultative: true },
    ]);
    expect(malus.moyenne).toBe(12); // une matière facultative ne fait jamais baisser la moyenne
  });

  it('ignore les matières sans note', () => {
    const r = moyenneGenerale([
      { enseignementId: 'fr', coefficient: 2, moyenne: 12 },
      { enseignementId: 'eps', coefficient: 1, moyenne: null },
    ]);
    expect(r.moyenne).toBe(12);
    expect(r.totalCoefficients).toBe(2);
  });
});

describe('classement', () => {
  it('gère les ex æquo (1, 2, 2, 4) et ne classe pas les moyennes absentes', () => {
    const rangs = classer([
      { id: 'a', moyenne: 12 },
      { id: 'b', moyenne: 15.5 },
      { id: 'c', moyenne: 12 },
      { id: 'd', moyenne: 9 },
      { id: 'e', moyenne: null },
    ]);
    expect(rangs.get('b')).toEqual({ rang: 1, exAequo: false });
    expect(rangs.get('a')).toEqual({ rang: 2, exAequo: true });
    expect(rangs.get('c')).toEqual({ rang: 2, exAequo: true });
    expect(rangs.get('d')).toEqual({ rang: 4, exAequo: false });
    expect(rangs.has('e')).toBe(false);
  });
});

describe('statistiques et arrondis', () => {
  it('calcule moyenne, extrêmes et taux de réussite', () => {
    expect(statistiques([8, 12, 14, null, 10])).toEqual({
      moyenne: 11,
      min: 8,
      max: 14,
      tauxReussite: 75,
      effectif: 4,
    });
    expect(arrondir(12.345)).toBe(12.35);
    expect(moyenneAnnuelle([12, null, 14])).toBe(13);
  });
});

describe('notes suspectes', () => {
  const eleves = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'];
  const evaluation = (id, libelle, valeurs, matiere = 'Mathématiques') => ({
    id,
    libelle,
    matiere,
    notes: valeurs.map((v, i) => ({
      id: `${id}-${i}`,
      eleveId: eleves[i],
      valeur: v,
      bareme: 20,
      absent: false,
    })),
  });

  it('signale une note très éloignée des autres notes de l’élève', () => {
    const anomalies = detecterAnomalies({
      evaluations: [
        evaluation('i1', 'Interrogation 1', [6, 12, 11]),
        evaluation('i2', 'Interrogation 2', [5, 13, 12]),
        evaluation('d1', 'Devoir 1', [18, 12, 13]),
      ],
      noms: new Map([['e1', 'DOSSOU Afi']]),
    });
    const ecart = anomalies.find((a) => a.type === 'ECART_PERSONNEL');
    expect(ecart.message).toMatch(/DOSSOU Afi · Mathématiques · Devoir 1 : 18/);
  });

  it('signale une évaluation où presque toutes les notes sont identiques ou extrêmes', () => {
    const anomalies = detecterAnomalies({
      evaluations: [
        evaluation('d1', 'Devoir 1', [10, 10, 10, 10, 10, 12]),
        evaluation('d2', 'Devoir 2', [2, 3, 1, 4, 2, 3]),
      ],
    });
    expect(anomalies.map((a) => a.type).sort()).toEqual([
      'EVALUATION_ATYPIQUE',
      'NOTES_IDENTIQUES',
    ]);
  });

  it('signale un saut de moyenne et les modifications répétées', () => {
    const anomalies = detecterAnomalies({
      evaluations: [evaluation('d1', 'Devoir 1', [15])],
      moyennesActuelles: new Map([['e1|Français', 16]]),
      moyennesPrecedentes: new Map([['e1|Français', 7]]),
      historiques: new Map([['d1-0', { modifications: 3, apresFinPeriode: true }]]),
    });
    expect(anomalies.map((a) => a.type).sort()).toEqual(['MODIFICATION', 'SAUT_PERIODE']);
  });
});
