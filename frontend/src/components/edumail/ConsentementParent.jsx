import { useState } from 'react';
import { Check, Mail, X } from 'lucide-react';
import Alerte from '../ui/Alerte.jsx';
import Badge from '../ui/Badge.jsx';
import Bouton from '../ui/Bouton.jsx';
import Chargement from '../ui/Chargement.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';
import { STATUTS_EDUMAIL } from '../../lib/edumail.js';
import { formaterDate } from '../../lib/navigation.js';

/** Espace parent : accord (ou retrait) pour le compte EduMail demandé par l'enfant. */
export default function ConsentementParent({ eleveId, prenom }) {
  const chemin = `/edumail/parent/enfants/${eleveId}`;
  const { donnees, erreur, chargement } = useRequete(chemin);
  const [maj, setMaj] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreurAction, setErreurAction] = useState(null);
  const [confirmerRetrait, setConfirmerRetrait] = useState(false);

  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;
  if (chargement) return <Chargement />;
  const { compte, consentement, service } = maj ?? donnees;

  async function agir(methode) {
    setEnvoi(true);
    setErreurAction(null);
    try {
      setMaj(await appelApi(`${chemin}/consentement`, { methode }));
      setConfirmerRetrait(false);
    } catch (err) {
      setErreurAction(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  if (!compte)
    return (
      <Alerte type="info">
        {prenom} n’a pas demandé de compte EduMail. S’il ou elle en fait la demande, vous pourrez
        donner votre accord ici.
      </Alerte>
    );

  return (
    <section className="cahier marge-rouge space-y-4 rounded-2xl py-4 pr-4 pl-10 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center gap-2">
        <Mail className="h-5 w-5 text-marque-600" />
        <h2 className="font-semibold">Compte EduMail</h2>
        <Badge statut={compte.statut} table={STATUTS_EDUMAIL} />
      </div>
      <div className="space-y-2 text-sm text-slate-700">
        <p>
          {prenom} a demandé une adresse de messagerie scolaire le {formaterDate(compte.demandeLe)}.
          Cette adresse est un identifiant neutre, gérée par l’établissement, qui peut la suspendre
          ou la clôturer.
        </p>
        {compte.adresse && (
          <p>
            Adresse : <span className="chiffres">{compte.adresse}</span>
          </p>
        )}
        {service.simulation && (
          <p className="text-amber-800">Service en simulation : aucune boîte réelle n’est créée.</p>
        )}
      </div>
      {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}
      {consentement.donneParMoi ? (
        <div className="space-y-3">
          <Alerte type="succes">
            Vous avez donné votre accord le {formaterDate(consentement.donneLe, true)}.
          </Alerte>
          {confirmerRetrait ? (
            <div className="space-y-2 text-sm">
              <p>
                Retirer votre accord ? L’établissement en sera informé et réexaminera le compte.
              </p>
              <div className="flex flex-wrap gap-2">
                <Bouton variante="danger" chargement={envoi} onClick={() => agir('DELETE')}>
                  Confirmer le retrait
                </Bouton>
                <Bouton variante="secondaire" onClick={() => setConfirmerRetrait(false)}>
                  Annuler
                </Bouton>
              </div>
            </div>
          ) : (
            <Bouton variante="secondaire" icone={X} onClick={() => setConfirmerRetrait(true)}>
              Retirer mon accord
            </Bouton>
          )}
        </div>
      ) : (
        consentement.requis &&
        !['REFUSE', 'CLOTURE'].includes(compte.statut) && (
          <div className="space-y-2">
            {consentement.obtenu && (
              <p className="text-sm text-slate-600">
                Un consentement a déjà été enregistré par l’établissement ou un autre parent.
              </p>
            )}
            <Bouton icone={Check} chargement={envoi} onClick={() => agir('PUT')}>
              Je donne mon accord
            </Bouton>
            <p className="text-xs text-slate-500">
              Votre accord est enregistré avec la date et l’heure. Vous pourrez le retirer à tout
              moment.
            </p>
          </div>
        )
      )}
    </section>
  );
}
