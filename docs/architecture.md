# Kalé — Architecture

## Vue d'ensemble

```
                    ┌────────────────────────────────────────────┐
                    │               Kalé Backend                  │
                    │          Elixir / Phoenix (BEAM)            │
                    │                                            │
  Flutter ──────────►│  REST JSON (controllers)                   │
  (Android-first)    │  Channels WebSocket/LongPoll (ChatChannel) │
  PWA React ────────►│  Phoenix.Presence (présence)               │
  (Chrome/Android)   │  Contexts métier (authorization)           │
                    └───────┬──────────────┬───────────────┬──────┘
                            │              │               │
                   ┌────────▼─────┐ ┌──────▼──────┐  ┌─────▼──────────┐
                   │ PostgreSQL    │ │ Redis       │  │ R2 / MinIO     │
                   │ (source de    │ │ (cache,     │  │ (objets, CDN)  │
                   │  vérité,      │ │  timelines, │  │ AVIF/WebP      │
                   │  pgvector,    │ │  présence,  │  │ hash percept.  │
                   │  pg_trgm)     │ │  pub/sub)   │  │                │
                   └───────────────┘ └─────────────┘  └────────────────┘
                            │
                   FCM (push, app fermée)   [Phase 2+]
                   Agrégateur paiement (Orange Money)  [Phase 3]
```

## Principes structurants

1. **Un seul backend.** Phoenix possède tout : REST + temps réel + contexts métier. Pas de
   microservices au MVP. (ADR-0001)
2. **OpenAPI-first.** `contracts/openapi.yaml` est la vérité unique. Les clients Dart (Flutter)
   et TS (web) sont générés depuis. Les controllers Phoenix sont testés contre les mêmes schémas.
3. **Offline-first.** Le client est la source locale ; le serveur est la vérité partagée. Delta
   sync + idempotence `client_uuid`. (docs/offline-sync.md)
4. **Data frugale.** Le backend sert du texte et des URLs de médias compressés. Jamais de
   téléchargement auto.
5. **Push-only.** App fermée = FCM. App ouverte = Channels. Rien ne tourne en arrière-plan.
6. **Authorization applicative.** RLS Postgres en défense en profondeur, mais la vérification des
   droits se fait dans les contexts Phoenix (jamais depuis les controllers directement).

## Contexts métier (`lib/kale/`)

| Context | Responsabilités |
|---|---|
| `accounts` | users, OTP (behaviour SMS + FakeSMS/Termii), sessions, devices |
| `chat` | conversations, membres, messages, receipts, présence |
| `communities` | communautés, posts, réactions, follows, feed |
| `market` | annonces, commandes, escrow, paiements (Phase 3) |
| `notifications` | inbox in-app, outbox push, préférences |
| `media` | upload presigné, transformation, hash perceptuel, modération avant stockage |
| `moderation` | signalements, blocages, filtre, file de modération |

## Schéma de flux — envoi de message

1. Le client génère `client_uuid`, persiste le message dans son outbox local, affiche en optimiste.
2. `POST /conversations/:id/messages` (idempotent via `(sender_id, client_uuid)`).
3. Le serveur upsert → broadcast sur `Phoenix.PubSub` aux membres en ligne (`message:new`).
4. Les membres hors ligne reçoivent un push FCM groupé (Phase 2).
5. Le client marque `sent` ; la reconnexion déclenche un delta sync `?after_id=`.
6. `message:read` (throttlé) met à jour `last_read_message_id`.

## Déploiement

- **Dev** : `docker compose up` (postgres, redis, minio) + `mix phx.server`.
- **Prod** : Phoenix self-hosté sur Oracle Cloud Always Free (VM ARM). R2 + CDN Cloudflare en face.
  Cloudflare Tunnel pour exposer le dev local.

## Décisions devenues obsolètes / à réévaluer

- Cassandra : réévaluer en Phase 4 (messages > ~50 M lignes).
- Service Go payments : réévaluer si équipe/compliance l'exige (ADR-0001, ADR-0004).
- E2EE : explicitement écarté (incompatible modération/escrow). HTTPS suffit au MVP.
