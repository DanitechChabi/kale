// « Avantages numériques » : informations sur des services utiles aux élèves.
//
// Aucun de ces services n'a de partenariat avec EduRelevé : chacun applique ses propres
// conditions (âge, établissement, justificatifs) et peut refuser une demande. Posséder
// une adresse EduMail ne garantit l'accès à aucune offre. Un partenariat officiel, s'il
// est signé un jour, se déclare ici (partenariat : { avec, depuis, preuve }).
export const AVANTAGES = [
  {
    id: 'github-education',
    nom: 'GitHub Education — Student Developer Pack',
    categorie: 'Programmation',
    description:
      'Outils de développement offerts aux élèves et étudiants reconnus par GitHub (hébergement de code, environnements de développement, formations).',
    url: 'https://education.github.com/pack',
    conditions:
      'GitHub vérifie lui-même le statut scolaire : conditions d’âge, établissement reconnu et justificatif récent (carte ou certificat de scolarité). L’adresse EduMail peut aider mais ne suffit pas.',
    verification: 'Par GitHub',
    partenariat: null,
  },
  {
    id: 'microsoft-learn',
    nom: 'Microsoft Learn',
    categorie: 'Formation',
    description:
      'Parcours de formation gratuits en ligne sur la programmation, le cloud et la bureautique.',
    url: 'https://learn.microsoft.com/fr-fr/training/',
    conditions: 'Accès libre avec un compte Microsoft ; aucune vérification scolaire.',
    verification: 'Aucune',
    partenariat: null,
  },
  {
    id: 'freecodecamp',
    nom: 'freeCodeCamp',
    categorie: 'Programmation',
    description: 'Cours et exercices gratuits de programmation web, avec certificats.',
    url: 'https://www.freecodecamp.org/',
    conditions: 'Accès libre et gratuit ; aucune vérification scolaire.',
    verification: 'Aucune',
    partenariat: null,
  },
  {
    id: 'khan-academy',
    nom: 'Khan Academy (en français)',
    categorie: 'Formation',
    description: 'Cours et exercices gratuits de mathématiques, sciences et informatique.',
    url: 'https://fr.khanacademy.org/',
    conditions:
      'Accès gratuit ; les comptes des plus jeunes peuvent nécessiter l’accord d’un parent selon les règles du service.',
    verification: 'Aucune',
    partenariat: null,
  },
];

/** Liste présentée aux élèves : l'absence de partenariat est explicite pour chaque service. */
export const avantages = () => ({
  avertissement:
    'EduRelevé n’est partenaire d’aucun de ces services. Chacun applique ses propres conditions et peut demander des justificatifs supplémentaires ; une adresse EduMail ne garantit l’accès à aucune offre.',
  services: AVANTAGES.map((a) => ({
    ...a,
    statutConfiguration: a.partenariat ? 'PARTENARIAT' : 'INFORMATION',
  })),
});
