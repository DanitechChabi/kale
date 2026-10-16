import { Link } from 'react-router-dom';
import { ChevronRight, ScrollText, TriangleAlert } from 'lucide-react';
import Apparition from '../../components/animation/Apparition.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { formaterNote, formaterRang, libellePeriode } from '../../lib/notes.js';

const LIENS = { PERE: 'Père', MERE: 'Mère', TUTEUR: 'Tuteur', AUTRE: 'Responsable' };

/** Accueil du parent : une fiche par enfant, comme une page de registre. */
export default function MesEnfants() {
  const { donnees, erreur, chargement } = useRequete('/parent/enfants');
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  if (!donnees.enfants.length) {
    return (
      <Alerte type="info" titre="Aucun enfant relié à votre compte">
        Demandez au secrétariat de l’établissement de relier votre compte à votre enfant.
      </Alerte>
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {donnees.enfants.map((e, i) => {
        const p = e.dernierePeriode;
        return (
          <Apparition as="li" key={e.id} delai={i * 90}>
            <Link
              to={`/espace/enfants/${e.id}`}
              className="group cahier marge-rouge block rounded-2xl py-4 pr-4 pl-10 ring-1 ring-slate-200 transition hover:ring-marque-500"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg leading-7 font-bold">
                    {e.prenoms.split(' ')[0]} {e.nom}
                  </p>
                  <p className="truncate text-sm leading-7 text-slate-600">
                    {e.classe ?? 'Non inscrit'} · {e.ecole}
                  </p>
                </div>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1" />
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <p className="leading-7">
                  <span
                    className={`chiffres text-3xl font-semibold ${p?.moyenneGenerale < 10 ? 'text-rouge' : ''}`}
                  >
                    {formaterNote(p?.moyenneGenerale)}
                  </span>
                  <span className="ml-1 text-sm text-slate-500">
                    {p
                      ? `${libellePeriode(p)}${p.estCloturee ? ` · ${formaterRang(p.rang)} sur ${p.effectif}` : ' en cours'}`
                      : 'aucune note'}
                  </span>
                </p>
              </div>
              <p className="flex flex-wrap gap-x-5 text-sm leading-7 text-slate-600">
                {e.absencesNonJustifiees > 0 && (
                  <span className="flex items-center gap-1.5 font-semibold text-rouge">
                    <TriangleAlert className="h-4 w-4" />
                    {e.absencesNonJustifiees} absence{e.absencesNonJustifiees > 1 ? 's' : ''} non
                    justifiée{e.absencesNonJustifiees > 1 ? 's' : ''}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <ScrollText className="h-4 w-4" /> {e.documents} bulletin
                  {e.documents > 1 ? 's' : ''}
                </span>
                <span className="text-slate-400">{LIENS[e.lien]}</span>
              </p>
            </Link>
          </Apparition>
        );
      })}
    </ul>
  );
}
