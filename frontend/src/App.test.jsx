import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => vi.unstubAllGlobals());

  it('affiche la page d’accueil et indique que le serveur est connecté', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ statut: 'ok' }) }),
    );
    rendre('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/sans vous déplacer/);
    expect(screen.getByText('Ministère')).toBeInTheDocument();
    expect(await screen.findByText('Serveur connecté')).toBeInTheDocument();
  });

  it('signale un serveur injoignable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    rendre('/');
    expect(await screen.findByText('Serveur injoignable')).toBeInTheDocument();
  });

  it('affiche une page 404 pour une route inconnue', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    rendre('/nimporte-quoi');
    expect(screen.getByText('Page introuvable')).toBeInTheDocument();
  });
});
