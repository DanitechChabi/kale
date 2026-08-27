# Kalé — Modèle de données (PostgreSQL)

Conventions : clés **UUID**, `timestamptz`, **soft-delete** (`deleted_at`), argent en **`_cents`**
(int, jamais float). L'autorisation se fait dans les contexts applicatifs ; RLS = défense en
profondeur.

## Identité

```sql
users(id, phone E.164 UNIQUE, phone_verified_at, username UNIQUE, full_name, bio,
      avatar_url, language DEFAULT 'fr', is_verified, is_banned, metadata JSONB,
      created_at, last_seen_at)
devices(id, user_id FK, platform, fcm_token, apns_token, app_version, locale, last_active_at)
otp_codes(id, phone, code_hash, purpose ['signup','login'], expires_at, attempts, used_at)
sessions(id, user_id FK, refresh_token_hash, device_id, expires_at, revoked_at)
```

## Chat

```sql
conversations(id, type ['dm','group'], title, avatar_url, created_by, settings JSONB, last_message_at)
conversation_members(conversation_id, user_id, role, muted_until, last_read_message_id,
                     is_active, PK(conversation_id, user_id))
messages(id, conversation_id, sender_id, client_uuid,          -- UNIQUE(sender_id, client_uuid) = idempotence
         type ['text','image','audio','video','location','system'],
         content, media JSONB, reply_to_id, deleted_at)
-- index (conversation_id, id DESC)  → pagination
-- index (conversation_id, after_id) → delta sync
```

`client_uuid` sur `messages` est **la cheville ouvrière du offline sync** — ne jamais le concevoir hors.

## Communautés & fil

```sql
communities(id, name, slug UNIQUE, description, avatar_url, owner_id, privacy, category, settings JSONB)
community_members(community_id, user_id, role ['owner','admin','mod','member'], status,
                  PK(community_id, user_id))
posts(id, community_id NULLABLE, author_id, parent_post_id, content, media JSONB, location,
      like_count, comment_count, deleted_at)
-- GIN trigram sur content ; index (created_at DESC) pour le feed
reactions(post_id, user_id, emoji, PK(post_id, user_id, emoji))
follows(follower_id, followee_id, PK(follower_id, followee_id))
embeddings(entity_type, entity_id, vector(384), model)   -- pgvector, recherche/reco
```

## Marché (Phase 3)

```sql
marketplace_listings(id, seller_id, category, title, description, price_cents,
                     currency ['XOF','XAF','EUR','USD'], condition, location, media JSONB,
                     status ['draft','active','sold','hidden','flagged'], expires_at)
orders(id, listing_id, buyer_id, seller_id, amount_cents, currency,
       status ['pending','paid','shipped','delivered','completed','cancelled','disputed'])
escrow_transactions(id, order_id, provider ['orange_money','mtn_momo','moov','m-pesa'], phone,
                    status ['initiated','held','released','refunded'], provider_ref,
                    amount_cents, fees_cents, timeline JSONB)
disputes(id, order_id, opened_by, reason, status ['open','resolved','refunded'],
         resolution, closed_at)
reviews(order_id, reviewer_id, reviewee_id, rating 1..5, comment, PK(order_id, reviewer_id))
```

## Plateforme

```sql
notifications(id, user_id, type, title, body, data JSONB, read_at)
notification_settings(user_id, chat_messages, feed, market, ...)
moderation_reports(id, reporter_id, target_type, target_id, reason, status, handled_by)
blocks(blocker_id, blocked_id, PK(blocker_id, blocked_id))
media_hashes(sha256, phash, nsfw_score, cloud_vision_label, status)  -- dédup + cache modération
feature_flags(key, value JSONB)
```

## Règles d'or

- Argent : `_cents`, jamais de float. Multi-devises ajoutées plus tard (FCFA d'abord).
- Timestamps : `timestamptz`, gérés par Ecto.
- Relations : UUID partout, clés étrangères nommées `<chose>_id`.
- Les messages ne sont **jamais** physiquement supprimés au MVP (soft-delete + modération).
