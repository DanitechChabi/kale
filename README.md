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
# 1. Variables d'environnement
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. Base de données PostgreSQL
docker compose up -d

# 3. Dépendances (racine + backend + frontend)
npm run install:tout

# 4. Base de données : tables, protections, puis référentiel national
npm run prisma:deploy --prefix backend   # applique les migrations
npm run prisma:seed --prefix backend     # départements, communes, séries, matières

# 5. Lancer l'API (http://localhost:4000) — dans un premier terminal
npm run dev:backend

# 6. Lancer le frontend (http://localhost:5173) — dans un second terminal
npm run dev:frontend
```

En développement, le frontend appelle `/api`, que Vite redirige vers `http://localhost:4000`.

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
3. Authentification et rôles
4. Gestion scolaire (élèves, classes, matières, inscriptions, import Excel)
5. Notes, moyennes pondérées, rangs, clôture de trimestre
6. Relevés PDF archivés, QR code, vérification publique, duplicatas
7. Espace parent et notifications
8. Emplois du temps et cours en ligne
9. Tableau de bord ministère
10. Données de démonstration et parcours jury (DEMO.md)
