import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';

function rendre(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

describe('Application', () => {
  it('affiche la page d’accueil avec les quatre espaces', () => {
    rendre('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/sans vous déplacer/);
    for (const espace of ['École', 'Élève', 'Parent', 'Ministère']) {
      expect(screen.getByRole('heading', { level: 3, name: espace })).toBeInTheDocument();
    }
  });

  it('affiche le logo dans l’en-tête', () => {
    rendre('/');
    expect(screen.getByRole('link', { name: /EduRelevé — accueil/ })).toBeInTheDocument();
  });

  it('affiche une page 404 pour une route inconnue', () => {
    rendre('/nimporte-quoi');
    expect(screen.getByRole('heading', { name: 'Page introuvable' })).toBeInTheDocument();
  });
});
