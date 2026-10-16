import { useState } from 'react';
import { CheckCheck } from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import Dialogue from '../../components/ui/Dialogue.jsx';
import Onglets from '../../components/ui/Onglets.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';
import { formaterDate } from '../../lib/navigation.js';

function DialogueJustification({ absence, onFermer, onJustifiee }) {
  const [motif, setMotif] = useState('');
  const [etat, setEtat] = useState({ envoi: false, erreur: null });
  async function justifier(e) {
    e.preventDefault();
    setEtat({ envoi: true, erreur: null });
    try {
      await appelApi(`/absences/${absence.id}/justification`, {
        methode: 'POST',
        corps: { motif },
      });
      onJustifiee();
    } catch (err) {
      setEtat({ envoi: false, erreur: err.message });
    }
  }
  return (
    <Dialogue ouvert onFermer={onFermer} titre="Justifier l’absence">
      <form onSubmit={justifier} className="space-y-4">
        <p className="text-sm text-slate-600">
          <span className="font-semibold">
            {absence.eleve.nom} {absence.eleve.prenoms}
          </span>{' '}
          · {absence.classe} · {formaterDate(absence.date)} à {absence.heureDebut}
        </p>
        <input
          aria-label="Motif"
          required
          minLength={3}
          maxLength={255}
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Ex. : certificat médical, mot des parents"
          className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base sm:text-sm"
        />
        {etat.erreur && <Alerte type="erreur">{etat.erreur}</Alerte>}
        <div className="flex justify-end gap-2">
          <Bouton variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" icone={CheckCheck} chargement={etat.envoi}>
            Justifier
          </Bouton>
        </div>
      </form>
    </Dialogue>
  );
}

export default function Absences() {
  const [filtre, setFiltre] = useState('nonJustifiees');
  const { donnees, erreur, chargement, recharger } = useRequete(
    `/absences${filtre === 'nonJustifiees' ? '?nonJustifiees=true' : ''}`,
  );
  const [selection, setSelection] = useState(null);

  return (
    <div className="space-y-6">
      <EnTetePage
        retour={{ vers: '/espace/appel', libelle: 'Appel' }}
        titre="Absences et retards"
        description="Relevés à l’appel. Les parents ont été prévenus par SMS ; enregistrez ici les justificatifs reçus."
      />
      <Onglets
        onglets={[
          ['nonJustifiees', 'À justifier'],
          ['toutes', 'Toutes'],
        ]}
        actif={filtre}
        onChange={setFiltre}
      />
      {erreur && <Alerte type="erreur">{erreur.message}</Alerte>}
      {chargement && <Chargement />}
      {donnees &&
        (donnees.absences.length ? (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {donnees.absences.map((a, i) => (
              <li
                key={a.id}
                className="ligne-note grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[1fr_10rem_8rem_auto]"
                style={{ '--delai': `${Math.min(i, 25) * 20}ms` }}
              >
                <p className="min-w-0 truncate">
                  <span className="font-semibold">{a.eleve.nom}</span> {a.eleve.prenoms}
                  <span className="block text-xs text-slate-500">{a.classe}</span>
                </p>
                <p className="hidden text-sm text-slate-600 sm:block">
                  {formaterDate(a.date)} <span className="chiffres">{a.heureDebut}</span>
                </p>
                <p className="hidden text-sm sm:block">
                  {a.statut === 'RETARD' ? `Retard ${a.minutesRetard ?? ''} min` : 'Absence'}
                </p>
                {a.justifiee ? (
                  <span className="text-xs font-semibold text-marque-700" title={a.motif}>
                    Justifiée
                  </span>
                ) : (
                  <Bouton
                    variante="secondaire"
                    className="!min-h-9 !py-1.5"
                    onClick={() => setSelection(a)}
                  >
                    Justifier
                  </Bouton>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Alerte type="succes">Aucune absence à justifier.</Alerte>
        ))}
      {selection && (
        <DialogueJustification
          absence={selection}
          onFermer={() => setSelection(null)}
          onJustifiee={() => {
            setSelection(null);
            recharger();
          }}
        />
      )}
    </div>
  );
}
