import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { rendreApp, simulerApi } from './test/aide.jsx';

describe('Application', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('affiche la page d’accueil avec les quatre espaces', () => {
    simulerApi();
    rendreApp('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/sans vous déplacer/);
    for (const espace of ['École', 'Élève', 'Parent', 'Ministère']) {
      expect(screen.getByRole('heading', { level: 3, name: espace })).toBeInTheDocument();
    }
  });

  it('affiche le logo et les accès connexion / inscription', async () => {
    simulerApi();
    rendreApp('/');
    expect(screen.getByRole('link', { name: /EduRelevé — accueil/ })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Connexion/ })).toHaveAttribute(
      'href',
      '/connexion',
    );
    expect(screen.getAllByRole('link', { name: /Inscrire mon établissement/ })[0]).toHaveAttribute(
      'href',
      '/inscription-ecole',
    );
  });

  it('affiche une page 404 pour une route inconnue', () => {
    simulerApi();
    rendreApp('/nimporte-quoi');
    expect(screen.getByRole('heading', { name: 'Page introuvable' })).toBeInTheDocument();
  });
});
