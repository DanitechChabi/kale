// EduMail : règles pures (consentement, adresse neutre, appels au fournisseur, configuration).
import { describe, expect, it } from 'vitest';
import { adresseDe, genererPartieLocale } from '../src/contexts/edumail/cycleDeVie.js';
import {
  age,
  consentementRequis,
  consentementValable,
} from '../src/contexts/edumail/eligibilite.js';
import {
  appelFournisseur,
  creerSimulation,
  ErreurFournisseur,
  fournisseurEduMail,
} from '../src/contexts/edumail/fournisseurs.js';
import { schemaEnv } from '../src/config/env.js';

describe('EduMail : consentement configurable', () => {
  const eleve = (naissance) => ({ dateNaissance: new Date(naissance) });

  it('calcule un âge révolu', () => {
    expect(age('2010-10-26', new Date('2026-10-25'))).toBe(15);
    expect(age('2010-10-25', new Date('2026-10-25'))).toBe(16);
  });

  it('suit la politique choisie, sans âge par défaut', () => {
    expect(consentementRequis(eleve('2000-01-01'), { EDUMAIL_CONSENTEMENT: 'toujours' })).toBe(
      true,
    );
    expect(consentementRequis(eleve('2015-01-01'), { EDUMAIL_CONSENTEMENT: 'jamais' })).toBe(false);
    const politique = { EDUMAIL_CONSENTEMENT: 'avant_age', EDUMAIL_AGE_CONSENTEMENT: 18 };
    expect(
      consentementRequis({ dateNaissance: new Date(Date.now() - 10 * 3.2e10) }, politique),
    ).toBe(true);
    expect(consentementRequis(eleve('1990-01-01'), politique)).toBe(false);
  });

  it("n'accepte une attestation écrite qu'une fois validée, et jamais retirée", () => {
    expect(consentementValable({ mode: 'ESPACE_PARENT', retireLe: null })).toBe(true);
    expect(
      consentementValable({ mode: 'ATTESTATION_ECRITE', retireLe: null, valideLe: null }),
    ).toBe(false);
    expect(
      consentementValable({ mode: 'ATTESTATION_ECRITE', retireLe: null, valideLe: new Date() }),
    ).toBe(true);
    expect(consentementValable({ mode: 'ESPACE_PARENT', retireLe: new Date() })).toBe(false);
  });
});

describe('EduMail : adresse neutre', () => {
  it('génère une partie locale aléatoire, sans caractères ambigus', () => {
    const parties = new Set(Array.from({ length: 200 }, genererPartieLocale));
    expect(parties.size).toBe(200);
    for (const p of parties) expect(p).toMatch(/^[0-9a-hjkmnp-tv-z]{10}$/);
  });

  it("n'assemble une adresse qu'avec un domaine configuré", () => {
    expect(adresseDe('abc1234567', null)).toBeNull();
    expect(adresseDe('abc1234567', 'Ecole.TEST')).toBe('abc1234567@ecole.test');
  });
});

describe('EduMail : fournisseurs', () => {
  it("le fournisseur par défaut n'est pas prêt et ne crée rien", async () => {
    // Configuration de test sans EDUMAIL_FOURNISSEUR : « aucun »
    const f = fournisseurEduMail();
    expect(f.nom).toBe('aucun');
    expect((await f.etat()).pret).toBe(false);
    await expect(f.creerCompte({})).rejects.toMatchObject({ code: 'NON_CONFIGURE' });
  });

  it('un délai dépassé est un résultat incertain', async () => {
    const lent = () => new Promise((r) => setTimeout(r, 200));
    await expect(appelFournisseur(lent, 20)).rejects.toMatchObject({
      code: 'DELAI_DEPASSE',
      incertain: true,
    });
  });

  it("le message brut d'une erreur inattendue n'est jamais renvoyé", async () => {
    const e = await appelFournisseur(async () => {
      throw new Error('jeton=ya29.secret');
    }).catch((x) => x);
    expect(e).toBeInstanceOf(ErreurFournisseur);
    expect(e.message).not.toContain('secret');
  });

  it('la simulation retrouve un compte par sa clé (reprise sans doublon)', async () => {
    const sim = creerSimulation();
    const { idExterne } = await sim.creerCompte({ cle: 'k1', adresse: 'a@b.test' });
    expect(await sim.trouver({ cle: 'k1' })).toMatchObject({ idExterne });
    expect(await sim.adresseDisponible('a@b.test')).toBe(false);
    await sim.cloturer(idExterne);
    expect(await sim.statut(idExterne)).toBe('CLOTURE'); // désactivé, pas supprimé
  });
});

describe('EduMail : configuration', () => {
  const base = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://u:p@h:5432/b',
    JWT_ACCESS_SECRET: 'x'.repeat(40),
    JWT_REFRESH_SECRET: 'y'.repeat(40),
  };

  it('refuse le fournisseur simulé en production', () => {
    const r = schemaEnv.safeParse({ ...base, EDUMAIL_FOURNISSEUR: 'simulation' });
    expect(r.success).toBe(false);
  });

  it('exige un âge si la politique dépend de l’âge, et un domaine valide', () => {
    expect(schemaEnv.safeParse({ ...base, EDUMAIL_CONSENTEMENT: 'avant_age' }).success).toBe(false);
    expect(schemaEnv.safeParse({ ...base, EDUMAIL_DOMAINE: 'pas un domaine' }).success).toBe(false);
  });
});
