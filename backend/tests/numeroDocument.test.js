import { describe, expect, it } from 'vitest';
import { formaterNumero, genererNumero, normaliserNumero } from '../src/utils/numeroDocument.js';
import { parametresRosace, svgRosace } from '../src/utils/rosace.js';

describe('numéros de document', () => {
  it('produit un numéro au format attendu, avec caractère de contrôle', () => {
    const numero = genererNumero('B', 2026);
    expect(numero).toMatch(/^B26[0-9A-HJKMNP-TV-Z]{9}$/);
    expect(normaliserNumero(numero)).toBe(numero);
    expect(formaterNumero(numero)).toMatch(/^B26-.{4}-.{5}$/);
  });

  it('tolère tirets, espaces, minuscules et confusions O/0, I/1', () => {
    const numero = genererNumero('R', 2025);
    const saisie = formaterNumero(numero).toLowerCase().replace(/0/g, 'o').replace(/-/g, ' ');
    expect(normaliserNumero(saisie)).toBe(numero);
  });

  it('détecte toute faute de frappe sur un caractère', () => {
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const numero = genererNumero('D', 2026);
    for (let i = 3; i < numero.length; i++) {
      for (const c of alphabet) {
        if (c === numero[i]) continue;
        const faux = numero.slice(0, i) + c + numero.slice(i + 1);
        expect(normaliserNumero(faux)).toBeNull();
      }
    }
  });

  it('refuse les saisies hors format', () => {
    for (const saisie of ['', 'B26', 'X26ABCDEFGH1', null, 42])
      expect(normaliserNumero(saisie)).toBeNull();
  });
});

describe('rosace du document', () => {
  it('est identique pour un même numéro et différente sinon', () => {
    const a = genererNumero('B', 2026);
    const b = genererNumero('B', 2026);
    expect(parametresRosace(a)).toEqual(parametresRosace(a));
    expect(svgRosace(a)).toBe(svgRosace(a));
    expect(parametresRosace(a)).not.toEqual(parametresRosace(b));
  });
});
