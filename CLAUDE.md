# EduRelevé — conventions du projet

## Ce projet

Plateforme scolaire multi-établissements (Bénin) : espaces École, Élève, Parent, Ministère.
Fonction centrale : relevés et bulletins archivés définitivement (PDF figé + SHA-256), numéro
unique, QR code, vérification publique `/verifier/:numero`, duplicata en ligne.

Monorepo : `backend/` (Node.js + Express 5, PostgreSQL, Prisma, Zod, JWT accès + rafraîchissement)
et `frontend/` (React + Vite, Tailwind, PWA, interface en français, mobile-first).

## Règles métier (non négociables)

- **Multi-tenant** : toute table métier a un `ecole_id` ; chaque requête est filtrée par
  l'établissement de l'utilisateur. Jamais de données d'une autre école, sauf `MINISTERE`
  (lecture agrégée) et `SUPER_ADMIN`.
- **Rôles** : `SUPER_ADMIN`, `MINISTERE`, `ADMIN_ECOLE`, `SECRETARIAT`, `ENSEIGNANT`, `ELEVE`, `PARENT`.
- **Élève** : champ `npi` optionnel (future interconnexion avec l'État).
- **Notes** : toute création/modification est tracée dans `journal_audit` (qui, quand, ancienne
  valeur, nouvelle valeur). Une note d'un trimestre clôturé n'est plus modifiable.
- **Relevés** : un relevé archivé n'est jamais modifié ni supprimé. Une correction crée un
  nouveau relevé qui référence l'ancien.

## Base de données

- Ne jamais contourner les triggers (relevés, journal d'audit, périodes clôturées) : ils sont la
  dernière ligne de défense. Toute nouvelle règle d'intégrité forte va aussi en SQL dans une
  migration, avec un test dans `backend/tests/db/`.
- Nouvelle migration : `prisma migrate diff --from-migrations prisma/migrations
--to-schema-datamodel prisma/schema.prisma --shadow-database-url … --script`, puis relire le SQL.
  Prisma propose toujours de supprimer `programmes_matieres_unique` (index NULLS NOT DISTINCT
  qu'il ne sait pas décrire) : retirer cette ligne.
- Le référentiel pédagogique est une donnée (`prisma/donnees/`), jamais du code en dur. Une ligne
  `est_verifie = true` (validée par le ministère) n'est jamais écrasée par le seed.
- Vérification des établissements : `SUPER_ADMIN` et `MINISTERE` peuvent valider ou rejeter.

## Sécurité et isolation

- Dans une route d'établissement, toujours utiliser `req.db` (client isolé par `ecole_id`), jamais
  `prisma` directement. Exceptions documentées dans le code : parents (sans `ecole_id`), comptes
  nationaux, unicité globale des identifiants.
- Pas de SQL brut (`$queryRaw`) avec un client isolé.
- Fichiers déposés : contrôle du contenu par signature (`utils/fichiers.js`), jamais par
  l'extension ; servis avec `Content-Disposition: inline` et une CSP `sandbox`.
- Côté web : le jeton d'accès reste en mémoire (jamais `localStorage`).

## Règles de code

- Code commenté en français, noms de variables en français cohérents.
- Validation des entrées avec Zod (middleware `valider`), erreurs au format
  `{ erreur: { code, message, details? } }` via `ErreurApi`.
- Configuration lue uniquement via `src/config/env.js` (validée au démarrage).
- Tests : Vitest (+ Supertest côté API, Testing Library côté web). `npm test` doit rester vert.

## Interface

- Produit professionnel, pas un prototype : aucune mention « prototype », « démo » ou concours
  dans l'interface. Pas d'emojis dans l'UI : icônes `lucide-react`.
- Logo : `components/Logo.jsx` et `branding/*.svg` (icônes générées par `npm run icones`).
- Motion design : `src/animations.css` + `components/animation/` (Apparition, TexteRevele,
  Compteur, Inclinaison, CarteProjecteur). N'animer que `transform` et `opacity` ; toujours
  respecter `prefers-reduced-motion` ; aucune bibliothèque d'animation.
- Couleurs via les jetons Tailwind `marque-*`, `or`, `rouge` définis dans `src/index.css`.

## Méthode de travail

Développement phase par phase (voir README). À la fin de chaque phase : résumé, commandes de test,
puis attendre la validation avant la phase suivante. Poser la question en cas de choix ambigu.
