# EduRelevé

Plateforme scolaire multi-établissements pour le Bénin : notes, bulletins et **relevés archivés
définitivement et vérifiables en ligne** (numéro unique, QR code, empreinte SHA-256). Un ancien
élève peut demander un duplicata sans se déplacer.

## Espaces

| Espace    | Utilisateurs                       | Fonctions principales                                   |
| --------- | ---------------------------------- | ------------------------------------------------------- |
| École     | admin, secrétariat, enseignants    | élèves, classes, matières, notes, emplois du temps      |
| Élève     | élèves et anciens élèves           | notes, cours, relevés, demande de duplicata             |
| Parent    | parents                            | notes, absences, emploi du temps, notifications         |
| Ministère | ministère (lecture seule, agrégée) | tableau de bord par département, commune, établissement |

Page publique sans compte : `/verifier/:numero`.

## Stack

- **Backend** (`backend/`) : Node.js + Express 5, PostgreSQL, Prisma, Zod, JWT (accès + rafraîchissement)
- **Frontend** (`frontend/`) : React 19 + Vite, Tailwind CSS 4, PWA installable, interface en français
- **Base de données** : PostgreSQL 16 via `docker-compose.yml`

```
.
├── backend/
│   ├── prisma/schema.prisma     # schéma de base (modèles en phase 2)
│   ├── src/
│   │   ├── config/              # env (validé par Zod), client Prisma
│   │   ├── middlewares/         # erreurs, validation Zod
│   │   ├── routes/              # routes montées sous /api
│   │   ├── app.js               # construction de l'app Express
│   │   └── server.js            # démarrage du serveur
│   └── tests/                   # Vitest + Supertest
├── frontend/
│   ├── branding/                # logo source (SVG) : icone.svg, icone-pleine.svg
│   ├── public/                  # icônes générées (PWA, Apple, favicon)
│   ├── scripts/                 # generer-icones.mjs
│   └── src/                     # pages, composants, client API, polices
├── docker-compose.yml
└── .env.example
```

## Prérequis

- Node.js **22.12+** (ou 24)
- Docker + Docker Compose (pour PostgreSQL)

## Démarrage

```bash
# 1. Dépendances (racine + backend + frontend) ; crée aussi les fichiers .env
npm run install:tout

# 2. Base de données PostgreSQL
docker compose up -d

# 3. Base de données : tables, protections, puis référentiel national
npm run prisma:deploy --prefix backend   # applique les migrations
npm run prisma:seed --prefix backend     # départements, communes, séries, matières

# 4. Lancer l'API (http://localhost:4000) — dans un premier terminal
npm run dev:backend

# 5. Lancer le frontend (http://localhost:5173) — dans un second terminal
npm run dev:frontend
```

En développement, le frontend appelle `/api`, que Vite redirige vers `http://localhost:4000`.

## Mise en ligne

Déploiement en un seul service sur Render (plan gratuit), faisable depuis un téléphone :
voir [docs/deploiement-render.md](docs/deploiement-render.md).

## Premier compte administrateur

```bash
npm run creer-super-admin --prefix backend -- --nom NOM --prenoms "Prénoms" --telephone 0197000000 --email admin@exemple.bj
```

Le mot de passe temporaire s'affiche une seule fois ; il doit être changé à la première connexion.
Le super-administrateur crée ensuite les comptes du ministère depuis l'API (`POST /api/admin/comptes`).

## Dépannage

- **`P1010: User was denied access on the database`** : un autre PostgreSQL répond à la place de
  celui du projet. Le projet utilise le port **5433** (`.env` et `backend/.env`) ; si vos fichiers
  `.env` datent d'avant ce changement, supprimez-les puis relancez `npm run preparer`, puis
  `docker compose down` et `docker compose up -d`.
- **`GET / 404` sur le port 4000** : normal, le port 4000 est l'API. Le site s'ouvre sur
  http://localhost:5173 (après `npm run dev:frontend`).

## Vérifications

```bash
curl http://localhost:4000/api/sante        # {"statut":"ok",...}
curl http://localhost:4000/api/sante/base   # {"statut":"ok","base":"connectée"}

npm test        # tests backend + frontend
npm run test:db --prefix backend   # règles garanties par PostgreSQL (base edureleve_test)
npm run lint    # ESLint backend + frontend
npm run build   # build de production de la PWA (frontend/dist)
```

Pour tester l'installation PWA : `npm run build && npm run preview --prefix frontend`, puis ouvrir
http://localhost:4173 dans Chrome (menu « Installer l'application »).

## Bulletins, vérification et duplicatas

