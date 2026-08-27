# Kalé

> **Kalé — la voix de ta communauté.**

Un réseau social communautaire africain, tout-en-un : messagerie (type WhatsApp), fil d'actualités,
communautés et marché — conçu pour les réalités du continent (téléphones bas de gamme, réseaux 3G,
data chère, usage mobile-only, paiement mobile money).

## Ambition

Devenir le n°1 en Afrique, utilisable partout dans le monde.

## Les 8 contraintes non négociables

1. **Téléphones bas de gamme** — min SDK Android 26, RAM/CPU optimisés (Transsion ≈ 51 % du marché).
2. **Réseaux 3G dégradés** — perte de paquets, latence, connectivité instable.
3. **La data est la contrainte** — benchmark WhatsApp : 1–3 Ko par message (1 000 messages < 3 Mo).
4. **Batterie** — push only, pas de polling, pas de sync en arrière-plan.
5. **Taille d'app < 40 Mo** — APK petit, lazy-load.
6. **Mobile-only** — ≈ 100 % des internautes africains passent par mobile.
7. **Offline-first** — files d'attente hors-ligne, delta sync, re-sync à la reconnexion.
8. **Paiements sur les rails existants** — Orange Money, MTN MoMo, M-Pesa. Jamais de wallet propriétaire.

## Stack

| Couche | Choix |
|---|---|
| Backend (unique) | Elixir / Phoenix (BEAM) — REST + Channels temps réel |
| Mobile | Flutter (Android-first, min SDK 26) |
| Web | PWA React + Vite (mobile-first) |
| Base de données | PostgreSQL (source de vérité) + pgvector |
| Cache / présence / timelines | Redis |
| Stockage objet + CDN | Cloudflare R2 (0 € egress) |
| Push | FCM |
| Hébergement | Dev : localhost + Docker. Prod : Oracle Cloud Always Free |

## Structure

```
kale/
├── apps/          # backend (Phoenix), mobile (Flutter), web (PWA)
├── contracts/     # openapi.yaml — source unique de vérité de l'API
├── docs/          # architecture, data-model, offline-sync, ADRs
├── packages/      # client API généré, design tokens
├── services/      # payments (Go) — vide jusqu'à la Phase 3
├── infra/         # cloudflare, deploy, github workflows
└── tools/         # scripts dev
```

## Démarrage rapide

```bash
make up        # démarre postgres + redis + minio (Docker)
make dev-api   # lance le backend Phoenix sur :4000
make dev-mobile
make dev-web
make test      # tous les tests
```

## Roadmap

- **Phase 0** — Fondations (auth + health + scaffold des 3 apps)
- **Phase 1** — MVP : auth OTP, messagerie, feed minimal
- **Phase 2** — Communautés, feed v2, push, recherche
- **Phase 3** — Marché + mobile money + escrow
- **Phase 4** — Scale, monétisation, langues vernaculaires

Détails dans `docs/` et le plan d'implémentation.
