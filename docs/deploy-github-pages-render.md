# Déploiement en ligne — Kalé (Phase 0)

Mise en ligne de la PWA web (GitHub Pages) + backend santé minimal (Render).
Tout est **gratuit**.

| Composant | Hébergement | Coût |
|---|---|---|
| PWA web (React/Vite) | GitHub Pages | 0 € |
| Backend `GET /health` | Render (plan free) | 0 € |
| Base de données | — (pas encore en Phase 0) | — |

## Architecture

```
Navigateur
   │
   ├─ https://danitechchabi.github.io/kale/   (PWA statique)
   │        │
   │        └── fetch /health ─────────────►  https://kale-api.onrender.com
   │                                              (backend Node temporaire)
```

> Le backend santé est **temporaire** (`services/health-api`, Node sans
> dépendance). Il sera remplacé par le backend Elixir/Phoenix (`apps/backend`)
> quand celui-ci existera.

---

## 1. La PWA (GitHub Pages) — déjà déployée ✅

Le workflow `.github/workflows/pages.yml` :
- build `apps/web` avec `VITE_API_BASE` (variable du repo `API_BASE`),
- publie `apps/web/dist` sur Pages à chaque push sur `main`.

Site : **https://danitechchabi.github.io/kale/**

### Changer l'URL de l'API sans toucher au code

`Settings → Secrets and variables → Actions → Variables` :
créer la variable **`API_BASE`** avec l'URL du backend, puis relancer
le workflow `Deploy PWA → GitHub Pages` (Actions → workflow → Run workflow).

---

## 2. Le backend (Render) — à connecter

### Prérequis
- Un compte gratuit sur [render.com](https://render.com) (pas de carte bancaire).

### Étapes
1. Sur Render : **New → Blueprint**.
2. Connecter le compte GitHub **DanitechChabi** et sélectionner le repo `kale`.
3. Render détecte le blueprint `render.yaml` (racine du dépôt, `rootDir:
   services/health-api`) → « 1 service selected ».
4. Le service est nommé **`kale-api`** → l'URL devient
   `https://kale-api.onrender.com`.
   (Si Render attribue un autre nom, noter l'URL finale.)
5. **Apply Blueprint** → le service démarre (plan free).

### Vérification
```bash
curl https://kale-api.onrender.com/health
# → {"status":"ok","version":"0.1.0","db":"up","timestamp":"..."}
```

### Brancher la PWA sur ce backend
1. Créer la variable `API_BASE = https://kale-api.onrender.com`
   (voir section 1).
2. Relancer le workflow Pages.
3. Ouvrir `https://danitechchabi.github.io/kale/` → **« Backend connecté »**.

> ⚠️ Plan gratuit : le service s'endort après ~15 min sans trafic. La première
> requête après le sommeil met ~30–60 s à répondre (le temps de redémarrer).

---

## 3. Mise à jour du déploiement

- **PWA** : un push touchant `apps/web/**` redéploie automatiquement.
- **Backend** : tant que le repo est lié en Blueprint, un push touchant
  `services/health-api/**` redéploie aussi automatiquement.

---

## Variables d'environnement utiles

| Variable | Où | Rôle |
|---|---|---|
| `API_BASE` | GitHub → repo → Variables | URL du backend injectée dans la PWA |
| `VITE_BASE_PATH` | build PWA (optionnel) | `/kale/` par défaut ; `/` pour un domaine dédié |
| `PORT` | Render | port d'écoute (injecté automatiquement) |
| `CORS_ORIGIN` | Render (optionnel) | restreindre les origines autorisées (défaut `*`) |

## Prochaines étapes (quand le vrai backend arrive)

1. Créer l'app Phoenix dans `apps/backend`.
2. Pointer `API_BASE` vers l'URL du backend Phoenix.
3. Ajouter PostgreSQL managé gratuit (Neon) et Redis (Upstash) quand la
   Phase 1 (auth OTP, messagerie) démarre.
4. Supprimer `services/health-api`.
