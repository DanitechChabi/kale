# ADR 0005 — Stack 100 % gratuite (zéro budget)

## Statut
Accepté (Phase 0).

## Contexte
L'utilisateur n'a actuellement aucun budget. Tout choix payant est exclu au MVP.

## Décision — tiers gratuits
| Besoin | Choix gratuit | Note |
|---|---|---|
| Postgres | **Neon** (0,5 Go, 190 h compute/mois) | ou auto-hébergé sur la VM Oracle |
| Redis | **Upstash** (gratuit) ou Redis local en dev | |
| Stockage objet + CDN | **Cloudflare R2** (10 Go, **0 € egress**) | MinIO en dev (parité locale) |
| Push | **FCM** | |
| SMS OTP | **FakeSMS** en dev (code `000000`) | SMS réels = payants, uniquement en prod |
| CI/CD | **GitHub Actions** (2 000 min/mois) | |
| Hébergement dev | localhost + Docker + **Cloudflare Tunnel** | test sur téléphone réel |
| Hébergement prod | **Oracle Cloud Always Free** (VM ARM 4 OCPU / 24 Go / 200 Go, gratuit à vie) | sans carte bancaire |

Dépenses différées (inévitables, repoussées) : SMS réels (prod), 25 $ Google Play (une fois),
éventuellement un domaine (~5–10 €/an).

## Conséquences
- Tout le cycle dev/test/prod MVP est à 0 €.
- Quand un tier gratuit atteint ses limites → consolidation sur la VM Oracle (Postgres + Redis +
  MinIO self-hosted) plutôt que de payer.
