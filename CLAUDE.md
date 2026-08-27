# Kalé — conventions du projet pour développement assisté

## Ce projet

Réseau social communautaire africain « Kalé ». Monorepo : un backend Elixir/Phoenix, une app Flutter,
une PWA React. Conçu pour les réalités africaines : téléphones bas de gamme, 3G, data chère,
offline-first, mobile money. Zéro budget : tiers gratuits uniquement.

## Contraintes de design (non négociables)

1. **Data frugale** : ~1–3 Ko par message texte. Texte d'abord, médias compressés (WebP, max 1280 px).
   Jamais de téléchargement auto, jamais de préfetch.
2. **Mobile-first** : tous les écrans pensés pour un téléphone Android 1–2 Go RAM. min SDK 26.
3. **Offline-first** : files d'attente hors-ligne, delta sync, idempotence via `client_uuid`.
4. **Batterie** : push only (FCM), pas de polling, pas de sync en arrière-plan.
5. **Paiements** : jamais de wallet propriétaire. Rails agrégateurs (Orange Money etc.) en Phase 3.

## Règles de code

- **Backend** : contexts Phoenix, pas d'umbrella. Tout passe par les contexts, jamais par `Repo` direct
  depuis les controllers. Argent en `_cents` (jamais de float). Toutes les clés UUID, `timestamptz`,
  soft-delete.
- **API** : OpenAPI-first — `contracts/openapi.yaml` est la vérité unique. Ne pas modifier les clients
  générés à la main.
- **Offline sync** : `client_uuid` sur `messages` = cheville ouvrière. Ne jamais le concevoir hors.
  Voir `docs/offline-sync.md`.
- **Commits** : petits, un par tranche shippable. Messages en anglais.
- **Format** : `mix format`, `dart format`, Prettier pour le web. `make test` doit rester vert.

## Commandes

```bash
make up          # docker compose up -d (postgres, redis, minio)
make migrate     # mix ecto.migrate
make seed        # mix run priv/repo/seeds.exs
make dev-api     # mix phx.server (port 4000)
make dev-mobile  # cd apps/mobile && flutter run
make dev-web     # cd apps/web && npm run dev
make test        # mix test + flutter test + npm test
```

## Anti-scope-creep

Si un feature ne survit pas au contact d'un téléphone Android 1–2 Go RAM sur 3G, il est hors MVP.
Pas d'E2EE, pas de wallet, pas de web3, pas de Kafka, pas d'ads avant la Phase 4.

## Vérification

- `curl localhost:4000/health` → `{"status":"ok"}`
- `make test` vert après chaque tranche
- Tests manuels sur vrai téléphone bas de gamme via proxy 3G (~300 kbps, 5 % perte)
