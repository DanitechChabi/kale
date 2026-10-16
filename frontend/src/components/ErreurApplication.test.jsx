import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErreurApplication from './ErreurApplication.jsx';

function Defaillant() {
  throw new Error('Panne simulée');
}

describe('filet de sécurité de l’affichage', () => {
  it('remplace l’écran blanc par un message et un bouton pour recharger', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErreurApplication>
        <Defaillant />
      </ErreurApplication>,
    );
    expect(screen.getByText('Un problème d’affichage est survenu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recharger la page/ })).toBeInTheDocument();
    expect(screen.getByText(/Panne simulée/)).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
