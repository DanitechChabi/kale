# ADR 0003 — Client Flutter Android-first (la PWA ≠ Opera Mini)

## Statut
Accepté (Phase 0).

## Contexte
≈ 100 % des internautes africains passent par mobile ; Transsion domine avec des téléphones 1–2 Go
RAM, Android 8–11. La data est chère. Le store Google Play = 25 $ (seule dépense inévitable à terme).

## Décision
- **Flutter** = client mobile principal (min SDK 26, compatible Android Go), une seule base de code.
- **PWA React + Vite** = client web mobile-first pour Chrome/Android.
- **Android-first** : iOS reporté en Phase 4 (la PWA couvre les utilisateurs iOS en attendant).
- **Opéra Mini assumé** : une PWA React SPA ne marche PAS en mode Extreme (le proxy d'Opéra Mini
  rend le HTML serveur-side). Le vrai couvert feature-phone = Phase 4 (web lite server-rendered
  Phoenix + USSD/SMS).

## Conséquences
- `apps/mobile/` = Flutter, `apps/web/` = PWA React.
- Tous les écrans conçus pour un écran de téléphone bas de gamme d'abord.
- Les notifications push (app fermée) reposent sur FCM — voir Phase 2.
