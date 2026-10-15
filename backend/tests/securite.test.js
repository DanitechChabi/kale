import { describe, expect, it } from 'vitest';
import {
  genererMotDePasseTemporaire,
  hacherMotDePasse,
  schemaMotDePasse,
  verifierMotDePasse,
} from '../src/utils/motDePasse.js';
import { analyserIdentifiant, normaliserTelephone } from '../src/utils/identifiants.js';
import {
  dureeEnMs,
  empreinteJeton,
  signerJetonAcces,
  verifierJetonAcces,
} from '../src/utils/jetons.js';
import { detecterTypeFichier } from '../src/utils/fichiers.js';

describe('mots de passe', () => {
  it('hache avec un sel aléatoire et vérifie correctement', async () => {
    const h1 = await hacherMotDePasse('Bonjour2026');
    const h2 = await hacherMotDePasse('Bonjour2026');
    expect(h1).not.toBe(h2);
    expect(h1).toMatch(/^scrypt\$/);
    expect(await verifierMotDePasse('Bonjour2026', h1)).toBe(true);
    expect(await verifierMotDePasse('bonjour2026', h1)).toBe(false);
    expect(await verifierMotDePasse('Bonjour2026', 'n’importe quoi')).toBe(false);
  });

  it('applique la règle de complexité', () => {
    expect(schemaMotDePasse.safeParse('court1').success).toBe(false);
    expect(schemaMotDePasse.safeParse('sanschiffre').success).toBe(false);
    expect(schemaMotDePasse.safeParse('12345678').success).toBe(false);
    expect(schemaMotDePasse.safeParse('Cotonou2026').success).toBe(true);
  });

  it('génère des mots de passe temporaires valides et sans caractère ambigu', () => {
    for (let i = 0; i < 50; i++) {
      const mdp = genererMotDePasseTemporaire();
      expect(mdp).toHaveLength(10);
      expect(mdp).not.toMatch(/[0O1lI]/);
      expect(schemaMotDePasse.safeParse(mdp).success).toBe(true);
    }
  });
});

describe('identifiants', () => {
  it('normalise les numéros béninois', () => {
    expect(normaliserTelephone('01 97 00 00 00')).toBe('+2290197000000');
    expect(normaliserTelephone('97000000')).toBe('+2290197000000');
    expect(normaliserTelephone('+229 01 97 00 00 00')).toBe('+2290197000000');
    expect(normaliserTelephone('00229 0197000000')).toBe('+2290197000000');
    expect(normaliserTelephone('+33612345678')).toBe('+33612345678');
    expect(normaliserTelephone('12')).toBeNull();
  });

  it('distingue e-mail et téléphone', () => {
    expect(analyserIdentifiant(' Afi@Ecole.BJ ')).toEqual({ email: 'afi@ecole.bj' });
    expect(analyserIdentifiant('97 00 00 00')).toEqual({ telephone: '+2290197000000' });
    expect(analyserIdentifiant('abc')).toBeNull();
  });
});

describe('jetons', () => {
  it('signe et vérifie un jeton d’accès', () => {
    const jeton = signerJetonAcces({
      id: '7f1d6c1e-1b2a-4c3d-8e9f-0a1b2c3d4e5f',
      role: 'ENSEIGNANT',
      ecoleId: 'e1',
    });
    const charge = verifierJetonAcces(jeton);
    expect(charge.sub).toBe('7f1d6c1e-1b2a-4c3d-8e9f-0a1b2c3d4e5f');
    expect(charge.role).toBe('ENSEIGNANT');
  });

  it('refuse un jeton altéré', () => {
    const jeton = signerJetonAcces({ id: 'x', role: 'PARENT' });
    const altere = jeton.slice(0, -2) + (jeton.endsWith('a') ? 'bb' : 'aa');
    expect(() => verifierJetonAcces(altere)).toThrow();
  });

  it('calcule une empreinte stable et convertit les durées', () => {
    expect(empreinteJeton('abc')).toBe(empreinteJeton('abc'));
    expect(empreinteJeton('abc')).toHaveLength(64);
    expect(dureeEnMs('15m')).toBe(900_000);
    expect(dureeEnMs('7d')).toBe(604_800_000);
    expect(() => dureeEnMs('demain')).toThrow();
  });
});

describe('fichiers', () => {
  it('reconnaît PDF, PNG et JPEG par leur signature et refuse le reste', () => {
    expect(detecterTypeFichier(Buffer.from('%PDF-1.7 ...'))?.extension).toBe('pdf');
    expect(
      detecterTypeFichier(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))
        ?.extension,
    ).toBe('png');
    expect(detecterTypeFichier(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.extension).toBe('jpg');
    expect(detecterTypeFichier(Buffer.from('<html><script>'))).toBeNull();
    expect(detecterTypeFichier(Buffer.from('MZ executable'))).toBeNull();
  });
});
