import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import Apparition from './Apparition.jsx';
import Compteur from './Compteur.jsx';
import TexteRevele from './TexteRevele.jsx';

describe('composants d’animation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('Apparition est visible d’emblée sans IntersectionObserver', () => {
    render(<Apparition data-testid="bloc">Contenu</Apparition>);
    expect(screen.getByTestId('bloc')).toHaveAttribute('data-visible', 'true');
  });

  it('Apparition devient visible quand l’élément entre à l’écran', () => {
    let rappel;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(fn) {
          rappel = fn;
        }
        observe() {}
        disconnect() {}
      },
    );
    render(
      <Apparition data-testid="bloc" delai={120}>
        Contenu
      </Apparition>,
    );
    const bloc = screen.getByTestId('bloc');
    expect(bloc).toHaveAttribute('data-visible', 'false');
    expect(bloc.style.getPropertyValue('--delai')).toBe('120ms');
    act(() => rappel([{ isIntersecting: true }]));
    expect(bloc).toHaveAttribute('data-visible', 'true');
  });

  it('TexteRevele conserve le texte complet du titre', () => {
    render(
      <h1>
        <TexteRevele segments={[{ texte: 'Vos relevés,' }, { texte: 'sans déplacement.' }]} />
      </h1>,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Vos relevés, sans déplacement.');
  });

  it('Compteur affiche directement la valeur si les animations sont réduites', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    render(<Compteur valeur={15.5} />);
    expect(screen.getByText('15,50')).toBeInTheDocument();
  });

  it('Compteur atteint sa valeur finale après l’animation', async () => {
    render(<Compteur valeur={13.75} duree={50} />);
    expect(await screen.findByText('13,75', {}, { timeout: 1000 })).toBeInTheDocument();
  });
});
