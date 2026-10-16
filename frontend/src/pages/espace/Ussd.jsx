import EnTetePage from '../../components/EnTetePage.jsx';
import SimulateurUssd from '../../components/SimulateurUssd.jsx';

/** Essai du service USSD avec le numéro d'un parent (administrateur de la plateforme). */
export default function Ussd() {
  return (
    <div className="space-y-6">
      <EnTetePage
        titre="Service USSD"
        description="Les menus présentés aux parents qui composent le code EduRelevé depuis un téléphone simple, sans internet. Saisissez le numéro d’un parent pour essayer."
      />
      <div className="grid gap-8 lg:grid-cols-[20rem_1fr]">
        <SimulateurUssd avecNumero />
        <div className="space-y-3 text-sm text-slate-600">
          <h2 className="etiquette">Raccordement</h2>
          <p>
            L’opérateur ou l’agrégateur appelle <span className="chiffres">POST /api/ussd</span> à
            chaque touche, avec le numéro de l’appelant et le parcours saisi. La passerelle est
            fermée tant que la variable <span className="chiffres">USSD_SECRET</span> n’est pas
            définie ; ce secret accompagne chaque appel (en-tête{' '}
            <span className="chiffres">X-Ussd-Secret</span>).
          </p>
          <p>
            Le parent est reconnu par son numéro : celui enregistré sur la fiche de l’élève ou celui
            de son compte parent. Aucune autre information n’est demandée.
          </p>
        </div>
      </div>
    </div>
  );
}
