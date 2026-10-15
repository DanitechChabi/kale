# API de vérification des documents

Service public et gratuit destiné aux universités, employeurs et administrations : il confirme
qu'un bulletin ou un relevé présenté a bien été délivré par un établissement et qu'il n'a pas été
modifié. Aucune clé n'est nécessaire. Les appels sont limités à 60 par minute et par adresse IP.
Le service est ouvert à toutes les origines (CORS) et n'utilise aucun cookie.

Adresse de base : `https://<adresse du service>/api/public/v1`

## Numéro du document

Imprimé sous le QR code, par exemple `B26-7K3M-Q9P2X` :

- `B` : bulletin de période ; `R` : relevé annuel ;
- `26` : année de fin de l'année scolaire ;
- 8 caractères aléatoires, puis un caractère de contrôle qui détecte toute faute de frappe.

La saisie tolère les minuscules, l'absence de tirets et la confusion O/0, I/1.

## Consulter un document

`GET /documents/{numero}`

```bash
curl https://<adresse>/api/public/v1/documents/B26-7K3M-Q9P2X
```

Réponse `200` :

```json
{
  "document": {
    "numero": "B26-7K3M-Q9P2X",
    "type": "BULLETIN_PERIODE",
    "statut": "EN_VIGUEUR",
    "remplacePar": null,
    "remplace": null,
    "delivreLe": "2026-01-10T09:12:00.000Z",
    "empreinteSha256": "51edee4041ceef9c…",
    "etablissement": {
      "nom": "CEG Les Cocotiers",
      "code": "…",
      "commune": "Cotonou",
      "departement": "Littoral"
    },
    "eleve": { "nom": "AGOSSOU", "prenoms": "Koffi Romuald", "dateNaissance": "2013-06-12" },
    "anneeScolaire": "2025-2026",
    "periode": { "type": "TRIMESTRE", "numero": 1 },
    "classe": "6e A",
    "matieres": [
      { "matiere": "Mathématiques", "coefficient": 3, "moyenne": 9.58, "estFacultative": false }
    ],
    "resultats": {
      "moyenneGenerale": 10.72,
      "rang": 5,
      "exAequo": false,
      "classes": 6,
      "distinction": null
    }
  }
}
```

- `statut` : `EN_VIGUEUR`, ou `REMPLACE` quand une version corrigée existe (`remplacePar.numero`).
  Seule la version en vigueur fait foi.
- Erreurs `404` : `NUMERO_INVALIDE` (caractère de contrôle faux) ou `INTROUVABLE` (numéro bien
  formé mais absent de l'archive : le document n'est pas authentique).

## Contrôler un fichier PDF reçu

`POST /documents/{numero}/verification` avec l'empreinte SHA-256 du fichier, calculée de votre
côté (le fichier n'est jamais envoyé) :

```bash
EMPREINTE=$(sha256sum bulletin.pdf | cut -d' ' -f1)
curl -X POST https://<adresse>/api/public/v1/documents/B26-7K3M-Q9P2X/verification \
  -H 'Content-Type: application/json' \
  -d "{\"empreinteSha256\":\"$EMPREINTE\"}"
```

Réponse : `{ "trouve": true, "numero": "B26-7K3M-Q9P2X", "statut": "EN_VIGUEUR", "conforme": true }`.
`conforme: false` signifie que le fichier a été modifié ou qu'il ne s'agit pas de ce document.

## Copie papier

Une copie papier ne peut pas être contrôlée par empreinte : comparez les moyennes imprimées avec
celles renvoyées par l'API (ou affichées sur la page `/verifier/{numero}`), ainsi que la rosace
imprimée à côté du QR code, propre à chaque document.
