import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpenCheck, ListChecks, NotebookPen, UserRoundPlus } from 'lucide-react';
import Guilloche from '../../components/Guilloche.jsx';
import Apparition from '../../components/animation/Apparition.jsx';
import TexteRevele from '../../components/animation/TexteRevele.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { Champ, ChampMotDePasse } from '../../components/ui/Champ.jsx';
import Onglets from '../../components/ui/Onglets.jsx';
import { useAuth } from '../../contexte/Auth.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi, erreursParChamp } from '../../lib/api.js';
import { NIVEAUX } from '../../lib/educourses.js';
import { teinteMatiere } from '../../lib/emploiDuTemps.js';

const ATOUTS = [
  [
    BookOpenCheck,
    'Le programme en vigueur',
    'Chaque matière suit le découpage enseigné au Bénin, chapitre par chapitre, de la 6e à la Terminale, série par série.',
  ],
  [
    NotebookPen,
    'Des cours rédigés pour comprendre',
    'Une activité de départ ancrée dans la vie de tous les jours, des définitions claires, des méthodes pas à pas.',
  ],
  [
    ListChecks,
    'Exercices corrigés et quiz',
    'Du plus facile à l’approfondissement, avec corrigés détaillés ; le quiz dit tout de suite ce qui est acquis.',
  ],
];

/** Catalogue : matières d'un niveau, avec l'état de la rédaction. */
function Catalogue() {
  const { donnees, erreur, chargement } = useRequete('/educourses/catalogue');
  const [niveau, setNiveau] = useState('SIXIEME');
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  const programmes = donnees.niveaux.find((n) => n.niveau === niveau)?.programmes ?? [];
  // Au second cycle, une matière peut avoir un programme par groupe de séries
  const groupes = new Map();
  for (const p of programmes) groupes.set(p.nomMatiere, [...(groupes.get(p.nomMatiere) ?? []), p]);
  const parMatiere = [...groupes.values()].map((liste) => ({
    nom: liste[0].nomMatiere,
    code: liste[0].matiereCode,
    series: liste.flatMap((p) => p.series),
    lecons: liste.reduce((s, p) => s + p.lecons, 0),
    redigees: liste.reduce((s, p) => s + p.redigees, 0),
  }));
  return (
    <div className="space-y-5">
      <Onglets onglets={NIVEAUX} actif={niveau} onChange={setNiveau} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {parMatiere.map((m, i) => (
          <Apparition
            as="li"
            key={`${niveau}-${m.nom}`}
            delai={Math.min(i, 8) * 40}
            className="flex overflow-hidden rounded-lg bg-white ring-1 ring-slate-200"
          >
            <span className={`w-2.5 shrink-0 ring-1 ${teinteMatiere(m.code)}`} aria-hidden="true" />
            <span className="min-w-0 flex-1 p-3">
              <span className="block font-semibold leading-tight">{m.nom}</span>
              <span className="chiffres mt-1 block text-xs text-slate-500">
                {m.lecons} leçons
                {m.redigees > 0 && ` · ${m.redigees} disponibles`}
                {m.series.length > 0 && ` · ${[...new Set(m.series)].sort().join(' ')}`}
              </span>
            </span>
          </Apparition>
        ))}
      </ul>
    </div>
  );
}

