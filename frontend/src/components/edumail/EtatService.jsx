import Alerte from '../ui/Alerte.jsx';
import { politiqueConsentement } from '../../lib/edumail.js';

/** État du service de messagerie, sans aucun secret (affiché au personnel). */
export default function EtatService({ service }) {
  return (
    <div className="space-y-3">
      {service.simulation ? (
        <Alerte type="attention" titre="Fournisseur simulé">
          Mode de développement : les comptes « créés » n’existent que dans la simulation et ne
          reçoivent aucun message.
        </Alerte>
      ) : (
        !service.creationActivee && (
          <Alerte type="info" titre="Création des boîtes non activée">
            {service.raison} Les demandes peuvent être instruites et approuvées ; les boîtes seront
            créées après la configuration du fournisseur et du domaine.
          </Alerte>
        )
      )}
      <p className="text-xs text-slate-500">
        Fournisseur : <span className="font-semibold">{service.fournisseur}</span> · Domaine :{' '}
        <span className="chiffres">{service.domaine ?? 'non configuré'}</span> ·{' '}
        {politiqueConsentement(service.consentement)}
      </p>
    </div>
  );
}
