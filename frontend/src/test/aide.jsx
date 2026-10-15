import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App.jsx';
import { FournisseurAuth } from '../contexte/Auth.jsx';

const reponseJson = (statut, corps) => ({
  ok: statut >= 200 && statut < 300,
  status: statut,
  json: async () => corps,
  blob: async () => new Blob(),
});

/**
 * Simule l'API : `routes` associe « MÉTHODE /chemin » à [statut, corps].
 * Par défaut, aucune session n'est ouverte.
 */
export function simulerApi(routes = {}) {
  const appels = [];
  const fetch = vi.fn(async (url, options = {}) => {
    const chemin = url.replace(/^\/api/, '').split('?')[0];
    const cle = `${options.method ?? 'GET'} ${chemin}`;
    appels.push({ cle, options });
    const reponse =
      routes[cle] ??
      (cle === 'POST /auth/rafraichir'
        ? [401, { erreur: { code: 'SESSION_INVALIDE', message: 'Session expirée' } }]
        : [404, { erreur: { code: 'INTROUVABLE', message: 'Introuvable' } }]);
    const [statut, corps] = typeof reponse === 'function' ? reponse(options) : reponse;
    return reponseJson(statut, corps);
  });
  vi.stubGlobal('fetch', fetch);
  return { fetch, appels };
}

export function rendreApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <FournisseurAuth>
        <App />
      </FournisseurAuth>
    </MemoryRouter>,
  );
}

export const UTILISATEUR_MINISTERE = {
  id: 'u1',
  role: 'MINISTERE',
  nom: 'DEGBE',
  prenoms: 'Pascal',
  email: 'p.degbe@test.bj',
  telephone: '+2290196000555',
  doitChangerMotDePasse: false,
  ecole: null,
};
