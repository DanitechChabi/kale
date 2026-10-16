import { Link, useParams } from 'react-router-dom';
import { CircleCheck, Clock3 } from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import Apparition from '../../components/animation/Apparition.jsx';
import { useAuth } from '../../contexte/Auth.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import {
  cheminLecon,
  cheminProgramme,
  classeProfil,
  LIBELLES_NIVEAUX,
  pourcentage,
} from '../../lib/educourses.js';
import { teinteMatiere } from '../../lib/emploiDuTemps.js';
import { formaterDate } from '../../lib/navigation.js';

/** Couverture de cahier d'une matière : dos coloré, titre, jauge d'avancement. */
function CahierMatiere({ profilId, programme, delai }) {
  const avancement = pourcentage(programme.terminees, programme.lecons);
  return (
    <Apparition as="li" delai={delai}>
      <Link
        to={cheminProgramme(profilId, programme.id)}
        className="group flex h-full overflow-hidden rounded-lg bg-white ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-marque-400 focus-visible:outline-2 focus-visible:outline-marque-600"
      >
        <span
          className={`w-3 shrink-0 ring-1 ${teinteMatiere(programme.matiereCode)}`}
          aria-hidden="true"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <span className="flex items-start justify-between gap-2">
            <span className="font-bold leading-tight tracking-tight">{programme.nomMatiere}</span>
            {programme.scoreMoyen !== null && (
              <span className="chiffres shrink-0 text-xs text-slate-500">
                quiz {programme.scoreMoyen} %
              </span>
            )}
          </span>
          <span className="chiffres text-xs text-slate-500">
            {programme.chapitres} chapitres · {programme.lecons} leçons
            {programme.redigees < programme.lecons && ` · ${programme.redigees} rédigées`}
          </span>
          <span className="mt-auto space-y-1.5">
            <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100">
              <span
                className="jauge block h-full origin-left bg-marque-500"
                style={{ '--echelle': avancement / 100, '--delai': `${delai + 200}ms` }}
              />
            </span>
            <span className="chiffres flex justify-between text-xs text-slate-600">
              <span>
                {programme.terminees}/{programme.lecons} terminées
              </span>
              <span>{avancement} %</span>
            </span>
          </span>
        </span>
      </Link>
    </Apparition>
  );
}

/** Matières de l'apprenant et dernières leçons travaillées (vue élève et parent). */
export default function TableauApprenant() {
  const { profilId } = useParams();
  const { utilisateur } = useAuth();
  const { donnees, erreur, chargement } = useRequete(`/educourses/profils/${profilId}`);
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  const { profil, programmes, activite } = donnees;
  const parent = utilisateur.role === 'PARENT';
  const terminees = programmes.reduce((s, p) => s + p.terminees, 0);

  return (
    <div className="space-y-8">
      <EnTetePage
        retour={parent ? { vers: '/espace/educourses', libelle: 'Apprenants' } : undefined}
        surtitre={`EduCourses · ${LIBELLES_NIVEAUX[profil.niveau]}${profil.serie ? ` ${profil.serie}` : ''}`}
        titre={parent ? `Les cours de ${profil.prenom}` : 'Mes cours'}
        description={
          terminees
            ? `${terminees} leçon${terminees > 1 ? 's' : ''} terminée${terminees > 1 ? 's' : ''} depuis le début.`
            : 'Choisissez une matière et commencez par la première leçon.'
        }
      />

      {programmes.length === 0 ? (
        <Alerte type="info">
          Aucun programme disponible pour la classe {classeProfil(profil)} pour l’instant.
        </Alerte>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {programmes.map((p, i) => (
            <CahierMatiere key={p.id} profilId={profilId} programme={p} delai={i * 60} />
          ))}
        </ul>
      )}

      {activite.length > 0 && (
        <section className="space-y-3">
          <h2 className="etiquette border-b-2 border-slate-900 pb-2">Travail récent</h2>
          <ol className="divide-y divide-slate-200">
            {activite.map((a) => (
              <li key={a.leconId}>
                <Link
                  to={cheminLecon(profilId, a.leconId)}
                  className="flex items-center gap-3 py-3 hover:text-marque-700"
                >
                  {a.terminee ? (
                    <CircleCheck
                      className="h-5 w-5 shrink-0 text-marque-600"
                      aria-label="Terminée"
                    />
                  ) : (
                    <Clock3 className="h-5 w-5 shrink-0 text-slate-400" aria-label="En cours" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{a.titre}</span>
                    <span className="text-xs text-slate-500">
                      {a.matiere} · {formaterDate(a.le)}
                    </span>
                  </span>
                  {a.meilleurScore !== null && (
                    <span className="chiffres text-sm font-semibold">{a.meilleurScore} %</span>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
