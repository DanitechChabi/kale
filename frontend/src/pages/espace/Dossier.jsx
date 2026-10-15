import { useState } from 'react';
import { RotateCcw, Upload } from 'lucide-react';
import EtapesVerification from '../../components/EtapesVerification.jsx';
import ListeDocuments from '../../components/ListeDocuments.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Badge, { STATUTS_ECOLE } from '../../components/ui/Badge.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import ChoixFichier from '../../components/ui/ChoixFichier.jsx';
import { Champ, ChampSelection } from '../../components/ui/Champ.jsx';
import { useAuth } from '../../contexte/Auth.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { appelApi } from '../../lib/api.js';
import { LIBELLES_PIECES } from '../../lib/documents.js';

const MESSAGES = {
  EN_ATTENTE: [
    'info',
    'Dossier en attente d’examen',
    'Le ministère examinera vos pièces. Vous pouvez encore en ajouter.',
  ],
  EN_EXAMEN: ['info', 'Dossier en cours d’examen', 'Vos pièces sont en cours de vérification.'],
  VERIFIEE: [
    'succes',
    'Établissement vérifié',
    'Vous pouvez créer les comptes de votre établissement.',
  ],
  SUSPENDUE: ['attention', 'Accès suspendu', null],
};

function AjoutDocument({ onAjoute }) {
  const [type, setType] = useState('');
  const [fichier, setFichier] = useState(null);
  const [reference, setReference] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function envoyer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const formulaire = new FormData();
    formulaire.append('type', type);
    if (reference) formulaire.append('referenceActe', reference);
    formulaire.append('fichier', fichier);
    try {
      await appelApi('/mon-ecole/dossier/documents', { methode: 'POST', corps: formulaire });
      setType('');
      setFichier(null);
      setReference('');
      onAjoute();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={envoyer} className="space-y-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <h3 className="font-semibold">Ajouter une pièce</h3>
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampSelection
          libelle="Type de pièce"
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="Choisir…"
          options={Object.entries(LIBELLES_PIECES).map(([valeur, libelle]) => ({
            valeur,
            libelle,
          }))}
          obligatoire
        />
        <Champ
          libelle="Référence de l’acte"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="N° d’arrêté…"
        />
      </div>
      <ChoixFichier fichier={fichier} onChange={setFichier} libelle="Fichier de la pièce" />
      <Bouton type="submit" icone={Upload} chargement={envoi} disabled={!type || !fichier}>
        Déposer la pièce
      </Bouton>
    </form>
  );
}

export default function Dossier() {
  const { utilisateur, mettreAJourUtilisateur } = useAuth();
  const { donnees, erreur, chargement, recharger } = useRequete('/mon-ecole/dossier');
  const [soumission, setSoumission] = useState({ envoi: false, erreur: null });

  if (chargement) return <Chargement />;
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;

  const { ecole, documents, piecesManquantes } = donnees;
  const modifiable = ['EN_ATTENTE', 'EN_EXAMEN', 'REJETEE'].includes(ecole.statutVerification);
  const message = MESSAGES[ecole.statutVerification];

  async function resoumettre() {
    setSoumission({ envoi: true, erreur: null });
    try {
      const resultat = await appelApi('/mon-ecole/dossier/soumettre', { methode: 'POST' });
      mettreAJourUtilisateur({
        ...utilisateur,
        ecole: { ...utilisateur.ecole, statutVerification: resultat.ecole.statutVerification },
      });
      recharger();
      setSoumission({ envoi: false, erreur: null });
    } catch (err) {
      setSoumission({ envoi: false, erreur: err.message });
    }
  }

  return (
    <div className="space-y-6">
      <div className="entree flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-marque-700">Dossier de vérification</p>
          <h1 className="text-2xl font-bold tracking-tight">{ecole.nom}</h1>
          <p className="text-sm text-slate-500">
            Code {ecole.code} · {ecole.commune}, {ecole.departement}
          </p>
        </div>
        <Badge statut={ecole.statutVerification} table={STATUTS_ECOLE} />
      </div>

      <section
        className="entree space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
        style={{ '--delai': '100ms' }}
      >
        <EtapesVerification statut={ecole.statutVerification} />
        {ecole.statutVerification === 'REJETEE' ? (
          <Alerte type="erreur" titre="Dossier rejeté">
            <p>{ecole.motifDecision}</p>
            <p className="mt-1">
              Déposez les pièces corrigées, puis soumettez à nouveau votre dossier.
            </p>
          </Alerte>
        ) : (
          message && (
            <Alerte type={message[0]} titre={message[1]}>
              {message[2] ?? ecole.motifDecision}
            </Alerte>
          )
        )}
        {piecesManquantes.length > 0 && (
          <Alerte type="attention" titre="Pièces obligatoires à fournir">
            <ul className="list-inside list-disc">
              {piecesManquantes.map((type) => (
                <li key={type}>{LIBELLES_PIECES[type]}</li>
              ))}
            </ul>
          </Alerte>
        )}
      </section>

      <section
        className="entree space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
        style={{ '--delai': '180ms' }}
      >
        <h2 className="font-semibold">Pièces justificatives</h2>
        <ListeDocuments
          documents={documents}
          cheminFichier={(id) => `/mon-ecole/dossier/documents/${id}/fichier`}
        />
        {modifiable && <AjoutDocument onAjoute={recharger} />}
        {ecole.statutVerification === 'REJETEE' && (
          <div className="space-y-2 border-t border-slate-100 pt-4">
            {soumission.erreur && <Alerte type="erreur">{soumission.erreur}</Alerte>}
            <Bouton
              icone={RotateCcw}
              chargement={soumission.envoi}
              disabled={piecesManquantes.length > 0}
              onClick={resoumettre}
            >
              Soumettre à nouveau le dossier
            </Bouton>
          </div>
        )}
      </section>
    </div>
  );
}
