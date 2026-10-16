// EduCourses : format des fichiers de leçon et rendu Markdown + formules.
import { describe, expect, it } from 'vitest';
import {
  analyserLecon,
  cleDossier,
  ErreurFormat,
  indicesFichier,
} from '../src/contexts/educourses/format.js';
import { rendreMarkdown } from '../src/contexts/educourses/rendu.js';
import { preparerLecon } from '../prisma/educourses.js';

const COURS = `## Le cours\n\n${'Une phrase claire pour apprendre. '.repeat(15)}\n\n$$a^2 + b^2 = c^2$$`;
const exercice = (n) =>
  `### Exercice ${n} — facile\n\nCalcule $2 \\times ${n}$.\n\n#### Corrigé\n\n$2 \\times ${n} = ${2 * n}$.`;
const question = (n) => `? Combien font ${n} + ${n} ?\n- ${n}\n+ ${2 * n}\n> On double ${n}.`;
const lecon = ({ cours = COURS, exercices = 2, quiz = 3 } = {}) =>
  [
    '---\ntitre: Une leçon\nduree: 45\n---',
    cours,
    '=== EXERCICES ===',
    ...Array.from({ length: exercices }, (_, i) => exercice(i + 1)),
    '=== QUIZ ===',
    ...Array.from({ length: quiz }, (_, i) => question(i + 1)),
  ].join('\n\n');

describe('format des leçons', () => {
  it('reconnaît les dossiers et les fichiers', () => {
    expect(cleDossier('SIXIEME-MATH')).toMatchObject({
      niveau: 'SIXIEME',
      matiere: 'MATH',
      series: [],
    });
    expect(cleDossier('TERMINALE-PCT-C+D').series).toEqual(['C', 'D']);
    expect(indicesFichier('03-02.md')).toEqual({ chapitre: 3, lecon: 2 });
    expect(() => indicesFichier('lecon.md')).toThrow(ErreurFormat);
  });

  it('découpe cours, exercices corrigés et quiz', () => {
    const l = analyserLecon(lecon());
    expect(l).toMatchObject({ titre: 'Une leçon', duree: 45 });
    expect(l.exercices).toHaveLength(2);
    expect(l.exercices[0].niveau).toBe('facile');
    expect(l.quiz[0]).toMatchObject({ bonne: 1 });
    expect(l.quiz[0].choix).toHaveLength(2);
  });

  it('refuse une leçon incomplète', () => {
    expect(() => analyserLecon(lecon({ cours: 'Trop court' }))).toThrow(/trop court/);
    expect(() => analyserLecon(lecon({ exercices: 1 }))).toThrow(/2 exercices/);
    expect(() => analyserLecon(lecon({ quiz: 2 }))).toThrow(/3 questions/);
    expect(() => analyserLecon(lecon().replace('+ 2', '- 2'))).toThrow(ErreurFormat);
  });
});

describe('rendu', () => {
  it('rend les formules avec KaTeX, en ligne et centrées', () => {
    const html = rendreMarkdown('Aire : $\\pi r^2$\n\n$$\\frac{a}{b}$$');
    expect(html).toContain('class="katex"');
    expect(html).toContain('<div class="formule">');
    expect(html).not.toContain('$');
  });

  it('retire le HTML dangereux et les liens', () => {
    const html = rendreMarkdown(
      '<script>alert(1)</script><img src=x onerror=alert(1)>\n\n[lien](javascript:alert(1)) **gras**',
    );
    // Il ne reste que du texte : ni balise active, ni attribut, ni lien
    expect(html).not.toMatch(/<script|onerror|<a |href=/);
    expect(html).toContain('<strong>gras</strong>');
  });

  it('ne laisse pas une formule injecter du HTML', () => {
    const html = rendreMarkdown(
      '$\\href{javascript:alert(1)}{x}$ et $<img src=x onerror=alert(1)>$',
    );
    expect(html).not.toMatch(/javascript:|onerror/);
  });

  it('prépare une leçon pour la base (HTML et bonne réponse séparée)', () => {
    const l = preparerLecon(lecon());
    expect(l.contenuHtml).toContain('<h2>');
    expect(l.exercices[0].corrigeHtml).toContain('katex');
    expect(l.quiz[0]).toMatchObject({ bonne: 1 });
    expect(l.quiz[0].explication).toContain('On double');
  });
});
