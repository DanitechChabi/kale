import {
  ArrowDown,
  BookOpenCheck,
  Fingerprint,
  GraduationCap,
  Landmark,
  QrCode,
  School,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LienAncre from '../components/LienAncre.jsx';
import Apparition from '../components/animation/Apparition.jsx';
import CarteProjecteur from '../components/animation/CarteProjecteur.jsx';
import Compteur from '../components/animation/Compteur.jsx';
import Inclinaison from '../components/animation/Inclinaison.jsx';
import TexteRevele from '../components/animation/TexteRevele.jsx';
import { useApparition } from '../hooks/useApparition.js';

// Les quatre espaces de la plateforme
const espaces = [
  {
    titre: 'École',
    description: 'Élèves, classes, matières, saisie des notes, emplois du temps et cours.',
    Icone: School,
  },
  {
    titre: 'Élève',
    description: 'Notes, cours en ligne et relevés téléchargeables, même après la scolarité.',
    Icone: GraduationCap,
  },
  {
    titre: 'Parent',
    description: 'Suivi des notes, des absences et de l’emploi du temps de chaque enfant.',
    Icone: Users,
  },
  {
    titre: 'Ministère',
    description: 'Indicateurs consolidés par département, commune et établissement.',
    Icone: Landmark,
  },
];

// Le cycle de vie d'un relevé
const etapes = [
  {
    titre: 'L’établissement publie',
    description: 'Les notes validées produisent un bulletin ou un relevé officiel, au format PDF.',
    Icone: BookOpenCheck,
  },
  {
    titre: 'Le document est scellé',
    description:
      'Chaque relevé reçoit un numéro unique et une empreinte numérique. Il est archivé sans modification possible.',
    Icone: Fingerprint,
  },
  {
    titre: 'Tout le monde peut vérifier',
    description:
      'Un employeur ou une université scanne le QR code et confirme l’authenticité en quelques secondes.',
    Icone: QrCode,
  },
];

// Notes affichées sur la carte d'illustration
const notesExemple = [
  ['Mathématiques', 15.5],
  ['Français', 13.75],
  ['Physique-Chimie', 14],
  ['Anglais', 16.25],
];

/** Illustration animée : un relevé qui s'inscrit, se fait tamponner puis scanner. */
// La séquence reste en pause tant que la carte n'est pas à l'écran (utile sur mobile,
// où elle se trouve sous la ligne de flottaison).
function ApercuReleve() {
  const [ref, visible] = useApparition({ seuil: 0.3 });
  return (
    <div
      ref={ref}
      data-visible={visible}
      className="sequence relative mx-auto w-full max-w-sm"
      aria-hidden="true"
    >
      <div className="lueur absolute -inset-6 rounded-[2rem] bg-marque-400/25 blur-2xl" />
      <Inclinaison>
        <div className="flottement">
          <div className="entree-carte relative rounded-2xl bg-white p-5 text-slate-900 shadow-2xl shadow-black/30 ring-1 ring-black/5">
            <div className="reflet" />
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  Relevé de notes
                </p>
                <p className="mt-0.5 font-semibold">Année scolaire 2025‑2026</p>
              </div>
              <span className="tampon inline-flex shrink-0 items-center gap-1 rounded-full bg-marque-50 px-2.5 py-1 text-xs font-semibold text-marque-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Authentique
              </span>
            </div>
            <dl className="space-y-2.5 py-4 text-sm">
              {notesExemple.map(([matiere, note], i) => (
                <div
                  key={matiere}
                  className="ligne-note flex justify-between"
                  style={{ '--delai': `${900 + i * 120}ms` }}
                >
                  <dt className="text-slate-500">{matiere}</dt>
                  <dd className="font-medium">
                    <Compteur valeur={note} delai={950 + i * 120} actif={visible} />
                  </dd>
                </div>
              ))}
            </dl>
            <div
              className="ligne-note flex items-center justify-between rounded-xl bg-slate-50 p-3"
              style={{ '--delai': '1450ms' }}
            >
              <div>
                <p className="text-[11px] text-slate-400">N° de document</p>
                <p className="font-mono text-sm font-semibold tracking-tight">ER-2026-000481</p>
              </div>
              <div className="relative">
                <QrCode className="h-10 w-10 text-slate-800" strokeWidth={1.5} />
                <span className="scan" />
              </div>
            </div>
          </div>
        </div>
      </Inclinaison>
    </div>
  );
}

export default function Accueil() {
  // Arrivée depuis une autre page via un lien de section : on fait défiler jusqu'à elle
  const { state } = useLocation();
  useEffect(() => {
    if (state?.ancre) document.getElementById(state.ancre)?.scrollIntoView({ block: 'start' });
  }, [state]);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-marque-700 via-marque-600 to-marque-900 text-white">
        {/* Décor animé */}
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="aurore aurore-1" />
          <div className="aurore aurore-2" />
          <div className="aurore aurore-3" />
          <div className="quadrillage absolute inset-0" />
        </div>

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="space-y-5">
            <p
              className="entree inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20 backdrop-blur-sm"
              style={{ '--delai': '100ms' }}
            >
              <ShieldCheck className="h-4 w-4 text-or" />
              Documents scolaires infalsifiables
            </p>
            <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:text-5xl">
              <TexteRevele
                segments={[
                  { texte: 'Vos relevés de notes,' },
                  { texte: 'sans vous déplacer.', className: 'text-or' },
                ]}
              />
            </h1>
            <p
              className="entree max-w-xl text-base text-marque-100 sm:text-lg"
              style={{ '--delai': '650ms' }}
            >
              EduRelevé relie établissements, élèves, parents et ministère. Chaque bulletin et
              relevé est archivé définitivement et vérifiable en ligne par numéro ou QR code.
            </p>
            <div className="entree flex flex-wrap gap-3 pt-2" style={{ '--delai': '800ms' }}>
              <LienAncre
                cible="espaces"
                className="bouton-brillant group inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-marque-700 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
              >
                Découvrir les espaces
                <ArrowDown className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5" />
              </LienAncre>
              <LienAncre
                cible="fonctionnement"
                className="rounded-lg px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:-translate-y-0.5 hover:bg-white/10 active:translate-y-0"
              >
                Comment ça marche
              </LienAncre>
            </div>
          </div>
          <ApercuReleve />
        </div>
      </section>

      <section id="espaces" className="scroll-mt-20 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Apparition>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Un espace pour chacun</h2>
            <p className="mt-2 max-w-2xl text-slate-600">
              Chaque utilisateur accède uniquement aux informations qui le concernent.
            </p>
          </Apparition>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {espaces.map(({ titre, description, Icone }, i) => (
              <Apparition as="li" key={titre} delai={i * 90}>
                <CarteProjecteur className="group h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-marque-200 hover:shadow-lg hover:shadow-marque-900/5">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-marque-50 text-marque-600 transition duration-300 group-hover:scale-110 group-hover:-rotate-6 group-hover:bg-marque-600 group-hover:text-white">
                    <Icone className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 font-semibold">{titre}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
                </CarteProjecteur>
              </Apparition>
            ))}
          </ul>
        </div>
      </section>

      <section id="fonctionnement" className="scroll-mt-20 bg-slate-50 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Apparition>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Un relevé fiable, de l’école à l’employeur
            </h2>
          </Apparition>
          <ol className="mt-8 grid gap-4 lg:grid-cols-3">
            {etapes.map(({ titre, description, Icone }, index) => (
              <Apparition
                as="li"
                key={titre}
                delai={index * 150}
                className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
              >
                <span
                  className="barre-etape absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-marque-500 to-or"
                  aria-hidden="true"
                />
                <div className="flex items-center gap-3">
                  <span className="pastille flex h-8 w-8 items-center justify-center rounded-full bg-marque-600 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <Icone className="h-5 w-5 text-marque-600" />
                </div>
                <h3 className="mt-4 font-semibold">{titre}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
              </Apparition>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
