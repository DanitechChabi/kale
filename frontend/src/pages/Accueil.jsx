import {
  BookOpenCheck,
  Fingerprint,
  GraduationCap,
  Landmark,
  QrCode,
  School,
  ShieldCheck,
  Users,
} from 'lucide-react';

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

/** Illustration : aperçu d'un relevé authentifié. */
function ApercuReleve() {
  return (
    <div className="relative mx-auto w-full max-w-sm" aria-hidden="true">
      <div className="absolute -inset-4 rounded-3xl bg-marque-500/20 blur-2xl" />
      <div className="relative rounded-2xl bg-white p-5 text-slate-900 shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Relevé de notes
            </p>
            <p className="mt-0.5 font-semibold">Année scolaire 2025‑2026</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-marque-50 px-2.5 py-1 text-xs font-semibold text-marque-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Authentique
          </span>
        </div>
        <dl className="space-y-2.5 py-4 text-sm">
          {[
            ['Mathématiques', '15,50'],
            ['Français', '13,75'],
            ['Physique-Chimie', '14,00'],
            ['Anglais', '16,25'],
          ].map(([matiere, note]) => (
            <div key={matiere} className="flex justify-between">
              <dt className="text-slate-500">{matiere}</dt>
              <dd className="font-medium tabular-nums">{note}</dd>
            </div>
          ))}
        </dl>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
          <div>
            <p className="text-[11px] text-slate-400">N° de document</p>
            <p className="font-mono text-sm font-semibold tracking-tight">ER-2026-000481</p>
          </div>
          <QrCode className="h-10 w-10 text-slate-800" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}

export default function Accueil() {
  return (
    <>
      <section className="bg-gradient-to-br from-marque-700 via-marque-600 to-marque-900 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div className="space-y-5">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20">
              <ShieldCheck className="h-4 w-4 text-or" />
              Documents scolaires infalsifiables
            </p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Vos relevés de notes, <span className="text-or">sans vous déplacer.</span>
            </h1>
            <p className="max-w-xl text-base text-marque-100 sm:text-lg">
              EduRelevé relie établissements, élèves, parents et ministère. Chaque bulletin et
              relevé est archivé définitivement et vérifiable en ligne par numéro ou QR code.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href="#espaces"
                className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-marque-700 shadow-sm hover:bg-marque-50"
              >
                Découvrir les espaces
              </a>
              <a
                href="#fonctionnement"
                className="rounded-lg px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/10"
              >
                Comment ça marche
              </a>
            </div>
          </div>
          <ApercuReleve />
        </div>
      </section>

      <section id="espaces" className="scroll-mt-20 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Un espace pour chacun</h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Chaque utilisateur accède uniquement aux informations qui le concernent.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {espaces.map(({ titre, description, Icone }) => (
              <li
                key={titre}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-marque-200 hover:shadow-md"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-marque-50 text-marque-600">
                  <Icone className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-semibold">{titre}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="fonctionnement" className="scroll-mt-20 bg-slate-50 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Un relevé fiable, de l’école à l’employeur
          </h2>
          <ol className="mt-8 grid gap-4 lg:grid-cols-3">
            {etapes.map(({ titre, description, Icone }, index) => (
              <li key={titre} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-marque-600 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <Icone className="h-5 w-5 text-marque-600" />
                </div>
                <h3 className="mt-4 font-semibold">{titre}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
