import { describe, expect, it } from 'vitest';
import {
  champPourEntete,
  detecterEntetes,
  normaliserDate,
  normaliserLigne,
  normaliserSexe,
  separerNomPrenoms,
} from '../src/contexts/import/normalisation.js';

const iso = (d) => d?.toISOString().slice(0, 10) ?? null;

describe('reconnaissance des colonnes', () => {
  it('reconnaît les en-têtes usuels, avec ou sans accents', () => {
    expect(champPourEntete('NOM')).toBe('nom');
    expect(champPourEntete('Prénoms')).toBe('prenoms');
    expect(champPourEntete('Nom et Prénoms')).toBe('nomComplet');
    expect(champPourEntete('Date de naissance')).toBe('dateNaissance');
    expect(champPourEntete('Né(e) le')).toBe('dateNaissance');
    expect(champPourEntete('N° Matricule')).toBe('matricule');
    expect(champPourEntete('Tél. parent')).toBe('telephoneContactParent');
    expect(champPourEntete('Moyenne')).toBeNull();
  });

  it('trouve la ligne d’en-têtes sous les lignes de titre', () => {
    const lignes = [
      ['CEG LES COCOTIERS'],
      ['Liste de la classe de 6e A — 2025-2026'],
      [],
      ['N°', 'Matricule', 'Nom et prénoms', 'Sexe', 'Né(e) le', 'Lieu'],
      [1, '2025-0001', 'DOSSOU Afi', 'F', '12/03/2014', 'Cotonou'],
    ];
    const { index, colonnes } = detecterEntetes(lignes);
    expect(index).toBe(3);
    expect(colonnes.filter((c) => c.champ).map((c) => c.champ)).toEqual([
      'matricule',
      'nomComplet',
      'sexe',
      'dateNaissance',
      'lieuNaissance',
    ]);
  });
});

describe('normalisation des valeurs', () => {
  it('sépare nom et prénoms dans une seule colonne', () => {
    expect(separerNomPrenoms('DOSSOU Afi Mireille')).toEqual({
      nom: 'DOSSOU',
      prenoms: 'Afi Mireille',
    });
    expect(separerNomPrenoms('DE SOUZA Jean-Marc')).toEqual({
      nom: 'DE SOUZA',
      prenoms: 'Jean-Marc',
    });
    expect(separerNomPrenoms('hounsou koffi')).toEqual({ nom: 'HOUNSOU', prenoms: 'Koffi' });
  });

  it('reconnaît le sexe sous toutes ses formes', () => {
    for (const v of ['M', 'm', 'Masculin', 'G', 'garçon']) expect(normaliserSexe(v)).toBe('M');
    for (const v of ['F', 'Féminin', 'fille']) expect(normaliserSexe(v)).toBe('F');
    expect(normaliserSexe('?')).toBeNull();
  });

  it('comprend les formats de date courants', () => {
    expect(iso(normaliserDate('12/03/2014'))).toBe('2014-03-12');
    expect(iso(normaliserDate('12-03-14'))).toBe('2014-03-12');
    expect(iso(normaliserDate('2014-03-12'))).toBe('2014-03-12');
    expect(iso(normaliserDate('12 mars 2014'))).toBe('2014-03-12');
    expect(iso(normaliserDate('1er janvier 2013'))).toBe('2013-01-01');
    expect(iso(normaliserDate(41710))).toBe('2014-03-12'); // numéro de série Excel
    expect(iso(normaliserDate(new Date(Date.UTC(2014, 2, 12))))).toBe('2014-03-12');
    expect(normaliserDate('31/02/2014')).toBeNull();
    expect(normaliserDate('bientôt')).toBeNull();
  });

  it('produit une fiche propre avec erreurs et avertissements', () => {
    const { donnees, erreurs, avertissements } = normaliserLigne(
      {
        nomComplet: 'AHOUANDJINOU Jean-Baptiste',
        sexe: 'G',
        dateNaissance: '05/09/13',
        lieuNaissance: 'porto-novo',
        telephoneContactParent: '97 00 11 22',
      },
      { aujourdHui: new Date('2026-10-01') },
    );
    expect(erreurs).toEqual([]);
    expect(avertissements).toEqual([]);
    expect(donnees).toMatchObject({
      nom: 'AHOUANDJINOU',
      prenoms: 'Jean-Baptiste',
      sexe: 'M',
      lieuNaissance: 'Porto-Novo',
      telephoneContactParent: '+2290197001122',
    });
    expect(iso(donnees.dateNaissance)).toBe('2013-09-05');

    const incomplete = normaliserLigne(
      { nom: 'X', sexe: 'Z', dateNaissance: '1/1/1960' },
      { aujourdHui: new Date('2026-10-01') },
    );
    expect(incomplete.erreurs).toEqual([
      'Nom manquant',
      'Prénoms manquants',
      'Sexe non reconnu : « Z »',
    ]);
    expect(incomplete.avertissements[0]).toMatch(/Âge inhabituel/);
  });
});