/** Ouverture d'un compte pour un parent dont l'enfant n'est pas inscrit sur EduRelevé. */
function FormulaireCompte() {
  const { connexion } = useAuth();
  const naviguer = useNavigate();
  const [donnees, setDonnees] = useState({ nom: '', prenoms: '', telephone: '', motDePasse: '' });
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const modifier = (cle) => (e) => setDonnees((d) => ({ ...d, [cle]: e.target.value }));

  async function ouvrir(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreurs({});
    setErreur(null);
    try {
      await appelApi('/public/educourses/compte', { methode: 'POST', corps: donnees });
      await connexion(donnees.telephone, donnees.motDePasse);
      naviguer('/espace/educourses', { replace: true });
    } catch (err) {
      setErreurs(erreursParChamp(err));
      setErreur(err.code === 'VALIDATION' ? 'Vérifiez les champs signalés.' : err.message);
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={ouvrir} className="space-y-4" noValidate>
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ
          libelle="Nom"
          value={donnees.nom}
          onChange={modifier('nom')}
          erreur={erreurs.nom}
          autoComplete="family-name"
          obligatoire
        />
        <Champ
          libelle="Prénoms"
          value={donnees.prenoms}
          onChange={modifier('prenoms')}
          erreur={erreurs.prenoms}
          autoComplete="given-name"
          obligatoire
        />
      </div>
      <Champ
        libelle="Téléphone"
        type="tel"
        inputMode="tel"
        value={donnees.telephone}
        onChange={modifier('telephone')}
        erreur={erreurs.telephone}
        placeholder="01 97 00 00 00"
        autoComplete="tel"
        obligatoire
      />
      <ChampMotDePasse
        libelle="Choisissez un mot de passe"
        value={donnees.motDePasse}
        onChange={modifier('motDePasse')}
        erreur={erreurs.motDePasse}
        aide="8 caractères au moins, avec une lettre et un chiffre."
        autoComplete="new-password"
        obligatoire
      />
      <Bouton type="submit" chargement={envoi} icone={UserRoundPlus} className="w-full">
        Créer mon compte
      </Bouton>
      <p className="text-sm text-slate-600">
        Déjà un compte EduRelevé (élève ou parent) ?{' '}
        <Link to="/connexion" className="font-semibold text-marque-700 hover:underline">
          Connectez-vous
        </Link>
        : EduCourses y est déjà.
      </p>
    </form>
  );
}

/** Page publique d'EduCourses : promesse, catalogue par classe, ouverture de compte. */
export default function Presentation() {
  const { statut } = useAuth();
  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 py-10 sm:px-6 sm:py-14">
      <section className="relative grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div className="space-y-5">
          <p className="etiquette entree">EduCourses · cours en ligne</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            <TexteRevele
              segments={[
                { texte: 'Tout le programme,' },
                { texte: 'de la 6e à la Terminale.', className: 'text-marque-700' },
              ]}
            />
          </h1>
          <p className="entree max-w-xl text-lg text-slate-600" style={{ '--delai': '300ms' }}>
            Des cours complets et clairs dans chaque matière, pour réviser, rattraper une leçon
            manquée ou prendre de l’avance — à la maison, sur le téléphone.
          </p>
          <div className="entree flex flex-wrap gap-3" style={{ '--delai': '420ms' }}>
            {statut === 'connecte' ? (
              <Link
                to="/espace/educourses"
                className="inline-flex min-h-11 items-center rounded-lg bg-marque-600 px-5 font-semibold text-white hover:bg-marque-700"
              >
                Ouvrir mes cours
              </Link>
            ) : (
              <a
                href="#compte"
                className="inline-flex min-h-11 items-center rounded-lg bg-marque-600 px-5 font-semibold text-white hover:bg-marque-700"
              >
                Créer un compte gratuit
              </a>
            )}
            <a
              href="#catalogue"
              className="inline-flex min-h-11 items-center rounded-lg px-4 font-semibold text-marque-700 ring-1 ring-slate-300 hover:bg-white"
            >
              Voir les matières
            </a>
          </div>
        </div>
        <Guilloche
          variante="bande"
          largeur={600}
          hauteur={140}
          lignes={11}
          anime
          className="hidden h-36 w-full text-marque-500/30 lg:block"
        />
      </section>

      <section className="grid gap-6 border-t-2 border-slate-900 pt-8 md:grid-cols-3">
        {ATOUTS.map(([Icone, titre, texte], i) => (
          <Apparition key={titre} delai={i * 90} className="space-y-2">
            <Icone className="h-6 w-6 text-marque-600" aria-hidden="true" />
            <h2 className="font-bold tracking-tight">{titre}</h2>
            <p className="text-sm text-slate-600">{texte}</p>
          </Apparition>
        ))}
      </section>

      <section id="catalogue" className="scroll-mt-24 space-y-5">
        <div>
          <p className="etiquette">Catalogue</p>
          <h2 className="text-2xl font-bold tracking-tight">Les matières par classe</h2>
        </div>
        <Catalogue />
      </section>

      {statut !== 'connecte' && (
        <section
          id="compte"
          className="cahier marge-rouge grid scroll-mt-24 gap-8 rounded-lg py-8 pr-6 pl-12 ring-1 ring-slate-200 lg:grid-cols-[1fr_1.2fr] lg:pl-14"
        >
          <div className="space-y-3">
            <p className="etiquette">Parents</p>
            <h2 className="text-2xl font-bold tracking-tight">Un compte pour toute la famille</h2>
            <p className="text-slate-600">
              Ajoutez chaque enfant avec sa classe ; chacun garde son avancement et vous voyez où il
              en est. Votre enfant est déjà élève sur EduRelevé ? Ses cours suivent sa classe
              automatiquement.
            </p>
          </div>
          <FormulaireCompte />
        </section>
      )}
    </div>
  );
}
