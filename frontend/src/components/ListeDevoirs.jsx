import { useState } from 'react';
import { Check, FileText, FolderOpen, Image, Paperclip, Trash2, Upload } from 'lucide-react';
import { appelApi } from '../lib/api.js';
import { ouvrirDocument } from '../lib/documents.js';
import { dateLocale } from '../lib/emploiDuTemps.js';
import { formaterDate } from '../lib/navigation.js';

/** Copie rendue : état, appréciation de l'enseignant et pages (chargées à la demande). */
function CopieRendue({ rendu, cheminPages, cheminPage }) {
  const [pages, setPages] = useState(null);
  async function afficher() {
    const { pages: liste } = await appelApi(cheminPages);
    setPages(liste);
  }
  return (
    <div className="space-y-1.5 rounded-lg bg-slate-50 p-3 text-sm">
      <p className={`font-semibold ${rendu.enRetard ? 'text-sceau' : 'text-marque-700'}`}>
        Copie rendue le {formaterDate(rendu.rendLe, true)}
        {rendu.enRetard && ' · en retard'} · {rendu.pages} page{rendu.pages > 1 ? 's' : ''}
      </p>
      {rendu.appreciation && (
        <p className="text-slate-700">
          <span className="etiquette mr-1.5">Professeur</span>
          {rendu.appreciation}
        </p>
      )}
      {cheminPages &&
        (pages ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {pages.map((f, i) => {
              const Icone = f.typeMime === 'application/pdf' ? FileText : Image;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => ouvrirDocument(cheminPage(f))}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-medium ring-1 ring-slate-200"
                >
                  <Icone className="h-4 w-4 text-marque-700" /> Page {i + 1}
                </button>
              );
            })}
          </div>
        ) : (
          <button
            type="button"
            onClick={afficher}
            className="font-semibold text-marque-700 hover:underline"
          >
            Voir la copie
          </button>
        ))}
    </div>
  );
}

const dateLongue = (iso) =>
  new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));

/** Regroupe les devoirs par date de remise (cahier de textes). */
function parDate(devoirs) {
  const groupes = new Map();
  for (const d of devoirs) groupes.set(d.pourLe, [...(groupes.get(d.pourLe) ?? []), d]);
  return [...groupes];
}

/**
 * Devoirs. Élève : case « fait » (`onBasculer`). Parent : état seulement.
 * Enseignant : nombre d'élèves qui l'ont fait, et retrait (`onRetirer`).
 */
export default function ListeDevoirs({
  devoirs,
  cheminFichier,
  onBasculer,
  onRetirer,
  onRendre,
  onCopies,
  cheminPages,
  cheminPage,
  afficherMatiere = true,
}) {
  if (!devoirs.length) {
    return <p className="py-6 text-center text-sm text-slate-500">Aucun devoir pour le moment.</p>;
  }
  const aujourdhui = dateLocale();
  return (
    <div className="space-y-6">
      {parDate(devoirs).map(([date, liste], g) => {
        const passe = date < aujourdhui;
        return (
          <section
            key={date}
            className="entree space-y-2"
            style={{ '--delai': `${Math.min(g, 10) * 60}ms` }}
          >
            <h3
              className={`etiquette border-b-2 pb-1.5 ${passe ? 'border-slate-300' : 'border-slate-900'}`}
            >
              Pour {date === aujourdhui ? 'aujourd’hui' : `le ${dateLongue(date)}`}
            </h3>
            <ul className="space-y-2">
              {liste.map((d) => (
                <li
                  key={d.id}
                  className={`flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 ${d.fait ? 'opacity-70' : ''}`}
                >
                  {d.fait !== undefined &&
                    (onBasculer ? (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={d.fait}
                        aria-label={`${d.titre} : ${d.fait ? 'fait' : 'à faire'}`}
                        onClick={() => onBasculer(d)}
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-2 transition ${
                          d.fait
                            ? 'bg-marque-600 text-white ring-marque-600'
                            : 'ring-slate-300 hover:ring-marque-500'
                        }`}
                      >
                        {d.fait && <Check className="h-4 w-4" />}
                      </button>
                    ) : (
                      <span
                        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          d.fait
                            ? 'bg-marque-50 text-marque-700'
                            : passe
                              ? 'bg-red-50 text-rouge'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {d.fait ? 'Fait' : passe ? 'Non fait' : 'À faire'}
                      </span>
                    ))}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p
                      className={`font-semibold ${d.fait ? 'line-through decoration-slate-400' : ''}`}
                    >
                      {afficherMatiere && d.matiere && (
                        <span className="text-marque-700">{d.matiere} · </span>
                      )}
                      {d.titre}
                    </p>
                    <p className="text-sm whitespace-pre-line text-slate-600">{d.consignes}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      {d.fichier && (
                        <button
                          type="button"
                          onClick={() => ouvrirDocument(cheminFichier(d))}
                          className="inline-flex items-center gap-1 font-semibold text-marque-700 hover:underline"
                        >
                          <Paperclip className="h-4 w-4" /> {d.fichier.nom}
                        </button>
                      )}
                      {d.effectif !== undefined && (
                        <span className="text-slate-500">
                          Fait par{' '}
                          <span className="chiffres font-semibold text-slate-900">{d.faits}</span>{' '}
                          élève
                          {d.faits > 1 ? 's' : ''} sur {d.effectif}
                        </span>
                      )}
                      {onCopies && (
                        <button
                          type="button"
                          onClick={() => onCopies(d)}
                          className="inline-flex items-center gap-1 font-semibold text-marque-700 hover:underline"
                        >
                          <FolderOpen className="h-4 w-4" /> Copies rendues ({d.rendus ?? 0})
                        </button>
                      )}
                      {onRendre && (
                        <button
                          type="button"
                          onClick={() => onRendre(d)}
                          className="inline-flex items-center gap-1 font-semibold text-marque-700 hover:underline"
                        >
                          <Upload className="h-4 w-4" />{' '}
                          {d.rendu ? 'Remplacer ma copie' : 'Rendre ma copie'}
                        </button>
                      )}
                    </div>
                    {d.rendu && (
                      <CopieRendue
                        rendu={d.rendu}
                        cheminPages={cheminPages?.(d)}
                        cheminPage={cheminPage}
                      />
                    )}
                  </div>
                  {onRetirer && (
                    <button
                      type="button"
                      onClick={() => onRetirer(d)}
                      className="self-start rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-rouge"
                      aria-label={`Retirer ${d.titre}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
