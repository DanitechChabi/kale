import { useState } from 'react';
import Alerte from '../ui/Alerte.jsx';
import Bouton from '../ui/Bouton.jsx';
import Dialogue from '../ui/Dialogue.jsx';

/** Dialogue de confirmation avec un texte obligatoire (motif, réponse, note). */
export default function DialogueMotif({
  ouvert,
  onFermer,
  titre,
  explication,
  libelle = 'Motif',
  placeholder,
  bouton,
  variante = 'principal',
  onValider,
}) {
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  return (
    <Dialogue
      ouvert={ouvert}
      onFermer={() => {
        setErreur(null);
        onFermer();
      }}
      titre={titre}
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setEnvoi(true);
          setErreur(null);
          try {
            await onValider(texte.trim());
            setTexte('');
          } catch (err) {
            setErreur(err.message);
          } finally {
            setEnvoi(false);
          }
        }}
      >
        {explication && <p className="text-sm text-slate-600">{explication}</p>}
        <textarea
          aria-label={libelle}
          required
          maxLength={500}
          rows={3}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder={placeholder}
          className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-marque-500 focus:ring-2 focus:ring-marque-500/20 focus:outline-none sm:text-sm"
        />
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Bouton variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" variante={variante} chargement={envoi} disabled={!texte.trim()}>
            {bouton}
          </Bouton>
        </div>
      </form>
    </Dialogue>
  );
}
