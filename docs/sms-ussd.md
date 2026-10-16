# SMS et USSD

## SMS aux parents

Les messages sont mis en file dans la table `notifications`, puis envoyés par le fournisseur
désigné par `SMS_FOURNISSEUR`. Par défaut, `journal` les enregistre sans les transmettre :
l'établissement voit tout dans « SMS aux parents », marqué « Enregistré ».

Événements :

| Événement                          | Réglage de l'établissement | Exemple                                                                          |
| ---------------------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| Absence ou retard relevé à l'appel | `smsAbsences`              | « Sèna HOUNKPATIN était absent(e) le 16/10 à 7h (CEG Les Cocotiers)… »           |
| Bulletin ou relevé délivré         | `smsBulletins`             | « Le bulletin du 1er trimestre de … est disponible. Moyenne 12,50/20, rang 5e… » |

Destinataires : le téléphone du parent saisi sur la fiche de l'élève et les comptes parents
reliés (un seul SMS par numéro). Rejouer un événement ne renvoie jamais de second SMS.

### Brancher un opérateur ou un agrégateur

1. Dans `backend/src/contexts/notifications/fournisseursSms.js`, ajouter un fournisseur :

   ```js
   const operateur = {
     nom: 'operateur',
     async envoyer({ telephone, message }) {
       const reponse = await fetch('https://api.operateur.example/sms', {
         method: 'POST',
         headers: { Authorization: `Bearer ${config.SMS_CLE}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({ to: telephone, from: 'EduReleve', text: message }),
       });
       if (!reponse.ok) throw new Error(`Opérateur : ${reponse.status}`);
       return { idExterne: (await reponse.json()).id };
     },
   };
   ```

2. L'ajouter à `FOURNISSEURS`, puis autoriser sa valeur dans `SMS_FOURNISSEUR` et déclarer ses
   identifiants (`SMS_CLE`…) dans `src/config/env.js`.
3. Définir `SMS_FOURNISSEUR=operateur` sur le serveur. Les messages en attente partent au
   démarrage ; un échec est retenté jusqu'à 3 fois, puis la direction peut relancer.

## USSD

La passerelle de l'opérateur appelle `POST /api/ussd` à chaque touche, au format
`application/x-www-form-urlencoded` : `sessionId`, `serviceCode`, `phoneNumber`, `text`
(parcours cumulé, ex. `1*2`). La réponse, en texte brut, commence par `CON` (menu suivant) ou
`END` (fin).

- Définir `USSD_SECRET` (16 caractères au moins) : sans lui, la passerelle répond 404. L'opérateur
  l'envoie dans l'en-tête `X-Ussd-Secret` (ou le paramètre `?cle=`).
- Définir `USSD_CODE` (ex. `*123*45#`) pour l'afficher aux parents.

Menus : `1` notes et moyennes, `2` absences, `3` bulletins délivrés ; si le numéro correspond à
plusieurs enfants, un second écran propose de choisir. Le parent est reconnu par le numéro fourni
par l'opérateur (téléphone de la fiche élève ou de son compte parent).

Pour essayer sans opérateur : espace parent, page « Messages » (avec son propre numéro), ou
compte administrateur de la plateforme, page « Service USSD » (n'importe quel numéro).
