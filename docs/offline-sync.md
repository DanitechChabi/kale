# Kalé — Modèle de synchronisation hors-ligne (offline-sync)

> **Ce document est écrit AVANT le code du chat. Ne laissez personne le redessiner.**

Le problème : l'utilisateur africain est sur 3G, souvent hors-ligne, avec un téléphone 1–2 Go RAM.
La messagerie doit être **offline-first** : composer hors-ligne, envoyer à la reconnexion, zéro
doublon, peu de data (benchmark WhatsApp : 1 000 messages < 3 Mo).

## Les 4 piliers

### 1. Idempotence par `client_uuid`

- Le client génère un `client_uuid` (UUID v4) **pour chaque message**, au moment de la composition.
- `UNIQUE(sender_id, client_uuid)` en base → un re-poste (reconnexion, double-tap) est un **upsert**,
  pas un doublon.
- Le serveur répond toujours avec le `id` serveur + `sent_at` + le `client_uuid` d'origine.

### 2. Outbox locale

- Le client persiste le message dans son stockage local (**Isar** en Flutter, **IndexedDB** en web)
  avec le statut `pending`.
- Affichage optimiste immédiat (brouillon déjà rendu dans le fil).
- L'outbox est vidée sur la reconnexion du socket/API, message par message, dans l'ordre.

### 3. Delta sync (le seul "pull" autorisé)

- **Primitive unique** : `GET /conversations/:id/messages?after_id=<id>`
  → renvoie les messages strictement plus récents que `<id>`, limités (page de 100).
- À la reconnexion : le client demande `after_id = dernier id local connu` → récupère ce qui
  manque, sans re-télécharger l'historique.
- Première ouverture : `before_id` + `limit` pour la pagination arrière (charge progressive).

### 4. Receipts throttlées

- `sent` → le client l'écrit en local dès l'upsert serveur confirmé.
- `delivered` → implicite au delta sync / broadcast.
- `read` → un seul évènement `message:read` avec `last_read_message_id`, throttlé à l'ouverture
  du fil (pas un évènement par message).

## Flux — envoi hors-ligne

```
1. Utilisateur appuie "envoyer"
2. Client : crée client_uuid, insère message (status=pending) dans Isar/IndexedDB, affiche
3. Client : tente POST /conversations/:id/messages
   ├─ OK     → serveur upsert → broadcast aux membres en ligne ; client marque sent
   └─ Échec  → message reste pending dans l'outbox ; écouteur de reconnexion réessaie
4. Reconnexion du socket → le client :
   a. vide l'outbox (les pending, dans l'ordre)
   b. delta sync ?after_id= pour les messages manquants entrants
5. Zéro doublon garanti par (sender_id, client_uuid) + upsert
```

## Contraintes data (à ne pas violer)

- 1 message texte ≈ 1–3 Ko sur le fil. Payload JSON minimaux, pas de champs redondants.
- Images : compressées côté client (WebP, max 1280 px, cible ~100 Ko), jamais uploadées en brut.
- Pas de préfetch : on ne télécharge que ce que l'utilisateur ouvre.
- Le broadcast temps réel ne sert que les membres **en ligne** ; les hors-ligne passent par le
  delta sync (pas de queue serveur par membre au MVP).

## État de sync côté client (modèle de conception)

```
enum SyncStatus { pending, sending, sent, delivered, read, failed }
```

Le fil affiche l'état par message (coche simple ✓, double ✓✓, double bleue ✓✓). C'est la confiance
utilisateur n°1 sur 3G — un message "envoyé" DOIT l'être vraiment.

## Ce qui ne fait PAS partie du MVP

- Multi-appareils en temps réel (un appareil actif au MVP).
- E2EE (explicitement écarté — incompatible modération/escrow).
- File d'attente serveur par membre (push FCM pour app fermée, delta sync pour les autres).
