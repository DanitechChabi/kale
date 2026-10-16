import { useState } from 'react';
import { Check, FileText, Image } from 'lucide-react';
import Alerte from './ui/Alerte.jsx';
import Chargement from './ui/Chargement.jsx';
import Dialogue from './ui/Dialogue.jsx';
import { useRequete } from '../hooks/useRequete.js';
import { appelApi } from '../lib/api.js';
import { ouvrirDocument } from '../lib/documents.js';
import { formaterDate } from '../lib/navigation.js';

function Appreciation({ copie, onEnregistre }) {
  const [texte, setTexte] = useState(copie.appreciation ?? '');
  const [etat, setEtat] = useState(null);
  async function enregistrer() {
    setEtat('envoi');
    try {
      await appelApi(`/copies/${copie.id}`, { methode: 'PATCH', corps: { appreciation: texte } });
      setEtat('ok');
      onEnregistre();
    } catch {
      setEtat('erreur');
    }
  }
  return (
    <div className="flex gap-2">
      <input
        aria-label="Appréciation"
        value={texte}
        maxLength={500}
        onChange={(e) => {
          setTexte(e.target.value);
          setEtat(null);
        }}
        placeholder="Appréciation (visible par l’élève et ses parents)"
        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={enregistrer}
        disabled={etat === 'envoi'}
        className="rounded-lg px-3 text-sm font-semibold text-marque-700 hover:bg-marque-50"
      >
        {etat === 'ok' ? <Check className="h-4 w-4" /> : 'Valider'}
      </button>
    </div>
  );
}

/** Copies d'un devoir : qui a rendu, les pages, l'appréciation de l'enseignant. */
export default function CopiesDevoir({ devoir, onFermer }) {
  const { donnees, erreur, chargement, recharger } = useRequete(`/devoirs/${devoir.id}/copies`);
  const rendues = donnees?.copies.filter((c) => c.rendu).length ?? 0;
  return (
    <Dialogue ouvert onFermer={onFermer} titre={`Copies · ${devoir.titre}`} large>
      {erreur && <Alerte type="erreur">{erreur.message}</Alerte>}
      {chargement && <Chargement />}
      {donnees && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            <span className="chiffres font-semibold text-slate-900">{rendues}</span> copie
            {rendues > 1 ? 's' : ''} rendue{rendues > 1 ? 's' : ''} sur {donnees.copies.length}
          </p>
          <ul className="divide-y divide-slate-100">
            {donnees.copies.map(({ eleve, rendu }) => (
              <li key={eleve.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold">{eleve.nom}</span> {eleve.prenoms}
                  </span>
                  {rendu ? (
                    <span
                      className={`text-xs font-semibold ${rendu.enRetard ? 'text-sceau' : 'text-marque-700'}`}
                    >
                      Rendue le {formaterDate(rendu.rendLe, true)}
                      {rendu.enRetard && ' · en retard'}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Non rendue</span>
                  )}
                </div>
                {rendu && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {rendu.fichiers.map((f) => {
                        const Icone = f.typeMime === 'application/pdf' ? FileText : Image;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => ouvrirDocument(`/copies/fichiers/${f.id}`)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium ring-1 ring-slate-200 hover:bg-slate-50"
                          >
                            <Icone className="h-4 w-4 text-marque-700" /> Page {f.ordre}
                          </button>
                        );
                      })}
                    </div>
                    {rendu.commentaire && (
                      <p className="text-sm text-slate-600 italic">« {rendu.commentaire} »</p>
                    )}
                    <Appreciation copie={rendu} onEnregistre={recharger} />
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialogue>
  );
}
