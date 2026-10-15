import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import QRCode from 'qrcode';
import { IconeLogo } from './Logo.jsx';
import Bouton from './ui/Bouton.jsx';
import { formaterIdentifiant } from '../lib/scolarite.js';

/**
 * Fiches de connexion à imprimer et à remettre en main propre : identifiant,
 * mot de passe temporaire et QR code qui ouvre la page de connexion pré-remplie.
 * `fiches` : [{ cle, nom, prenoms, identifiant, motDePasseTemporaire, detail }]
 */
export default function FichesConnexion({ fiches, titre }) {
  const [codes, setCodes] = useState({});

  useEffect(() => {
    let actif = true;
    Promise.all(
      fiches.map(async (f) => {
        const url = `${window.location.origin}/connexion?identifiant=${encodeURIComponent(f.identifiant)}`;
        return [
          f.cle,
          await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }),
        ];
      }),
    ).then((paires) => actif && setCodes(Object.fromEntries(paires)));
    return () => {
      actif = false;
    };
  }, [fiches]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-slate-600">
          Ces mots de passe ne seront plus affichés. Imprimez les fiches ou notez-les maintenant.
        </p>
        <Bouton icone={Printer} onClick={() => window.print()}>
          Imprimer {fiches.length > 1 ? `les ${fiches.length} fiches` : 'la fiche'}
        </Bouton>
      </div>
      <div className="zone-impression grid gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-0">
        {fiches.map((f) => (
          <article
            key={f.cle}
            className="fiche-connexion marge-rouge flex gap-4 rounded-md border border-dashed border-slate-400 bg-white p-4 pl-11 print:rounded-none"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-marque-700">
                <IconeLogo className="h-5 w-5" /> EduRelevé{' '}
                {titre && <span className="font-medium text-slate-500">· {titre}</span>}
              </div>
              <p className="leading-tight font-semibold">
                {f.prenoms} {f.nom}
              </p>
              {f.detail && <p className="text-xs text-slate-500">{f.detail}</p>}
              <dl className="space-y-1 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Identifiant</dt>
                  <dd className="chiffres text-base font-semibold tracking-wide">
                    {/^[0-9A-Z]{10}$/.test(f.identifiant)
                      ? formaterIdentifiant(f.identifiant)
                      : f.identifiant}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Mot de passe provisoire</dt>
                  <dd className="chiffres text-base font-semibold tracking-wide">
                    {f.motDePasseTemporaire}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex w-24 shrink-0 flex-col items-center gap-1 text-center">
              <div
                className="h-24 w-24"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: codes[f.cle] ?? '' }}
              />
              <p className="text-[10px] leading-tight text-slate-500">
                Scannez pour vous connecter
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
