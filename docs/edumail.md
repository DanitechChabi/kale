# EduMail — messagerie scolaire des élèves

EduMail permet à un élève du secondaire de demander une adresse de messagerie scolaire. Sa
demande passe par la vérification de l'inscription et le consentement du représentant légal,
puis par une décision de la direction. Le compte est ensuite créé chez un fournisseur de
messagerie.

**État actuel : architecture seule.** Aucun fournisseur réel n'est raccordé et aucun partenariat
n'existe. Le fournisseur par défaut est `aucun` : les demandes peuvent être instruites et
approuvées, mais aucune boîte n'est créée. Le fournisseur `simulation` sert uniquement au
développement et aux tests, et il est refusé au démarrage en production. Toute boîte qu'il
« crée » est marquée simulée partout dans l'interface.

## 1. Parcours

| Étape                                                                                                                     | Qui                                                  | Statut                                                             |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| Demande (rejouable)                                                                                                       | Élève                                                | `A_VERIFIER` ou `EN_ATTENTE_CONSENTEMENT` ou `EN_ATTENTE_DECISION` |
| Vérification de l'inscription de l'année en cours                                                                         | Automatique, revérifiable par l'établissement        | `A_VERIFIER` → suivant                                             |
| Consentement : accord en ligne du parent relié, ou attestation écrite signée déposée puis vérifiée par une autre personne | Parent / secrétariat                                 | → `EN_ATTENTE_DECISION`                                            |
| Décision (motif obligatoire pour un refus)                                                                                | Direction, ou secrétariat sur délégation explicite   | `APPROUVE` / `REFUSE`                                              |
| Création chez le fournisseur (idempotente)                                                                                | Automatique après approbation, relançable            | `EN_COURS` → `ACTIF` ou `ERREUR`                                   |
| Suspension, réactivation, clôture (motif obligatoire)                                                                     | Direction                                            | `SUSPENDU` / `ACTIF` / `CLOTURE`                                   |
| Réinitialisation de l'accès                                                                                               | Élève (mot de passe EduRelevé redemandé) ou décideur | —                                                                  |

Ce qui n'est **jamais** automatique :

- aucune suspension, clôture ou suppression. Un consentement retiré ou une inscription qui prend
  fin marque seulement le compte « à réexaminer » ; la direction décide ensuite ;
- aucune suppression chez le fournisseur : la clôture désactive la boîte ;
- aucune réattribution d'adresse : l'identifiant d'un élève est immuable et unique, et une adresse
  clôturée n'est jamais rouverte ni donnée à un autre élève.

## 2. Format des adresses

`<identifiant>@<EDUMAIL_DOMAINE>`. L'identifiant compte 10 caractères tirés au hasard dans
`0-9 a-z`, sans `i`, `l`, `o` ni `u`. Il ne contient ni le nom, ni le téléphone, ni le NPI, ni le
matricule, ni l'identifiant de connexion. Il est réservé à la première demande, jamais modifié et
jamais réattribué ; la base le garantit par un trigger et des index uniques.

## 3. Variables d'environnement

| Variable                       | Valeurs                           | Défaut     | Rôle                                                                                              |
| ------------------------------ | --------------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| `EDUMAIL_FOURNISSEUR`          | `aucun`, `simulation`             | `aucun`    | Pilote de messagerie (`simulation` refusé en production)                                          |
| `EDUMAIL_DOMAINE`              | nom de domaine                    | vide       | Domaine des adresses. Sans domaine, aucune création                                               |
| `EDUMAIL_URL_WEBMAIL`          | URL `https://`                    | vide       | Lien « Ouvrir la messagerie » (masqué pour un compte simulé)                                      |
| `EDUMAIL_CONSENTEMENT`         | `toujours`, `avant_age`, `jamais` | `toujours` | Politique de consentement du représentant légal                                                   |
| `EDUMAIL_AGE_CONSENTEMENT`     | 1 à 30                            | vide       | Obligatoire avec `avant_age` ; **aucun âge n'est fixé par défaut**                                |
| `EDUMAIL_DELAI_FOURNISSEUR_MS` | ms                                | 15000      | Délai maximal d'un appel au fournisseur (au-delà : résultat incertain, vérifié à la relance)      |
| `LIMITE_EDUMAIL`               | nombre                            | 10         | Demandes sensibles par heure et par compte (demande, signalement, réinitialisation, consentement) |

