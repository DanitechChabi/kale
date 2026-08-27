# ADR 0001 — Un seul backend Elixir/Phoenix (pas de Go, pas de BaaS, pas d'umbrella)

## Statut
Accepté (Phase 0).

## Contexte
Un solo dev (zéro budget) doit construire un réseau social temps réel. Le risque n°1 est un
monorepo avec plusieurs runtimes et services qui se disputent l'attention. L'architecture
recommandée par la recherche initiale mentionnait un service Go pour le fintech.

## Décision
- **Un seul app Phoenix** pour tout : REST JSON + Channels temps réel + contexts métier.
- **Pas de service Go** avant la Phase 3 (et même alors, uniquement si conformité/équipe l'exige).
  L'agrégateur de paiement (CinetPay/PayDunya) isole déjà des APIs opérateurs ; un service Go
  n'apporte rien de plus à cette échelle.
- **Pas de BaaS** (Supabase/Firebase) : on self-host Phoenix sur Oracle Cloud Always Free.
- **Pas d'umbrella Phoenix** : un seul app, contexts en modules. L'umbrella ajoute de la cérémonie
  de compilation/link sans bénéfice pour un solo dev.

## Alternative étudiée
Node.js/TypeScript + Socket.io (un seul langage partout). Viable ; ce serait LE pivot si le dev
n'est pas à l'aise avec Elixir. À trancher avant le 1er commit.

## Conséquences
- `lib/kale/` = contexts (accounts, chat, communities, market, notifications, media, moderation).
- `lib/kale_web/` = transport (router, controllers, channels, json).
- La messagerie temps réel (cœur du produit) bénéficie du modèle BEAM prouvé par WhatsApp.
