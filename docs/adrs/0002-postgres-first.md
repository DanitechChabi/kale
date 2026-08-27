# ADR 0002 — PostgreSQL d'abord, Cassandra plus tard

## Statut
Accepté (Phase 0).

## Contexte
Le modèle de messagerie à très grande échelle (WhatsApp/Discord) finit souvent sur Cassandra.
Mais Cassandra est un détour de plusieurs mois qui ne paie qu'au-delà d'un volume massif.

## Décision
- **PostgreSQL** = source de vérité pour TOUT au MVP (profils, posts, relations, conversations,
  messages, notifications).
- **pgvector + pg_trgm** dans Postgres pour la recherche (pas de cluster search séparé).
- **Redis** = cache chaud, timelines, présence, pub/sub.
- **Cassandra** uniquement si `messages` dépasse ~50 M de lignes OU si le partitionnement Postgres
  souffre (Phase 4, réévalué à ce moment).

## Conséquences
- Neon (Postgres managé gratuit) en MVP, consolidation possible sur la VM Oracle plus tard.
- Le modèle d'historique de chat : Redis Streams pour l'append récent, Postgres pour la vérité.
- Un seul SGBD à connaître, tout ce qu'un solo dev peut tenir en tête.
