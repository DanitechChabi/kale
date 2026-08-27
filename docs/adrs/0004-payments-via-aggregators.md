# ADR 0004 — Paiements via agrégateurs, jamais de wallet

## Statut
Accepté (Phase 0, appliqué en Phase 3).

## Contexte
Le marché africain repose sur le mobile money : Orange Money (dominant en Afrique de l'Ouest
francophone), MTN MoMo, M-Pesa. Un solo dev ne peut pas maintenir les intégrations directes des
3 opérateurs + la conformité + le KYC. Et on n'a pas le budget pour une licence paiement.

## Décision
- **Phase 3** : agrégateurs **CinetPay** (CIV) ou **PayDunya** (Sénégal) derrière un behaviour
  `Kale.Market.Payments.Provider` (Orange Money d'abord, puis MTN MoMo, Moov).
- **Jamais de wallet propriétaire** : on roule sur les rails existants. L'escrow est un simple état
  `held` en Postgres (paiement retenu côté agrégateur, libération à la confirmation ou fenêtre 7 j).
- Le service `services/payments/` (Go) reste **vide** jusqu'à la Phase 3, et même alors probablement
  inutile : l'agrégateur isole déjà les APIs opérateurs.

## Conséquences
- Comportement `Provider` = interface pour la sandbox (mode test) et les webhooks.
- L'argent est stocké en `_cents` (jamais de float), FCFA d'abord.
- Aucun risque de détention de fonds (pas de licence nécessaire au MVP).
