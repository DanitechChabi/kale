# Mettre EduRelevé en ligne sur Render (depuis un téléphone)

EduRelevé se déploie en **un seul service** : l'API sert aussi le site, à la même adresse.
Tout se fait depuis le navigateur du téléphone, sans installer quoi que ce soit.

## Étapes

1. Ouvrir **dashboard.render.com** et se connecter avec GitHub.
2. Appuyer sur **New +** → **Blueprint**.
3. Choisir le dépôt **kale**, puis la branche **claude/benin-school-platform-phase-1-knv2m4**.
   Render lit le fichier `render.yaml` et propose : une base PostgreSQL `edureleve-db` et un
   service web `edureleve`.
4. Renseigner les 4 valeurs demandées (premier compte administrateur) :

   | Variable                   | Exemple                                    |
   | -------------------------- | ------------------------------------------ |
   | `SUPER_ADMIN_NOM`          | `CHABI`                                    |
   | `SUPER_ADMIN_PRENOMS`      | `Daniel`                                   |
   | `SUPER_ADMIN_TELEPHONE`    | `01 97 00 00 00`                           |
   | `SUPER_ADMIN_MOT_DE_PASSE` | 8 caractères au moins, lettres et chiffres |

5. Appuyer sur **Apply**. Le premier déploiement prend 5 à 10 minutes.
6. Ouvrir l'adresse affichée (`https://edureleve-xxxx.onrender.com`) et se connecter avec le
   téléphone et le mot de passe choisis.

Au premier démarrage, le service applique les migrations, charge le référentiel national
(départements, communes, séries, matières) et crée le compte administrateur. Les démarrages
suivants ne recréent rien.

## Mises à jour

Chaque `git push` sur la branche redéploie automatiquement.

## Limites du plan gratuit

- **Mise en veille** : sans visite pendant 15 minutes, le service s'endort ; la visite suivante
  attend environ 50 secondes. Pour une présentation, ouvrir le site quelques minutes avant.
- **Fichiers déposés** : le disque du service gratuit est effacé à chaque redéploiement ou
  redémarrage. Les pièces justificatives déposées disparaissent alors (leurs références restent
  en base). Un stockage durable (disque Render payant ou stockage objet gratuit) sera branché
  avant l'archivage des relevés PDF en phase 6.
- **Base de données gratuite** : Render limite à une base gratuite par compte et la supprime
  après 30 jours. Pour un usage durable, passer au plan payant ou utiliser une base externe
  (par exemple Neon) en remplaçant `DATABASE_URL`.
