import { Link, useParams } from 'react-router-dom';
import { CircleCheck, Lock, PenLine } from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import Apparition from '../../components/animation/Apparition.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import {
  cheminLecon,
  cheminProfil,
  CONFIANCES,
  duree,
  LIBELLES_NIVEAUX,
} from '../../lib/educourses.js';

/** Ligne de la table des matières : numéro, titre, état. */
function LigneLecon({ profilId, chapitre, lecon }) {
  const ouverte = lecon.redigee && lecon.libre;
  const contenu = (
    <>
      <span className="chiffres w-10 shrink-0 text-sm text-slate-500">
        {chapitre}.{lecon.ordre}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-medium ${ouverte ? '' : 'text-slate-500'}`}>
          {lecon.titre}
        </span>
        <span className="text-xs text-slate-500">
          {lecon.redigee ? duree(lecon.duree) : 'En cours de rédaction'}
          {lecon.progression?.meilleurScore != null &&
            ` · quiz ${lecon.progression.meilleurScore} %`}
        </span>
      </span>
      {lecon.progression?.terminee ? (
        <CircleCheck className="h-5 w-5 shrink-0 text-marque-600" aria-label="Terminée" />
      ) : !lecon.libre ? (
        <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-label="Réservée aux abonnés" />
      ) : (
        !lecon.redigee && (
          <PenLine className="h-4 w-4 shrink-0 text-slate-300" aria-label="À venir" />
        )
      )}
    </>
  );
  return (
    <li>
      {ouverte ? (
        <Link
          to={cheminLecon(profilId, lecon.id)}
          className="flex min-h-12 items-center gap-2 py-2 pr-3 pl-12 transition hover:bg-marque-50/60 hover:text-marque-800"
        >
          {contenu}
        </Link>
      ) : (
        <div className="flex min-h-12 items-center gap-2 py-2 pr-3 pl-12">{contenu}</div>
      )}
    </li>
  );
}

/** Plan d'une matière : chapitres et leçons, avec l'avancement de l'apprenant. */
export default function Programme() {
  const { profilId, programmeId } = useParams();
  const { donnees, erreur, chargement } = useRequete(
    `/educourses/profils/${profilId}/programmes/${programmeId}`,
  );
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  const { programme } = donnees;
  const lecons = programme.chapitres.flatMap((c) => c.lecons);
  const suivante = lecons.find((l) => l.redigee && l.libre && !l.progression?.terminee);

  return (
    <div className="space-y-6">
      <EnTetePage
        retour={{ vers: cheminProfil(profilId), libelle: 'Matières' }}
        surtitre={`${LIBELLES_NIVEAUX[programme.niveau]}${programme.series.length ? ` · séries ${programme.series.join(', ')}` : ''}`}
        titre={programme.nomMatiere}
        actions={
          suivante && (
            <Link
              to={cheminLecon(profilId, suivante.id)}
              className="inline-flex min-h-11 items-center rounded-lg bg-marque-600 px-4 text-sm font-semibold text-white hover:bg-marque-700"
            >
              {lecons.some((l) => l.progression) ? 'Continuer' : 'Commencer'} : {suivante.titre}
            </Link>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <Badge statut={programme.confiance} table={CONFIANCES} />
        <span className="chiffres">
          {lecons.filter((l) => l.progression?.terminee).length}/{lecons.length} leçons terminées
        </span>
      </div>

      <div className="space-y-5">
        {programme.chapitres.map((c, i) => (
          <Apparition
            as="section"
            key={c.id}
            delai={Math.min(i, 4) * 60}
            className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200"
          >
            <h2 className="flex items-baseline gap-3 border-b-2 border-slate-900 px-4 py-3">
              <span className="chiffres text-sm text-rouge">Chap. {c.ordre}</span>
              <span className="font-bold tracking-tight">{c.titre}</span>
            </h2>
            <ol className="marge-rouge divide-y divide-slate-100">
              {c.lecons.map((l) => (
                <LigneLecon key={l.id} profilId={profilId} chapitre={c.ordre} lecon={l} />
              ))}
            </ol>
          </Apparition>
        ))}
      </div>
      {programme.confiance !== 'OFFICIEL' && (
        <p className="text-xs text-slate-500">
          Plan établi d’après les progressions et les épreuves en usage au Bénin ; il sera aligné
          sur le texte officiel du ministère dès sa validation.
        </p>
      )}
    </div>
  );
}
