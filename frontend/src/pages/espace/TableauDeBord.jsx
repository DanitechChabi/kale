import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  FileCheck2,
  Inbox,
  ScrollText,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import Apparition from '../../components/animation/Apparition.jsx';
import MiseEnRoute from '../../components/MiseEnRoute.jsx';
import Badge, { STATUTS_ECOLE } from '../../components/ui/Badge.jsx';
import { LIBELLES_ROLES, useAuth } from '../../contexte/Auth.jsx';
import { useRequete } from '../../hooks/useRequete.js';
import { formaterTelephone } from '../../lib/navigation.js';

function Carte({ icone: Icone, titre, children, delai = 0 }) {
  return (
    <Apparition delai={delai} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-marque-50 text-marque-600">
          <Icone className="h-5 w-5" />
        </span>
        <h2 className="font-semibold">{titre}</h2>
      </div>
      <div className="mt-4 space-y-3 text-sm text-slate-600">{children}</div>
    </Apparition>
  );
}

function SyntheseVerification() {
  const { donnees } = useRequete('/verification/ecoles?parPage=1');
  const c = donnees?.compteurs ?? {};
  const aTraiter = (c.EN_ATTENTE ?? 0) + (c.EN_EXAMEN ?? 0);
  return (
    <Carte icone={ShieldCheck} titre="Vérification des établissements" delai={80}>
      <p>
        <span className="text-3xl font-bold text-slate-900 tabular-nums">
          {donnees ? aTraiter : '–'}
        </span>{' '}
        dossier{aTraiter > 1 ? 's' : ''} à traiter · {c.VERIFIEE ?? 0} établissement
        {(c.VERIFIEE ?? 0) > 1 ? 's' : ''} vérifié
        {(c.VERIFIEE ?? 0) > 1 ? 's' : ''}
      </p>
      <Link
        to="/espace/verification"
        className="inline-flex items-center gap-1 font-semibold text-marque-700 hover:underline"
      >
        Ouvrir la file de vérification <ArrowRight className="h-4 w-4" />
      </Link>
    </Carte>
  );
}

function SyntheseDuplicata() {
  const { donnees } = useRequete('/duplicatas?statut=EN_ATTENTE');
  const c = donnees?.compteurs ?? {};
  const aTraiter = (c.EN_ATTENTE ?? 0) + (c.EN_COURS ?? 0);
  return (
    <Carte icone={Inbox} titre="Demandes de duplicata" delai={80}>
      <p>
        <span className="chiffres text-3xl font-semibold text-slate-900">
          {donnees ? aTraiter : '–'}
        </span>{' '}
        demande{aTraiter > 1 ? 's' : ''} en attente · {c.DELIVREE ?? 0} délivrée
        {(c.DELIVREE ?? 0) > 1 ? 's' : ''}
      </p>
      <Link
        to="/espace/duplicatas"
        className="inline-flex items-center gap-1 font-semibold text-marque-700 hover:underline"
      >
        Traiter les demandes <ArrowRight className="h-4 w-4" />
      </Link>
    </Carte>
  );
}

function SyntheseDocumentsEleve() {
  const { donnees } = useRequete('/releves/mes-documents');
  const enVigueur = donnees?.documents.filter((d) => !d.remplacePar) ?? [];
  return (
    <Carte icone={ScrollText} titre="Mes bulletins et relevés" delai={80}>
      <p>
        <span className="chiffres text-3xl font-semibold text-slate-900">
          {donnees ? enVigueur.length : '–'}
        </span>{' '}
        document{enVigueur.length > 1 ? 's' : ''} archivé{enVigueur.length > 1 ? 's' : ''},
        vérifiable{enVigueur.length > 1 ? 's' : ''} en ligne
      </p>
      <Link
        to="/espace/mes-documents"
        className="inline-flex items-center gap-1 font-semibold text-marque-700 hover:underline"
      >
        Voir mes documents <ArrowRight className="h-4 w-4" />
      </Link>
    </Carte>
  );
}

export default function TableauDeBord() {
  const { utilisateur } = useAuth();
  const { ecole } = utilisateur;

  return (
    <div className="space-y-6">
      <div className="entree">
        <p className="text-sm font-medium text-marque-700">{LIBELLES_ROLES[utilisateur.role]}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Bonjour {utilisateur.prenoms}
        </h1>
      </div>

      {utilisateur.role === 'ADMIN_ECOLE' && ecole?.statutVerification === 'VERIFIEE' && (
        <MiseEnRoute />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ecole && (
          <Carte icone={Building2} titre="Votre établissement">
            <p className="text-base font-semibold text-slate-900">{ecole.nom}</p>
            <Badge statut={ecole.statutVerification} table={STATUTS_ECOLE} />
            {utilisateur.role === 'ADMIN_ECOLE' && (
              <Link
                to="/espace/dossier"
                className="flex items-center gap-1 font-semibold text-marque-700 hover:underline"
              >
                <FileCheck2 className="h-4 w-4" /> Dossier de vérification
              </Link>
            )}
          </Carte>
        )}
        {['SUPER_ADMIN', 'MINISTERE'].includes(utilisateur.role) && <SyntheseVerification />}
        {['ADMIN_ECOLE', 'SECRETARIAT'].includes(utilisateur.role) &&
          ecole?.statutVerification === 'VERIFIEE' && <SyntheseDuplicata />}
        {utilisateur.role === 'ELEVE' && <SyntheseDocumentsEleve />}
        <Carte icone={UserRound} titre="Votre compte" delai={160}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-slate-500">Nom</dt>
            <dd className="font-medium text-slate-900">
              {utilisateur.prenoms} {utilisateur.nom}
            </dd>
            {utilisateur.telephone && (
              <>
                <dt className="text-slate-500">Téléphone</dt>
                <dd className="font-medium text-slate-900 tabular-nums">
                  {formaterTelephone(utilisateur.telephone)}
                </dd>
              </>
            )}
            {utilisateur.email && (
              <>
                <dt className="text-slate-500">E-mail</dt>
                <dd className="min-w-0 truncate font-medium text-slate-900">{utilisateur.email}</dd>
              </>
            )}
          </dl>
          <Link
            to="/espace/mot-de-passe"
            className="inline-block font-semibold text-marque-700 hover:underline"
          >
            Changer de mot de passe
          </Link>
        </Carte>
      </div>
    </div>
  );
}