Le choix de la politique de consentement (et de l'âge éventuel) est une décision juridique : voir §8.

## 4. Base de données

Migration `prisma/migrations/20261025090000_edumail`. Elle est purement additive : nouvelles
tables, nouveaux types, et la colonne `ecoles.edumail_delegation_secretariat` (défaut `false`).
Aucune donnée existante n'est modifiée.

Règles garanties en SQL (tests dans `backend/tests/db/edumail.test.js`) :

- `edumail_identifiants` et `edumail_evenements` : ni modification ni suppression ;
- `edumail_comptes`, `edumail_consentements` : aucune suppression ;
- adresse et identifiant externe figés une fois écrits ; `REFUSE` et `CLOTURE` sont définitifs ;
  le titulaire d'un dossier ne change pas ;
- un seul dossier ouvert par élève (index partiel) ; adresse unique, en minuscules, cohérente avec
  l'identifiant de l'élève ;
- `ACTIF` et `SUSPENDU` exigent une adresse, un fournisseur et un identifiant externe ; refus,
  suspension et clôture exigent un motif ;
- une attestation écrite exige le nom du représentant, la date de signature, la pièce et son
  empreinte SHA-256 ; elle ne peut pas être validée par la personne qui l'a saisie.

**Déploiement** : `npx prisma migrate deploy` (étape habituelle du déploiement Render). **Retour
arrière** : désactiver le module avec `EDUMAIL_FOURNISSEUR=aucun`. Les tables peuvent rester en
place sans effet. Supprimer les tables ferait perdre des traces d'audit : ne le faire qu'après une
décision écrite, et jamais sur une base qui contient des comptes réels.

## 5. Tester en développement

```bash
# backend/.env (développement uniquement)
EDUMAIL_FOURNISSEUR=simulation
EDUMAIL_DOMAINE=edumail.test        # domaine réservé aux tests (RFC 2606)
```

Avec les données de démonstration, le parcours se déroule ainsi :

1. L'élève `SENAH6EA2Q` ouvre EduMail et clique sur « Demander mon compte ».
2. Le parent `+2290100000003` ouvre la fiche de l'enfant, onglet EduMail, et clique sur « Je donne
   mon accord ».
3. La direction `+2290100000010` ouvre EduMail, puis le dossier, et clique sur « Approuver ». Le
   compte simulé est créé.

Les comptes simulés ne vivent qu'en mémoire : un redémarrage les efface. Un dossier `ACTIF` peut
alors renvoyer « fournisseur refusé » lors d'une suspension ; c'est attendu en simulation.

Tests : `npm test` et `npm run test:db` dans `backend/`, puis `npm test` dans `frontend/`.

## 6. Exploitation et surveillance

- **Créations interrompues** : au démarrage, les dossiers restés `EN_COURS` depuis plus de
  10 minutes passent en `ERREUR` (« INTERROMPU »). La relance vérifie d'abord chez le fournisseur
  si la boîte existe (recherche par clé de dossier puis par adresse) avant de créer quoi que ce soit.
- **Vérification quotidienne** (au démarrage puis toutes les 24 h) : les dossiers en attente sont
  réévalués, et les comptes actifs sans inscription ou sans consentement requis sont marqués « à
  réexaminer ».
- **À surveiller** :
  - le nombre de dossiers `ERREUR`, visible par établissement dans la vue nationale du super-admin ;
  - les dossiers « à réexaminer », dans l'onglet de l'établissement ;
  - les événements `ECHEC_*` de l'historique.
- **Réconciliation** (à écrire avec le premier pilote réel) : comparer périodiquement
  `statut(idExterne)` chez le fournisseur avec le statut en base, et signaler les écarts sans les
  corriger automatiquement.
- **Journaux** : aucun mot de passe, jeton ni message brut du fournisseur n'est enregistré. Le mot
  de passe temporaire est renvoyé une seule fois avec l'en-tête `Cache-Control: no-store`.

## 7. Activer un véritable fournisseur — étapes et choix à faire

Rien de ce qui suit n'a été fait. Chaque point demande une décision ou une autorisation.

1. **Choisir le fournisseur** (tableau ci-dessous) et vérifier l'éligibilité de chaque
   établissement, ou d'une entité nationale, auprès de lui.
2. **Domaine** : acquérir ou obtenir un domaine (par exemple un sous-domaine d'un domaine
   institutionnel), puis prouver sa propriété auprès du fournisseur (enregistrement TXT).
   Configurer ensuite les enregistrements MX, SPF, DKIM et DMARC fournis par lui. **Aucun domaine
   n'est considéré comme acquis à ce jour.**
3. **Autorisations** : créer chez le fournisseur un compte de service à privilèges minimaux, limité
   à une unité d'organisation « Élèves EduMail » ; voir les permissions par fournisseur ci-dessous.
4. **Pilote** : ajouter dans `fournisseurs.js` un pilote qui respecte le contrat en tête du fichier.
   Il doit :
   - stocker la clé du dossier dans un attribut personnalisé ou externe, pour retrouver une boîte
     après un incident ;
   - ne jamais renvoyer de message brut ;
   - lire ses secrets uniquement dans `env.js`.
     Ajouter ensuite sa valeur à `EDUMAIL_FOURNISSEUR`, et ses tests en remplaçant les appels HTTP.
5. **Recette** sur un domaine de test chez le fournisseur avec quelques comptes, puis ouverture
   progressive, établissement par établissement.
6. **Politique de clôture** à faire valider (départ, fin de scolarité, durée de conservation) avant
   toute clôture de masse ; aucune clôture automatique n'existe aujourd'hui.

### Comparatif des fournisseurs (à vérifier auprès de chaque éditeur)

Les informations ci-dessous viennent des pages publiques des éditeurs consultées en
octobre 2026. Elles peuvent changer et doivent être confirmées par écrit avant tout engagement.

| Critère                    | Google Workspace for Education                                                                                                                                                                                                                   | Microsoft 365 Éducation                                                                                                                            | Messagerie auto-hébergée (ex. Mailcow, Stalwart)                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Coût                       | Édition _Fundamentals_ gratuite pour les établissements admissibles. Éditions payantes _Standard_ / _Plus_ facturées par élève et par an ; tarifs publiés à vérifier (pages de prix lues : env. 3 $ et 5 $), avec achat minimal selon l'effectif | Plan A1 annoncé gratuit pour les établissements qualifiés ; A3 / A5 payants, sur devis ou via un revendeur                                         | Logiciel gratuit ; coûts de serveur, de sauvegarde, de délivrabilité et d'administration à la charge du projet |
| Éligibilité                | Établissement d'enseignement reconnu (primaire, secondaire ou supérieur), vérifié par Google ; examen annoncé d'environ 14 jours ouvrés ; propriété du domaine exigée                                                                            | « Établissement qualifié » selon les critères de Microsoft ; vérification qui peut prendre jusqu'à un mois ; revérification possible à tout moment | Aucune                                                                                                         |
| Quotas                     | 2 500 licences _Fundamentals_ à l'ouverture, extensibles sur demande ; stockage mutualisé (à vérifier)                                                                                                                                           | Stockage mutualisé par client en A1 (à vérifier) ; limites d'envoi Exchange Online                                                                 | Selon le matériel ; réputation d'envoi à construire                                                            |
| Automatisation             | API Admin SDK _Directory_ : création, suspension, réinitialisation ; compte de service avec délégation au niveau du domaine                                                                                                                      | Microsoft Graph : utilisateurs et licences ; application Entra ID avec permissions `User.ReadWrite.All` (ou plus restreintes selon les besoins)    | API propre à chaque logiciel                                                                                   |
| Contraintes contractuelles | Contrat Google Workspace for Education et avenant sur le traitement des données. Âge minimal et consentement parental selon les conditions Google et le droit local. Données hébergées hors du Bénin                                             | Contrat de licence en volume ou programme éducation ; conditions sur les données et les mineurs ; hébergement hors du Bénin                        | Responsabilité complète de la sécurité, de la conservation et de la disponibilité                              |
| Points d'attention         | L'accord se fait par établissement ou par entité ; la création par une plateforme tierce (EduRelevé) doit être autorisée par le titulaire du compte                                                                                              | Le schéma de licence a évolué (fin d'A1 Plus signalée en 2024) : confirmer l'offre réellement disponible au Bénin                                  | Délivrabilité vers Gmail et Outlook souvent difficile pour un nouveau domaine                                  |

Sources consultées :

- [Éditions Google Workspace for Education](https://goo.gle/editions)
- [FAQ des éditions Education (Google)](https://knowledge.workspace.google.com/admin/getting-started/editions/education-editions-faq)
- [Microsoft 365 Éducation](https://www.microsoft.com/en-us/education/products/office)
- [Page informatique de l'Université d'Ulster (évolution des licences A1)](https://www.ulster.ac.uk/ds/services/hardware-and-software/software-services/microsoft-licensing-and-it-provisioning)

**Recommandation provisoire** : demander d'abord l'éligibilité à Google Workspace for Education
_Fundamentals_ et au plan Microsoft A1, au nom d'un établissement pilote ou d'une entité
nationale. Choisir ensuite selon la réponse obtenue, les conditions sur les mineurs et
l'hébergement des données. Ne rien annoncer aux établissements avant un accord écrit.

## 8. Points à faire valider juridiquement

- **Données personnelles** (loi n° 2017-20 portant code du numérique en République du Bénin,
  Autorité de protection des données personnelles — APDP) : base légale du traitement, déclaration
  ou autorisation éventuelle, information des familles, durée de conservation des dossiers, des
  pièces de consentement et des historiques.
- **Mineurs** : faut-il un consentement du représentant légal, et jusqu'à quel âge ? Dans tous les
  cas ou seulement pour certains services ? Faut-il les deux parents ? Selon la réponse, régler
  `EDUMAIL_CONSENTEMENT` et `EDUMAIL_AGE_CONSENTEMENT`. Le défaut `toujours` est le choix prudent,
  pas une interprétation juridique.
- **Valeur probante** : l'accord en ligne du parent (compte activé avec l'identifiant de l'élève et
  sa date de naissance) et l'attestation écrite signée suffisent-ils ? Conserve-t-on l'original
  papier ?
- **Transfert de données hors du Bénin** vers un fournisseur étranger : conditions et formalités.
- **Conditions des fournisseurs** : âge minimal, rôle de l'établissement comme responsable du
  traitement, possibilité de créer des comptes par une plateforme tierce.
- **Clôture et conservation** : que deviennent la boîte et son contenu au départ de l'élève ?
  Pendant combien de temps ? Qui peut accéder au contenu, et sur quelle décision ?
- **Délégation** : la délégation des décisions au secrétariat doit-elle être formalisée par un
  écrit de la direction ? (Elle est déjà tracée dans le journal d'audit.)

## 9. Extension au supérieur (non activée)

Le périmètre actuel est l'élève du secondaire : fiche `Eleve`, inscription `INSCRIT` dans l'année
scolaire courante d'un établissement vérifié. Pour le supérieur, il faudrait :

- un modèle d'inscription propre au supérieur (établissement, filière, année d'études), plutôt
  qu'un faux statut « étudiant » sur la fiche élève ;
- adapter `situationEleve` (`contexts/edumail/eligibilite.js`) pour vérifier cette inscription ;
- une politique de consentement distincte (`jamais` pour des majeurs, à confirmer) ;
- probablement un domaine ou une unité d'organisation distincte chez le fournisseur.

Le cycle de vie, le pilote, les triggers et l'interface de l'établissement restent inchangés.

## 10. Sécurité, en résumé

- Isolation : le client `req.db` est filtré par `ecole_id`. Le parent ne lit le dossier qu'après
  contrôle du lien (`accesEnfant`). Les comptes nationaux ne voient que des agrégats ; le
  super-admin voit aussi les noms des établissements en erreur.
- Tous les droits sont contrôlés côté serveur :
  - l'élève ne peut ni décider, ni consentir, ni créer ;
  - le secrétariat ne décide que sur délégation ;
  - seule la direction suspend, réactive, clôture et délègue ;
  - la réinitialisation par l'établissement est réservée à qui peut décider.
- Aucun mot de passe de messagerie n'est stocké. La récupération du compte EduRelevé ne dépend
  jamais de l'adresse EduMail.
- Les pièces justificatives sont contrôlées par leur signature, stockées sous
  `edumail/consentements/<école>` et servies en ligne avec une CSP `sandbox`.
- Les demandes sensibles sont limitées en fréquence (`LIMITE_EDUMAIL`).
- La page « Avantages numériques » ne contient que des liens officiels. Elle indique, pour chaque
  service, l'absence de partenariat et ses propres conditions d'accès.
