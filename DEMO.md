# EduRelevé — démonstration

## Charger les données

```bash
npm run prisma:seed --prefix backend   # référentiel national et EduCourses
npm run demo --prefix backend          # ≈ 5 minutes ; en production : npm run demo --prefix backend -- --confirmer
```

Le script ne s'exécute qu'une fois (il s'arrête si les établissements de démonstration existent).
Tout passe par l'API : mêmes règles, mêmes triggers, PDF réellement archivés.

**Contenu** : 3 établissements fictifs dans 3 départements, deux années scolaires.

| Établissement                        | Commune (département) | Classes 2026-2027                 |
| ------------------------------------ | --------------------- | --------------------------------- |
| CEG Les Cocotiers (public)           | Cotonou (Littoral)    | 6e ×2, 5e, 4e, 3e                 |
| Lycée Les Rôniers (public)           | Parakou (Borgou)      | 3e, 2nde C, 2nde A2, 1re D, Tle D |
| Complexe scolaire La Lumière (privé) | Abomey (Zou)          | 6e, 4e, 3e, Tle A1                |

- **2025-2026** : trois trimestres notés et clôturés, bulletins et relevés annuels archivés (QR code,
  empreinte), appels de mars 2026.
- **2026-2027** (année courante) : élèves passés en classe supérieure, deux évaluations au 1er
  trimestre, emplois du temps, appels de septembre et octobre (SMS aux parents), cours et devoirs.
- **Duplicatas** : par établissement, deux délivrés et un en attente (à traiter devant le jury).
- **EduCourses** : la 6e entièrement rédigée ; l'élève de démonstration a déjà travaillé 7 leçons.

## Comptes

Mot de passe commun : **`EduReleve2026`**. Identifiant : le téléphone (ou l'identifiant de l'élève).

| Rôle                                                                | Identifiant                                |
| ------------------------------------------------------------------- | ------------------------------------------ |
| Super-administrateur                                                | `01 00 00 00 01`                           |
| Ministère                                                           | `01 00 00 00 02`                           |
| Parent (2 enfants, 2 établissements)                                | `01 00 00 00 03`                           |
| Direction / secrétariat / enseignant — CEG Les Cocotiers            | `01 00 00 00 10` / `11` / `12`             |
| Direction / secrétariat / enseignant — Lycée Les Rôniers            | `01 00 00 00 20` / `21` / `22`             |
| Direction / secrétariat / enseignant — Complexe scolaire La Lumière | `01 00 00 00 30` / `31` / `32`             |
| Élève (Sèna HOUNKPATIN, 6e A)                                       | `SENAH-6EA2Q`                              |

## Parcours jury (≈ 10 minutes)

L'idée à faire passer : **un duplicata en deux minutes, au lieu d'un déplacement**.

1. **Le problème** (30 s) : aujourd'hui, l'ancien élève retourne dans son lycée ; archives papier,
   délais, aucun moyen de vérifier un document.
2. **Duplicata, côté usager** (2 min) : sans compte, ouvrir `/duplicata`, choisir « CEG Les
   Cocotiers », relevé annuel 2025-2026, saisir l'identité d'un ancien élève de 3e (liste dans
   Élèves → année 2025-2026) et son téléphone. Noter le numéro de suivi.
3. **Duplicata, côté établissement** (1 min) : secrétariat `01 00 00 00 11` → Duplicatas → la
   demande est rapprochée du document archivé → « Prendre en charge » → « Délivrer ».
4. **Retour usager** (1 min) : `/duplicata/suivi`, numéro + téléphone → télécharger le PDF.
   Scanner son QR code avec un téléphone : page de vérification « Document authentique ».
5. **Parents** (2 min) : `01 00 00 00 03` → deux enfants dans deux établissements, notes du
   trimestre, SMS d'absence du jour, simulateur USSD (« Messages »), EduCourses.
6. **Enseignant et direction** (1 min) : `01 00 00 00 12` → Notes → saisie (fonctionne hors
   connexion) ; `01 00 00 00 10` → Résultats : moyennes et rangs automatiques.
7. **Ministère** (1 min) : `01 00 00 00 02` → tableau de bord, année 2025-2026 : réussite et
   absences par département sur la carte ; ouvrir le Littoral puis un établissement ; export CSV.

Points à souligner : documents figés (aucune modification possible, même en base), correction =
nouveau document qui référence l'ancien, vérification sans compte et en 2G, isolation stricte
entre établissements, SMS et USSD pour les familles sans smartphone.
