import { CalendarX2, ChartColumn, MessageSquareText, ScrollText } from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import SimulateurUssd from '../../components/SimulateurUssd.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { formaterDate } from '../../lib/navigation.js';

const ICONES = { ABSENCE: CalendarX2, BULLETIN: ScrollText, RECAP_NOTES: ChartColumn };

/** Messages reçus par SMS, et le service par code USSD pour les téléphones simples. */
export default function Messages() {
  const { donnees, erreur, chargement } = useRequete('/parent/messages');
  return (
    <div className="space-y-8">
      <EnTetePage
        titre="Messages"
        description="Les SMS envoyés sur votre téléphone par les établissements de vos enfants."
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section>
          {erreur && <Alerte type="erreur">{erreur.message}</Alerte>}
          {chargement && <Chargement />}
          {donnees &&
            (donnees.messages.length ? (
              <ul className="space-y-3">
                {donnees.messages.map((m, i) => {
                  const Icone = ICONES[m.type] ?? MessageSquareText;
                  return (
                    <li
                      key={m.id}
                      className="ligne-note flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200"
                      style={{ '--delai': `${Math.min(i, 15) * 40}ms` }}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marque-50 text-marque-700">
                        <Icone className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs text-slate-500">{formaterDate(m.creeLe, true)}</p>
                        <p className="text-sm leading-relaxed">
                          {m.message.replace(/^EduRelevé : /, '')}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Alerte type="info">
                Aucun message pour le moment. Vous serez prévenu par SMS de chaque absence, des
                notes de chaque mois et des nouveaux bulletins.
              </Alerte>
            ))}
        </section>
        <aside className="space-y-3">
          <h2 className="etiquette">Sans internet</h2>
          <p className="text-sm text-slate-600">
            Depuis n’importe quel téléphone, même sans crédit internet, consultez les moyennes, les
            absences et les bulletins par un code à composer. Essayez ici :
          </p>
          <SimulateurUssd code={donnees?.codeUssd} />
        </aside>
      </div>
    </div>
  );
}
