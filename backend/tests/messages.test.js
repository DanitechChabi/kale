import { describe, expect, it } from 'vitest';
import { matiereCourte, messageRecapNotes } from '../src/contexts/notifications/messages.js';
import { moisPrecedent } from '../src/contexts/notifications/recapitulatif.js';

const eleve = { nom: 'AGOSSOU', prenoms: 'Koffi Romuald' };
const periode = { type: 'TRIMESTRE', numero: 1 };

describe('récapitulatif mensuel des notes', () => {
  it('liste les matières et la moyenne de la période', () => {
    const message = messageRecapNotes({
      eleve,
      mois: '2026-10',
      matieres: [
        { matiere: 'Mathématiques', moyenne: 12.75 },
        { matiere: 'Physique-Chimie et Technologie', moyenne: 9 },
      ],
      periode,
      moyenneGenerale: 11.2,
      url: 'https://edureleve.bj/connexion',
    });
    expect(message).toBe(
      'EduRelevé : notes de Koffi AGOSSOU en octobre : Mathématiques 12,75 ; PCT 9,00. Moyenne du 1er trimestre à ce jour : 11,20/20. Détail : edureleve.bj/connexion',
    );
  });

  it('reste dans la longueur maximale', () => {
    const matieres = Array.from({ length: 30 }, (_, i) => ({
      matiere: `Matière${i}`,
      moyenne: 10 + (i % 10),
    }));
    const message = messageRecapNotes(
      { eleve, mois: '2026-01', matieres, periode, moyenneGenerale: 12, url: null },
      200,
    );
    expect(message.length).toBeLessThanOrEqual(200);
    expect(message).toMatch(/ ; …\. Moyenne du 1er trimestre à ce jour : 12,00\/20\.$/);
  });

  it('abrège les intitulés longs en sigles usuels', () => {
    expect(matiereCourte('Sciences de la Vie et de la Terre')).toBe('SVT');
    expect(matiereCourte('Éducation Physique et Sportive')).toBe('EPS');
    expect(matiereCourte('Histoire-Géographie')).toBe('Histoire-Géographie');
    expect(matiereCourte('Français')).toBe('Français');
  });

  it('calcule le mois précédent, y compris en janvier', () => {
    expect(moisPrecedent(new Date('2027-01-03T08:00:00Z'))).toBe('2026-12');
    expect(moisPrecedent(new Date('2026-11-01T08:00:00Z'))).toBe('2026-10');
  });
});