- **Délivrance** : après la clôture d'une période (ou de toute l'année pour le relevé annuel), le
  secrétariat délivre les documents d'une classe en un geste. Chaque PDF est figé, son empreinte
  SHA-256 enregistrée ; PostgreSQL interdit toute modification. Une correction produit un nouveau
  document qui référence l'ancien, toujours vérifiable avec la mention « remplacé ».
- **Vérification** : le QR code mène à `/verifier/<numéro>`, une page d'environ 8 Ko servie par
  l'API (sans application à charger, utilisable en 2G). Elle affiche la rosace propre au document
  et compare un fichier PDF à l'original sans l'envoyer. Les universités disposent d'une API :
  [docs/api-verification.md](docs/api-verification.md).
- **Duplicata** : `/duplicata` (demande sans compte), `/duplicata/suivi` (suivi et téléchargement
  avec le numéro de suivi et le téléphone), traitement par l'établissement dans « Duplicatas ».
- **Stockage** : `STOCKAGE=base` conserve les fichiers dans PostgreSQL (choix par défaut en
  production) ; `STOCKAGE=disque` les écrit dans `DOSSIER_STOCKAGE`.

## Parents, absences, SMS et USSD

- **Appel** : l'enseignant signale absences et retards (tous présents par défaut). La feuille
  renvoyée complète remplace la précédente ; le secrétariat justifie les absences.
- **Espace parent** : un compte, plusieurs enfants, même dans plusieurs établissements. Notes au fil
  de la période, moyennes, absences, bulletins. Le parent ouvre lui-même son compte sur `/parents`
  avec l'identifiant de l'enfant, sa date de naissance et le téléphone enregistré par l'école.
- **SMS** : chaque absence ou retard relevé, récapitulatif mensuel des notes, bulletin délivré (moyenne, rang, numéro de vérification).
  File d'envoi en base, un seul SMS par événement et par téléphone, 3 tentatives. Brancher un
  opérateur : [docs/sms-ussd.md](docs/sms-ussd.md).
- **USSD** : moyennes, absences et bulletins depuis un téléphone simple, sans internet. Passerelle
  `POST /api/ussd` (fermée sans `USSD_SECRET`) et simulateur dans l'application.

## Emplois du temps, cours et devoirs

- **Emploi du temps** : la direction ou le secrétariat place les cours de chaque classe sur une
  grille du lundi au samedi. Une classe, un enseignant ou une salle ne peuvent pas être à deux
  endroits à la fois (règle aussi garantie par PostgreSQL pour la classe). L'enseignant voit ses
  cours de toutes ses classes ; l'élève et ses parents voient l'emploi du temps de la classe.
- **Appel** : les cours du jour sont proposés en un geste ; l'appel est rattaché au créneau et à
  sa matière. Un créneau déjà utilisé pour l'appel est clos, jamais effacé.
- **Cours en ligne** : PDF (contenu contrôlé, 15 Mo au plus), vidéo ou lien `https`, publiés par
  l'enseignant de la matière pour sa classe.
- **Devoirs** : cahier de textes avec date de remise et pièce jointe ; l'élève coche « fait »
  (même hors connexion), le parent le voit, l'enseignant sait combien l'ont fait.

## Commandes utiles

| Commande                                  | Rôle                                |
| ----------------------------------------- | ----------------------------------- |
| `npm run db:up` / `npm run db:down`       | démarrer / arrêter PostgreSQL       |
| `npm run prisma:migrate --prefix backend` | créer et appliquer une migration    |
| `npm run prisma:studio --prefix backend`  | explorer la base dans le navigateur |
| `npm run format`                          | formater le code avec Prettier      |

## Règles du projet

Voir [CLAUDE.md](CLAUDE.md) : multi-tenant strict par `ecole_id`, rôles, audit des notes,
relevés immuables, code commenté en français.

## Feuille de route

1. ✅ Initialisation (monorepo, docker-compose, Express, Vite, PWA, identité visuelle)
2. ✅ Schéma de base de données (26 tables, triggers, référentiel national)
3. ✅ Authentification, rôles, inscription et vérification des établissements
4. ✅ Gestion scolaire (élèves, classes, matières, inscriptions, import Excel, identifiant élève)
5. ✅ Notes (saisie hors connexion), moyennes pondérées, rangs, détection des notes suspectes, clôture
6. ✅ Bulletins et relevés PDF archivés, QR code, vérification publique légère, API de vérification, duplicatas en ligne
7. ✅ Espace parent, appel et absences, SMS aux parents (fournisseur branchable), service USSD
8. ✅ Emplois du temps (conflits refusés, appel par créneau), cours en ligne (PDF, vidéo, lien), devoirs
9. Tableau de bord ministère
10. Données de démonstration et parcours jury (DEMO.md)
