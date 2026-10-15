import { useState } from 'react';
import { Check, ExternalLink, FileText, Share2 } from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import Guilloche from '../../components/Guilloche.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { formaterDate } from '../../lib/navigation.js';
import { formaterNote, formaterRang } from '../../lib/notes.js';
import { lienVerification, ouvrirPdf, titreDocument } from '../../lib/releves.js';

/** Partage le lien de vérification (feuille de partage du téléphone, sinon copie). */
function BoutonPartage({ document }) {
  const [copie, setCopie] = useState(false);
  async function partager() {
    const url = document.urlVerification;
    try {
      if (navigator.share) {
        await navigator.share({ title: titreDocument(document), url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopie(true);
        setTimeout(() => setCopie(false), 2000);
      }
    } catch {
      // Partage annulé par l'utilisateur : rien à faire
    }
  }
  return (
    <button
      type="button"
      onClick={partager}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-marque-700 hover:bg-marque-50"
    >
      {copie ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copie ? 'Lien copié' : 'Partager le lien de vérification'}
    </button>
  );
}

function CarteDocument({ document, index }) {
  const remplace = Boolean(document.remplacePar);
  return (
    <li
      className={`entree relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 ${remplace ? 'opacity-70' : ''}`}
      style={{ '--delai': `${index * 70}ms` }}
    >
      <Guilloche
        variante="bande"
        largeur={600}
        hauteur={40}
        lignes={7}
        className="absolute inset-x-0 top-0 h-8 w-full text-marque-500/25"
      />
      <div className="relative space-y-3 p-5 pt-9">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-marque-700">
              {document.anneeScolaire} · {document.classe}
            </p>
            <h2 className="text-lg font-bold">{titreDocument(document)}</h2>
          </div>
          <span className="tampon-encre text-marque-700">{document.numeroAffiche}</span>
        </div>
        <p className="flex items-baseline gap-2">
          <span
            className={`chiffres text-3xl font-semibold ${document.moyenneGenerale !== null && document.moyenneGenerale < 10 ? 'text-rouge' : ''}`}
          >
            {formaterNote(document.moyenneGenerale)}
          </span>
          <span className="text-sm text-slate-500">
            / 20 · {formaterRang(document.rang, document.exAequo)} sur {document.effectif}
          </span>
        </p>
        <p className="text-xs text-slate-500">Délivré le {formaterDate(document.genereLe)}</p>
        {remplace && (
          <Alerte type="attention">
            Remplacé par le document corrigé{' '}
            <span className="chiffres font-semibold">{document.remplacePar.numero}</span>.
          </Alerte>
        )}
        <div className="-mx-3 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => ouvrirPdf(`/releves/mes-documents/${document.id}/pdf`)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-marque-700 hover:bg-marque-50"
          >
            <FileText className="h-4 w-4" /> Ouvrir le PDF
          </button>
          {!remplace && <BoutonPartage document={document} />}
          <a
            href={lienVerification(document.numeroAffiche)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            <ExternalLink className="h-4 w-4" /> Vérification
          </a>
        </div>
      </div>
    </li>
  );
}

export default function MesDocuments() {
  const { donnees, erreur, chargement } = useRequete('/releves/mes-documents');
  return (
    <div className="space-y-6">
      <EnTetePage
        titre="Mes bulletins et relevés"
        description="Documents archivés par votre établissement. Un employeur ou une université vérifie leur authenticité avec le QR code ou le lien de vérification, sans compte."
      />
      {erreur && <Alerte type="erreur">{erreur.message}</Alerte>}
      {chargement && <Chargement />}
      {donnees &&
        (donnees.documents.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {donnees.documents.map((d, i) => (
              <CarteDocument key={d.id} document={d} index={i} />
            ))}
          </ul>
        ) : (
          <Alerte type="info">
            Aucun document pour le moment. Vos bulletins apparaîtront ici dès leur délivrance, après
            chaque conseil de classe.
          </Alerte>
        ))}
    </div>
  );
}
