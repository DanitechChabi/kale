import { describe, expect, it } from 'vitest';
import { matieres, programmes, series } from '../prisma/donnees/referentiel-pedagogique.js';

const PREMIER_CYCLE = ['SIXIEME', 'CINQUIEME', 'QUATRIEME', 'TROISIEME'];
const SECOND_CYCLE = ['SECONDE', 'PREMIERE', 'TERMINALE'];
const codesMatieres = new Set(matieres.map((m) => m.code));
const codesSeries = new Set(series.map((s) => s.code));

describe('référentiel pédagogique par défaut', () => {
  it('a des codes uniques', () => {
    expect(codesMatieres.size).toBe(matieres.length);
    expect(codesSeries.size).toBe(series.length);
  });

  it('ne référence que des matières et séries connues, avec un coefficient positif', () => {
    for (const p of programmes) {
      expect(codesMatieres.has(p.matiere), p.matiere).toBe(true);
      if (p.serie) expect(codesSeries.has(p.serie), p.serie).toBe(true);
      expect(Number.isInteger(p.coefficient) && p.coefficient > 0).toBe(true);
      expect(p.source).toBeTruthy();
    }
  });

  it('n’a pas de série au premier cycle et en exige une au second', () => {
    for (const p of programmes) {
      if (PREMIER_CYCLE.includes(p.niveau)) expect(p.serie).toBeNull();
      else expect(SECOND_CYCLE).toContain(p.niveau);
      if (SECOND_CYCLE.includes(p.niveau)) expect(p.serie).not.toBeNull();
    }
  });

  it('ne contient aucun doublon (niveau, série, matière)', () => {
    const cles = programmes.map((p) => `${p.niveau}|${p.serie}|${p.matiere}`);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it('couvre chaque niveau du premier cycle et chaque série au second cycle', () => {
    for (const niveau of PREMIER_CYCLE) {
      expect(programmes.some((p) => p.niveau === niveau)).toBe(true);
    }
    for (const serie of codesSeries) {
      for (const niveau of SECOND_CYCLE) {
        expect(
          programmes.some((p) => p.niveau === niveau && p.serie === serie),
          `${niveau} ${serie}`,
        ).toBe(true);
      }
    }
  });

  it('propose la LV2 au choix à partir de la 4e seulement', () => {
    const lv2 = (niveau) =>
      programmes.filter((p) => p.niveau === niveau && p.groupeOption === 'LV2');
    expect(lv2('SIXIEME')).toHaveLength(0);
    expect(lv2('CINQUIEME')).toHaveLength(0);
    expect(
      lv2('QUATRIEME')
        .map((p) => p.matiere)
        .sort(),
    ).toEqual(['LV2-ALL', 'LV2-ESP']);
  });

  it('réserve la philosophie à la terminale', () => {
    const philo = programmes.filter((p) => p.matiere === 'PHILO');
    expect(philo.length).toBeGreaterThan(0);
    expect(philo.every((p) => p.niveau === 'TERMINALE')).toBe(true);
  });

  it('marque toutes les lignes comme à vérifier', () => {
    expect(programmes.every((p) => p.estVerifie === false)).toBe(true);
  });
});

describe('conduite et matières facultatives', () => {
  it('note la conduite dans chaque classe', () => {
    const combinaisons = new Set(programmes.map((p) => `${p.niveau}|${p.serie}`));
    const avecConduite = new Set(
      programmes.filter((p) => p.matiere === 'CONDUITE').map((p) => `${p.niveau}|${p.serie}`),
    );
    expect(avecConduite).toEqual(combinaisons);
  });

  it('expose le caractère facultatif sur chaque ligne', () => {
    expect(programmes.every((p) => typeof p.estFacultative === 'boolean')).toBe(true);
    expect(matieres.some((m) => m.code === 'INFO')).toBe(true);
  });
});

describe('géographie', () => {
  it('compte 12 départements et 77 communes, sans doublon', async () => {
    const { departements } = await import('../prisma/donnees/geographie.js');
    expect(departements).toHaveLength(12);
    const communes = departements.flatMap((d) => d.communes);
    expect(communes).toHaveLength(77);
    expect(new Set(communes).size).toBe(77);
    expect(new Set(departements.map((d) => d.code)).size).toBe(12);
  });
});
