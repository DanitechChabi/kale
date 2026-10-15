import { useState } from 'react';
import { CalendarPlus, CheckCircle2 } from 'lucide-react';
import Apparition from '../../components/animation/Apparition.jsx';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { Champ } from '../../components/ui/Champ.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi, erreursParChamp } from '../../lib/api.js';
import { formaterDate } from '../../lib/navigation.js';
import { anneeProposee } from '../../lib/scolarite.js';

function NouvelleAnnee({ onCree }) {
  const [champs, setChamps] = useState(anneeProposee);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const erreurs = erreursParChamp(erreur);
  const modifier = (cle) => (e) => setChamps((c) => ({ ...c, [cle]: e.target.value }));

  async function creer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await appelApi('/annees', { methode: 'POST', corps: { ...champs, estCourante: true } });
      onCree();
    } catch (err) {
      setErreur(err);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form
      onSubmit={creer}
      className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
    >
      <h2 className="font-semibold">Nouvelle année scolaire</h2>
      {erreur && !Object.keys(erreurs).length && <Alerte type="erreur">{erreur.message}</Alerte>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Champ
          libelle="Année"
          value={champs.libelle}
          onChange={modifier('libelle')}
          erreur={erreurs.libelle}
          placeholder="2025-2026"
          obligatoire
        />
        <Champ
          libelle="Rentrée"
          type="date"
          value={champs.dateDebut}
          onChange={modifier('dateDebut')}
          erreur={erreurs.dateDebut}
          obligatoire
        />
        <Champ
          libelle="Fin des cours"
          type="date"
          value={champs.dateFin}
          onChange={modifier('dateFin')}
          erreur={erreurs.dateFin}
          obligatoire
        />
      </div>
      <p className="text-sm text-slate-500">
        L’année est découpée automatiquement en trimestres ou semestres, selon le choix de
        l’établissement. Les dates restent modifiables.
      </p>
      <Bouton type="submit" icone={CalendarPlus} chargement={envoi}>
        Créer et définir comme année en cours
      </Bouton>
    </form>
  );
}

export default function AnneeScolaire() {
  const { donnees, erreur, chargement, recharger } = useRequete('/annees');
  const [action, setAction] = useState(null);

  if (chargement) return <Chargement />;
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  const { annees } = donnees;

  async function rendreCourante(id) {
    setAction(id);
    await appelApi(`/annees/${id}/courante`, { methode: 'POST' }).catch(() => {});
    setAction(null);
    recharger();
  }

  return (
    <div className="space-y-6">
      <EnTetePage
        surtitre="Organisation"
        titre="Année scolaire"
        description="Années, trimestres ou semestres de l’établissement."
      />
      {!annees.length && (
        <Alerte type="info" titre="Commencez par l’année en cours">
          Les classes, les inscriptions et les notes sont rattachées à une année scolaire.
        </Alerte>
      )}
      {annees.map((annee, i) => (
        <Apparition
          key={annee.id}
          delai={i * 60}
          className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{annee.libelle}</h2>
              <p className="text-sm text-slate-500">
                Du {formaterDate(annee.dateDebut)} au {formaterDate(annee.dateFin)}
              </p>
            </div>
            {annee.estCourante ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-marque-50 px-3 py-1 text-sm font-semibold text-marque-700">
                <CheckCircle2 className="h-4 w-4" /> Année en cours
              </span>
            ) : (
              <Bouton
                variante="secondaire"
                chargement={action === annee.id}
                onClick={() => rendreCourante(annee.id)}
              >
                Définir comme année en cours
              </Bouton>
            )}
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-3">
            {annee.periodes.map((p) => (
              <li
                key={p.id}
                className="rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200"
              >
                <p className="font-semibold">
                  {p.type === 'SEMESTRE' ? 'Semestre' : 'Trimestre'} {p.numero}
                  {p.estCloturee && (
                    <span className="ml-2 text-xs font-medium text-slate-500">clôturé</span>
                  )}
                </p>
                <p className="text-slate-500">
                  {formaterDate(p.dateDebut)} → {formaterDate(p.dateFin)}
                </p>
              </li>
            ))}
          </ol>
        </Apparition>
      ))}
      <NouvelleAnnee onCree={recharger} />
    </div>
  );
}
