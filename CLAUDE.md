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
  nouveau relevé qui référence l'ancien. Délivrance seulement après clôture de la période (ou de
  toute l'année) ; le PDF est rendu une seule fois depuis l'instantané `donnees`
  (`contexts/releves/pdf.js`), jamais régénéré. Un seul document d'origine par élève et période
  (index `releves_original_unique`, à retirer aussi des propositions de `migrate diff`).
- **Numéros publics** (`utils/numeroDocument.js`) : B/R/D + année + 8 caractères aléatoires +
  contrôle. La rosace du document (`utils/rosace.js`) dérive du numéro : même tracé sur le PDF et
  sur la page de vérification.

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
  nationaux, unicité globale des identifiants, vérification publique par numéro et dépôt/suivi
  public des duplicatas (`/api/public`, CORS ouvert, limité par IP), catalogue national EduCourses
  (modèles `Ec*`, hors tenant : un profil n'est lisible que par son titulaire, `profilDuCompte`).
- Parents (sans `ecole_id`) : chaque enfant est lu avec `prismaPourEcole(lien.ecoleId)` après
  contrôle du lien (`contexts/suivi/serviceSuivi.js` → `accesEnfant`), jamais autrement.
- SMS : uniquement via `planifier` (`contexts/notifications`) avec une clé d'unicité par
  événement ; jamais d'appel direct au fournisseur. Un SMS envoyé est immuable (trigger).
  Nouveau fournisseur : `fournisseursSms.js` + valeur autorisée de `SMS_FOURNISSEUR`.
- Emplois du temps : conflits classe/enseignant/salle contrôlés dans
  `contexts/emploiDuTemps` ; chevauchement d'une classe refusé aussi par trigger. Un créneau qui a
  servi à l'appel est clos (`valide_au`), jamais supprimé. Heures : `utils/heures.js`.
- Cours et devoirs : publication réservée à l'enseignant de la matière (ou la direction) ; lecture
  élève et parent toujours restreinte à la classe actuelle de l'élève (`classeActuelle`).
- USSD : réponses `CON`/`END` de 182 caractères au plus, touches numériques seulement.
- Fichiers : toujours via `utils/fichiers.js` (pilote `disque` ou `base`) ; la table
  `fichiers_stockes` refuse toute réécriture et toute suppression sous `releves/`.
- `/verifier/:numero` est une page HTML autonome servie par l'API (CSP à nonce, sans JavaScript
  obligatoire, < 16 Ko) : ne pas la déplacer dans l'application React.
- Pas de SQL brut (`$queryRaw`) avec un client isolé.
- Fichiers déposés : contrôle du contenu par signature (`utils/fichiers.js`), jamais par
  l'extension ; servis avec `Content-Disposition: inline` et une CSP `sandbox`.
- Côté web : le jeton d'accès reste en mémoire (jamais `localStorage`).

## EduCourses

- Cours de la 6e à la Terminale : programmes `prisma/donnees/educourses/programmes/*.json`
  (champ `confiance` honnête : officiel, recoupé, reconstitué), leçons
  `prisma/donnees/educourses/cours/<NIVEAU>-<MATIERE>[-SERIES]/CC-LL.md`, format contrôlé par
  `node scripts/verifier-cours.js`. Chargement idempotent (`prisma/educourses.js`, empreinte).
- Markdown + LaTeX rendus côté serveur (`contexts/educourses/rendu.js`, liste blanche, pas de liens).
- La bonne réponse d'un quiz ne quitte jamais le serveur. Offre payante (`EDUCOURSES_PAYANT`)
  désactivée : la 1re leçon de chaque chapitre restera libre.

## Hors connexion

- Saisie des notes : `frontend/src/lib/horsLigne.js` (IndexedDB : file d'envoi, brouillons, copies
  des lectures). Envoi au retour du réseau (événement `online`), jamais d'interrogation périodique.
- Toute écriture rejouable doit être idempotente côté API (identifiant fourni par le client, feuille
  complète renvoyée) et testée.

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
- Identité « le registre » : le vocabulaire visuel vient des documents scolaires — marge rouge du
  cahier (`marge-rouge`), lignes réglées (`cahier`), guillochis (`components/Guilloche.jsx`),
  tampon encreur (`tampon-encre`), chiffres de registre (`chiffres`, IBM Plex Mono). Texte en
  Schibsted Grotesk. Éviter les effets génériques (dégradés flous, cartes arrondies à grosse
  ombre partout, effets « brillance » ou « projecteur »).
- Motion design : `src/animations.css` + `components/animation/` (Apparition, TexteRevele,
  Compteur, Inclinaison) et guillochis qui se tracent. N'animer que `transform`, `opacity` et
  les tracés SVG ; toujours respecter `prefers-reduced-motion` ; aucune bibliothèque d'animation.
- Couleurs via les jetons Tailwind `marque-*`, `encre`, `or`, `sceau`, `rouge` et les neutres
  `slate-*` (teintés de vert) définis dans `src/index.css`.

## Méthode de travail

Développement phase par phase (voir README). À la fin de chaque phase : résumé, commandes de test,
puis attendre la validation avant la phase suivante. Poser la question en cas de choix ambigu.
