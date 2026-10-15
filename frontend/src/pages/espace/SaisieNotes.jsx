import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CloudUpload, Lock, Save } from 'lucide-react';
import EnTetePage from '../../components/EnTetePage.jsx';
import Alerte from '../../components/ui/Alerte.jsx';
import Bouton from '../../components/ui/Bouton.jsx';
import Chargement from '../../components/ui/Chargement.jsx';
import { useLectureHorsLigne } from '../../hooks/useLectureHorsLigne.js';
import { appelApi } from '../../lib/api.js';
import {
  effacerBrouillon,
  ecrireBrouillon,
  lireBrouillon,
  memoriser,
  mettreEnFile,
} from '../../lib/horsLigne.js';
import { formaterDate } from '../../lib/navigation.js';
import { formaterNote, lireNote, libellePeriode } from '../../lib/notes.js';

const versSaisie = (note) => ({
  texte: note && !note.absent && note.valeur !== null ? String(note.valeur).replace('.', ',') : '',
  absent: Boolean(note?.absent),
});

/** Feuille de notes : saisie au clavier, enregistrée sur le téléphone à chaque frappe. */
export default function SaisieNotes() {
  const { id } = useParams();
  const chemin = `/evaluations/${id}/notes`;
  const { donnees, erreur, chargement } = useLectureHorsLigne(chemin);
  const [saisies, setSaisies] = useState(null);
  // Notes de référence (dernier état enregistré) pour savoir s'il reste des changements
  const [reference, setReference] = useState(null);
  const [brouillonRestaure, setBrouillonRestaure] = useState(false);
  const [etat, setEtat] = useState({ envoi: false, message: null, type: null });
  const champs = useRef([]);

  // Initialisation : notes du serveur, puis brouillon local s'il existe
  useEffect(() => {
    if (!donnees) return;
    let actif = true;
    const initiales = Object.fromEntries(donnees.eleves.map((e) => [e.id, versSaisie(e.note)]));
    lireBrouillon(id).then((brouillon) => {
      if (!actif) return;
      setReference(donnees.eleves);
      if (brouillon?.saisies) {
        setSaisies({ ...initiales, ...brouillon.saisies });
        setBrouillonRestaure(true);
      } else setSaisies(initiales);
    });
    return () => {
      actif = false;
    };
  }, [donnees, id]);

  const evaluation = donnees?.evaluation;
  const verrouillee = evaluation?.periode.estCloturee;
  const lignes = useMemo(
    () =>
      donnees && saisies
        ? donnees.eleves.map((e) => ({
            eleve: e,
            ...saisies[e.id],
            ...lireNote(saisies[e.id]?.texte, evaluation.bareme),
          }))
        : [],
    [donnees, saisies, evaluation],
  );
  const modifiee = useMemo(
    () =>
      reference &&
      saisies &&
      reference.some((e) => JSON.stringify(versSaisie(e.note)) !== JSON.stringify(saisies[e.id])),
    [reference, saisies],
  );

  // Avertit avant de quitter la page avec des notes non enregistrées
  useEffect(() => {
    if (!modifiee) return undefined;
    const avertir = (e) => e.preventDefault();
    window.addEventListener('beforeunload', avertir);
    return () => window.removeEventListener('beforeunload', avertir);
  }, [modifiee]);

  if (chargement || (donnees && !saisies)) return <Chargement />;
  if (erreur) return <Alerte type="erreur">{erreur.message}</Alerte>;

  const valides = lignes
    .filter((l) => l.valeur !== null && !l.absent)
    .map((l) => (l.valeur * 20) / evaluation.bareme);
  const erreurs = lignes.filter((l) => l.erreur);
  const moyenne = valides.length ? valides.reduce((s, v) => s + v, 0) / valides.length : null;

  function modifier(eleveId, changement) {
    setSaisies((actuelles) => {
      const suivantes = { ...actuelles, [eleveId]: { ...actuelles[eleveId], ...changement } };
      ecrireBrouillon(id, { saisies: suivantes }).catch(() => {});
      return suivantes;
    });
    setEtat({ envoi: false, message: null, type: null });
  }

  async function enregistrer() {
    const notes = lignes.map((l) => ({
      eleveId: l.eleve.id,
      valeur: l.absent ? null : l.valeur,
      absent: l.absent,
    }));
    setEtat({ envoi: true, message: null, type: null });
    const feuilleLocale = {
      ...donnees,
      eleves: donnees.eleves.map((e, i) => ({
        ...e,
        note: notes[i].absent || notes[i].valeur !== null ? { ...notes[i] } : null,
      })),
    };
    try {
      const resultat = await appelApi(chemin, { methode: 'PUT', corps: { notes } });
      await memoriser(chemin, resultat);
      await effacerBrouillon(id);
      setReference(resultat.eleves);
      setBrouillonRestaure(false);
      const { creees, modifiees, retirees } = resultat.bilan;
      setEtat({
        envoi: false,
        type: 'succes',
        message:
          creees + modifiees + retirees
            ? `Notes enregistrées : ${creees} ajoutée(s), ${modifiees} modifiée(s), ${retirees} retirée(s).`
            : 'Aucun changement.',
      });
    } catch (err) {
      if (err.code !== 'RESEAU') {
        setEtat({ envoi: false, type: 'erreur', message: err.message });
        return;
      }
      await mettreEnFile({
        cle: `notes:${id}`,
        chemin,
        methode: 'PUT',
        corps: { notes },
        libelle: `${evaluation.enseignement.matiere} · ${evaluation.libelle}`,
      });
      await memoriser(chemin, feuilleLocale);
      await effacerBrouillon(id);
      setReference(feuilleLocale.eleves);
      setEtat({
        envoi: false,
        type: 'attention',
        message:
          'Pas de réseau : les notes sont gardées sur ce téléphone et partiront automatiquement au retour de la connexion.',
      });
    }
  }

  const suivant = (index) => champs.current[index + 1]?.focus();

  return (
    <div className="space-y-5 pb-28">
      <EnTetePage
        retour={{
          vers: `/espace/notes/${evaluation.enseignement.id}?periode=${evaluation.periode.id}`,
          libelle: evaluation.enseignement.matiere,
        }}
        surtitre={`${evaluation.enseignement.classe.nom} · ${libellePeriode(evaluation.periode)}`}
        titre={evaluation.libelle}
        description={`${formaterDate(evaluation.date)} · noté sur ${evaluation.bareme}`}
      />
      {verrouillee && (
        <Alerte type="info" titre="Période clôturée">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-4 w-4" /> Notes définitives, consultables seulement.
          </span>
        </Alerte>
      )}
      {donnees.enAttente && (
        <Alerte type="attention">
          <span className="inline-flex items-center gap-1.5">
            <CloudUpload className="h-4 w-4" /> Évaluation créée hors connexion : elle sera envoyée
            avec les notes.
          </span>
        </Alerte>
      )}
      {brouillonRestaure && (
        <Alerte type="info">
          Saisie en cours retrouvée sur ce téléphone. Enregistrez pour l’envoyer.
        </Alerte>
      )}

      <ol className="marge-rouge overflow-hidden rounded-2xl bg-white pl-9 ring-1 ring-slate-200">
        {lignes.map((l, index) => (
          <li
            key={l.eleve.id}
            className="ligne-note flex items-center gap-3 border-b border-reglure py-2 pr-3 pl-2 last:border-0"
            style={{ '--delai': `${Math.min(index, 20) * 25}ms` }}
          >
            <span className="chiffres w-6 shrink-0 text-right text-xs text-slate-400">
              {index + 1}
            </span>
            <label htmlFor={`note-${l.eleve.id}`} className="min-w-0 flex-1 truncate">
              <span className="font-semibold">{l.eleve.nom}</span> {l.eleve.prenoms}
            </label>
            <input
              id={`note-${l.eleve.id}`}
              ref={(el) => (champs.current[index] = el)}
              type="text"
              inputMode="decimal"
              enterKeyHint="next"
              autoComplete="off"
              disabled={verrouillee || l.absent}
              value={l.absent ? '' : l.texte}
              placeholder={l.absent ? 'abs.' : '—'}
              onChange={(e) => modifier(l.eleve.id, { texte: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), suivant(index))}
              aria-invalid={Boolean(l.erreur)}
              className={`chiffres w-20 rounded-md border px-2 py-2 text-center text-lg font-semibold focus:ring-2 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 ${
                l.erreur
                  ? 'border-rouge text-rouge focus:ring-rouge/20'
                  : 'border-slate-300 focus:border-marque-500 focus:ring-marque-500/20'
              }`}
            />
            <label
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold ${l.absent ? 'bg-slate-900 text-white' : 'text-slate-500 ring-1 ring-slate-200'}`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={l.absent}
                disabled={verrouillee}
                onChange={(e) => modifier(l.eleve.id, { absent: e.target.checked })}
              />
              Abs.
            </label>
            {l.erreur && <span className="sr-only">{l.erreur}</span>}
          </li>
        ))}
      </ol>

      {/* Barre fixe : statistiques en direct et enregistrement */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <dl className="flex flex-1 gap-5 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Saisies</dt>
              <dd className="chiffres font-semibold">
                {lignes.filter((l) => l.valeur !== null || l.absent).length}/{lignes.length}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Moyenne /20</dt>
              <dd className="chiffres font-semibold">{formaterNote(moyenne)}</dd>
            </div>
            <div className="hidden sm:block">
              <dt className="text-xs text-slate-500">Min · Max</dt>
              <dd className="chiffres font-semibold">
                {valides.length
                  ? `${formaterNote(Math.min(...valides))} · ${formaterNote(Math.max(...valides))}`
                  : '–'}
              </dd>
            </div>
          </dl>
          {!verrouillee && (
            <Bouton
              icone={Save}
              chargement={etat.envoi}
              disabled={erreurs.length > 0 || !modifiee}
              onClick={enregistrer}
            >
              Enregistrer
            </Bouton>
          )}
        </div>
        {(etat.message || erreurs.length > 0) && (
          <p
            className={`mx-auto max-w-6xl px-4 pb-3 text-sm sm:px-6 ${
              erreurs.length || etat.type === 'erreur'
                ? 'text-rouge'
                : etat.type === 'attention'
                  ? 'text-amber-800'
                  : 'text-marque-700'
            }`}
            role="status"
          >
            {erreurs.length
              ? `${erreurs.length} note${erreurs.length > 1 ? 's' : ''} à corriger (maximum ${evaluation.bareme}, deux décimales).`
              : etat.message}
          </p>
        )}
      </div>
    </div>
  );
}
