import EtatServeur from '../components/EtatServeur.jsx';

// Les quatre espaces de la plateforme (les liens seront activés au fil des phases)
const espaces = [
  {
    titre: 'École',
    description: 'Élèves, classes, notes, emplois du temps et cours.',
    icone: '🏫',
  },
  {
    titre: 'Élève',
    description: 'Mes notes, mes cours et mes relevés téléchargeables.',
    icone: '🎓',
  },
  {
    titre: 'Parent',
    description: 'Suivi des notes, absences et cours de mes enfants.',
    icone: '👨‍👩‍👧',
  },
  {
    titre: 'Ministère',
    description: 'Tableau de bord national par département et commune.',
    icone: '📊',
  },
];

export default function Accueil() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
          Vos relevés de notes, sans vous déplacer.
        </h1>
        <p className="text-gray-700">
          EduRelevé archive chaque bulletin et relevé de façon définitive. Chaque document porte un
          numéro unique et un QR code vérifiable par tout employeur ou université.
        </p>
        <EtatServeur />
      </section>

      <section aria-labelledby="titre-espaces">
        <h2 id="titre-espaces" className="mb-3 text-lg font-semibold">
          Espaces
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {espaces.map((espace) => (
            <li
              key={espace.titre}
              className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <span className="text-2xl" aria-hidden="true">
                {espace.icone}
              </span>
              <div>
                <h3 className="font-semibold">{espace.titre}</h3>
                <p className="text-sm text-gray-600">{espace.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-vert/30 bg-vert/5 p-4">
        <h2 className="font-semibold text-vert-fonce">Vérifier un document</h2>
        <p className="text-sm text-gray-700">
          La vérification publique d’un relevé par son numéro sera disponible prochainement.
        </p>
      </section>
    </div>
  );
}
