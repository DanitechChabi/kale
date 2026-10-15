import { describe, expect, it } from 'vitest';
import {
  formaterIdentifiantEleve,
  genererIdentifiantEleve,
  normaliserIdentifiantEleve,
} from '../src/utils/identifiantEleve.js';
import { analyserIdentifiant } from '../src/utils/identifiants.js';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

describe('identifiant EduRelevé de l’élève', () => {
  it('génère des identifiants valides, avec au moins deux lettres', () => {
    for (let i = 0; i < 500; i++) {
      const id = genererIdentifiantEleve();
      expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);
      expect((id.match(/[A-Z]/g) ?? []).length).toBeGreaterThanOrEqual(2);
      expect(normaliserIdentifiantEleve(id)).toBe(id);
    }
  });

  it('accepte une saisie approximative (minuscules, tiret, O pour 0, L pour 1)', () => {
    const id = genererIdentifiantEleve();
    const saisie = formaterIdentifiantEleve(id).toLowerCase().replace(/0/g, 'o').replace(/1/g, 'l');
    expect(normaliserIdentifiantEleve(saisie)).toBe(id);
  });

  it('détecte toute faute de frappe sur un caractère', () => {
    const id = genererIdentifiantEleve();
    for (let position = 0; position < 10; position++) {
      for (const remplacement of ALPHABET) {
        if (remplacement === id[position]) continue;
        const faux = id.slice(0, position) + remplacement + id.slice(position + 1);
        expect(normaliserIdentifiantEleve(faux)).toBeNull();
      }
    }
  });

  it('détecte l’inversion de deux caractères voisins différents', () => {
    let detectees = 0;
    let essais = 0;
    for (let i = 0; i < 200; i++) {
      const id = genererIdentifiantEleve();
      for (let p = 0; p < 9; p++) {
        if (id[p] === id[p + 1]) continue;
        essais++;
        const inverse = id.slice(0, p) + id[p + 1] + id[p] + id.slice(p + 2);
        if (normaliserIdentifiantEleve(inverse) === null) detectees++;
      }
    }
    // Luhn mod N laisse passer quelques paires particulières ; l'immense majorité est détectée
    expect(detectees / essais).toBeGreaterThan(0.95);
  });

  it('est reconnu à la connexion et jamais confondu avec un téléphone', () => {
    const id = genererIdentifiantEleve();
    expect(analyserIdentifiant(formaterIdentifiantEleve(id))).toEqual({ identifiantEleve: id });
    expect(analyserIdentifiant('01 97 00 00 00')).toEqual({ telephone: '+2290197000000' });
    expect(analyserIdentifiant('ABCDE-FGHJK')).toBeNull();
  });
});
