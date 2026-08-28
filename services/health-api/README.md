# Kalé — health API (Node)

Backend **temporaire** minimal pour la Phase 0 : il expose `GET /health`
afin que la PWA web affiche « Backend connecté ».

> ⚠️ **Temporaire** — à remplacer par le backend Elixir/Phoenix dans
> `apps/backend`. N'ajoutez aucune logique métier ici.

## Routes

| Méthode | Route      | Réponse |
|---|---|---|
| GET     | `/health`  | `200 {"status":"ok","version":"0.1.0","db":"up","timestamp":"..."}` |
| GET     | `/`        | `200 {"service":"kale-health-api","status":"running"}` |
| GET     | *autre*    | `404 {"error":"not_found"}` |

CORS ouvert (`*`) pour que la PWA sur GitHub Pages puisse appeler l'API.
Restreindre via la variable `CORS_ORIGIN` en production.

## En local

```bash
PORT=4000 node index.js
curl http://localhost:4000/health
```

## Déploiement

Le fichier `render.yaml` est un Blueprint Render (plan gratuit).
Voir la procédure dans `docs/deploy-github-pages-render.md`.

- Port d'écoute : `PORT` (Render injecte automatiquement un port libre).
- Démarrer : `node index.js` (aucune dépendance à installer).
