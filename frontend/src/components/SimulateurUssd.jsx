import { useState } from 'react';
import { Delete, Phone, PhoneOff } from 'lucide-react';
import { appelApi } from '../lib/api.js';

const TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

/**
 * Téléphone simple simulé : le parcours USSD tel que l'opérateur le présentera,
 * avec les mêmes menus que la passerelle réelle. `avecNumero` : l'administrateur
 * peut essayer n'importe quel numéro ; un parent utilise toujours le sien.
 */
export default function SimulateurUssd({ code, avecNumero = false }) {
  const [telephone, setTelephone] = useState('');
  const [saisies, setSaisies] = useState(null); // null : session fermée
  const [ecran, setEcran] = useState('');
  const [reponse, setReponse] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const enCours = saisies !== null;
  const continuer = ecran.startsWith('CON');

  async function interroger(parcours) {
    setEnvoi(true);
    try {
      const resultat = await appelApi('/ussd/simulation', {
        methode: 'POST',
        corps: { texte: parcours.join('*'), ...(avecNumero && telephone && { telephone }) },
      });
      setEcran(resultat.reponse);
      setSaisies(resultat.reponse.startsWith('CON') ? parcours : null);
    } catch (err) {
      setEcran(`END ${err.message}`);
      setSaisies(null);
    } finally {
      setEnvoi(false);
      setReponse('');
    }
  }

  const appeler = () => interroger([]);
  const envoyer = () => reponse && interroger([...saisies, reponse]);
  const raccrocher = () => {
    setSaisies(null);
    setEcran('');
    setReponse('');
  };
  const taper = (t) => {
    if (enCours && continuer) setReponse((r) => (t === '#' ? r : `${r}${t}`).slice(0, 20));
  };

  return (
    <div className="mx-auto w-full max-w-[18rem] space-y-3">
      {avecNumero && (
        <input
          aria-label="Numéro de l’appelant"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          placeholder="Numéro à essayer : 01 97 …"
          className="chiffres block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      )}
      <div className="rounded-[2rem] bg-encre p-4 shadow-xl ring-1 ring-black/20">
        <div
          className="chiffres flex h-56 flex-col overflow-y-auto rounded-xl bg-marque-100 p-3 text-[0.8rem] leading-snug text-encre shadow-inner"
          role="log"
          aria-live="polite"
        >
          {ecran ? (
            <div key={ecran} className="ecran-ussd flex flex-1 flex-col">
              <p className="whitespace-pre-line">{ecran.replace(/^(CON|END) /, '')}</p>
              {continuer && (
                <p className="mt-auto border-t border-encre/30 pt-1">
                  &gt; {reponse}
                  <span className="animate-pulse">_</span>
                </p>
              )}
            </div>
          ) : (
            <p className="m-auto text-center opacity-70">
              {envoi ? 'Connexion…' : `Composez ${code ?? 'le code EduRelevé'}`}
            </p>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {TOUCHES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => taper(t)}
              className="chiffres rounded-xl bg-white/10 py-2.5 text-lg font-semibold text-white transition active:scale-95 active:bg-white/25"
            >
              {t}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {enCours && continuer ? (
            <button
              type="button"
              onClick={envoyer}
              disabled={!reponse || envoi}
              className="rounded-xl bg-marque-500 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              Envoyer
            </button>
          ) : (
            <button
              type="button"
              onClick={appeler}
              disabled={envoi}
              className="flex items-center justify-center rounded-xl bg-marque-500 py-2.5 text-white disabled:opacity-50"
              aria-label="Appeler"
            >
              <Phone className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setReponse((r) => r.slice(0, -1))}
            className="flex items-center justify-center rounded-xl bg-white/10 py-2.5 text-white"
            aria-label="Effacer"
          >
            <Delete className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={raccrocher}
            className="flex items-center justify-center rounded-xl bg-rouge py-2.5 text-white"
            aria-label="Raccrocher"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
