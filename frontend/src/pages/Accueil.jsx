import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, QrCode, ScanLine } from 'lucide-react';
import Apparition from '../components/animation/Apparition.jsx';
import Compteur from '../components/animation/Compteur.jsx';
import Inclinaison from '../components/animation/Inclinaison.jsx';
import TexteRevele from '../components/animation/TexteRevele.jsx';
import Guilloche from '../components/Guilloche.jsx';
import LienAncre from '../components/LienAncre.jsx';
import { useApparition } from '../hooks/useApparition.js';
import { adresseVerification } from '../lib/releves.js';

// Les quatre espaces, présentés comme les colonnes d'un registre
const espaces = [
  {
    nom: 'École',
    qui: 'Direction, secrétariat, enseignants',
    quoi: 'Inscrire les élèves, saisir les notes même sans connexion, clôturer les trimestres, délivrer les relevés.',
  },
  {
    nom: 'Élève',
    qui: 'Élèves et anciens élèves',
    quoi: 'Consulter ses notes et retrouver ses relevés, y compris des années après avoir quitté l’établissement.',
  },
  {
    nom: 'Parent',
    qui: 'Parents et tuteurs',
    quoi: 'Suivre les notes, les absences et l’emploi du temps de chaque enfant, avec des alertes par SMS.',
  },
  {
    nom: 'Ministère',
    qui: 'Directions centrales et départementales',
    quoi: 'Lire les indicateurs par département, commune et établissement, dont les délais de délivrance.',
  },
];

const etapes = [
  [
    'L’établissement clôture le trimestre',
    'Les notes validées sont figées : plus aucune modification n’est possible, chaque saisie reste tracée.',
  ],
  [
    'Le relevé est scellé',
    'Le PDF reçoit un numéro unique et son empreinte numérique ; il est archivé définitivement.',
  ],
  [
    'Tout le monde peut vérifier',
    'Un employeur ou une université scanne le QR code et voit si le document est authentique.',
  ],
];

const notesExemple = [
  ['Sciences de la Vie et de la Terre', 5, 15.5],
  ['Mathématiques', 4, 13.75],
  ['Physique-Chimie et Technologie', 4, 14],
  ['Français', 3, 12.25],
  ['Philosophie', 2, 11.5],
  ['Anglais', 2, 16.25],
];

/** Le relevé, tel qu'il sort de la plateforme : feuille réglée, marge rouge, sceau. */
function Releve() {
  const [ref, visible] = useApparition({ seuil: 0.3 });
  return (
    <div
      ref={ref}
      data-visible={visible}
      className="sequence relative mx-auto w-full max-w-md"
      aria-hidden="true"
    >
      <Inclinaison amplitude={8}>
        <div className="flottement">
          <div className="entree-carte relative overflow-hidden rounded-md bg-white text-slate-900 shadow-2xl">
            <div className="reflet" />
            <Guilloche
              variante="bande"
              largeur={480}
              hauteur={40}
              lignes={9}
              className="block h-7 w-full text-marque-500/40"
            />
            <div className="marge-rouge cahier px-5 pt-4 pb-5 pl-11">
              <p className="etiquette truncate">CEG Les Cocotiers · Abomey-Calavi</p>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <p className="text-lg leading-tight font-bold">Relevé de notes</p>
                <p className="chiffres shrink-0 text-xs whitespace-nowrap text-slate-500">
                  R6CTD-1QEY2
                </p>
              </div>
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">DOSSOU Afi</span> · Terminale D ·
                2025‑2026
              </p>
              <table className="mt-4 w-full text-[13px]">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="pb-1 font-medium">Matière</th>
                    <th className="pb-1 text-right font-medium">Coef.</th>
                    <th className="pb-1 text-right font-medium">Moy.</th>
                  </tr>
                </thead>
                <tbody>
                  {notesExemple.map(([matiere, coef, note], i) => (
                    <tr
                      key={matiere}
                      className="ligne-note h-7"
                      style={{ '--delai': `${850 + i * 110}ms` }}
                    >
                      <td className="truncate pr-2">{matiere}</td>
                      <td className="chiffres text-right text-slate-500">{coef}</td>
                      <td className="chiffres text-right font-semibold">
                        <Compteur valeur={note} delai={900 + i * 110} actif={visible} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                className="ligne-note mt-3 flex items-end justify-between gap-3 border-t border-slate-900 pt-2"
                style={{ '--delai': '1550ms' }}
              >
                <div>
                  <p className="text-xs text-slate-500">Moyenne générale · rang</p>
                  <p className="chiffres text-base font-semibold">14,22 · 3e / 48</p>
                  <p className="chiffres mt-2 text-[11px] text-slate-500">N° ER-2026-000481</p>
                </div>
                <div className="relative">
                  <QrCode className="h-12 w-12 text-slate-800" strokeWidth={1.25} />
                  <span className="scan" />
                </div>
              </div>
            </div>
            <span className="absolute right-16 bottom-3 -rotate-[14deg] sm:right-20">
              <span className="tampon block text-rouge">
                <span className="tampon-encre bg-white/40 text-[0.8rem]">Authentique</span>
              </span>
            </span>
          </div>
        </div>
      </Inclinaison>
    </div>
  );
}

/** Vérification d'un document et duplicata : les deux services ouverts à tous. */
function Services() {
  const [numero, setNumero] = useState('');
  return (
    <section id="verifier" className="scroll-mt-20 border-b border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl lg:grid-cols-2">
        <Apparition className="space-y-4 px-4 py-10 sm:px-6 lg:border-r lg:border-slate-200 lg:py-14 lg:pr-12">
          <p className="etiquette flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-marque-600" /> Employeurs, universités
          </p>
          <h2 className="text-2xl font-bold tracking-tight">Vérifier un document</h2>
          <p className="text-slate-600">
            Scannez le QR code du bulletin ou saisissez son numéro. Sans compte, gratuit.
          </p>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              // Page servie par le serveur (légère, sans l'application)
              window.location.assign(adresseVerification(numero));
            }}
          >
            <input
              aria-label="Numéro du document"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="B26-7K3M-Q9P2X"
              required
              autoComplete="off"
              spellCheck="false"
              className="chiffres min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-base uppercase focus:border-marque-500 focus:ring-2 focus:ring-marque-500/20 focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-encre px-5 text-sm font-semibold text-white transition hover:bg-marque-700"
            >
              Vérifier
            </button>
          </form>
        </Apparition>
        <Apparition
          delai={120}
          className="space-y-4 border-t border-slate-200 px-4 py-10 sm:px-6 lg:border-t-0 lg:py-14 lg:pl-12"
        >
          <p className="etiquette">Anciens élèves, parents</p>
          <h2 className="text-2xl font-bold tracking-tight">Obtenir un duplicata</h2>
          <p className="text-slate-600">
            Demandez votre bulletin ou relevé en ligne : l’établissement le retrouve dans ses
            archives et vous le téléchargez, sans vous déplacer.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/duplicata"
              className="group inline-flex min-h-11 items-center gap-2 rounded-lg bg-marque-600 px-5 text-sm font-semibold text-white transition hover:bg-marque-700"
            >
              Faire une demande
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              to="/duplicata/suivi"
              className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-marque-700 ring-1 ring-slate-300 transition hover:bg-slate-50"
            >
              Suivre une demande
            </Link>
          </div>
        </Apparition>
      </div>
    </section>
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
      <section className="relative isolate overflow-hidden bg-encre text-white">
        <Guilloche
          variante="bande"
          largeur={1400}
          hauteur={260}
          lignes={18}
          anime
          className="absolute inset-x-0 bottom-0 -z-10 h-64 w-full text-or/25"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-28">
          <div className="space-y-6">
            <p className="entree etiquette !text-or/90" style={{ '--delai': '80ms' }}>
              Bulletins · Relevés · Vérification
            </p>
            <h1 className="text-[2.4rem] leading-[1.02] font-bold tracking-tight sm:text-6xl">
              <TexteRevele
                segments={[
                  { texte: 'Le relevé de notes,' },
                  { texte: 'sans le déplacement.', className: 'text-or' },
                ]}
              />
            </h1>
            <p
              className="entree max-w-lg text-base leading-relaxed text-marque-100 sm:text-lg"
              style={{ '--delai': '650ms' }}
            >
              Chaque bulletin est archivé définitivement, numéroté et scellé. Un ancien élève
              obtient son duplicata en ligne ; n’importe qui vérifie son authenticité en scannant le
              QR code.
            </p>
            <div className="entree flex flex-wrap gap-3 pt-1" style={{ '--delai': '800ms' }}>
              <Link
                to="/inscription-ecole"
                className="group inline-flex items-center gap-2 rounded-md bg-or px-5 py-3 text-sm font-bold text-encre transition hover:bg-white active:translate-y-px"
              >
                Inscrire mon établissement
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <LienAncre
                cible="fonctionnement"
                className="rounded-md px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/10"
              >
                Comment ça marche
              </LienAncre>
            </div>
          </div>
          <Releve />
        </div>
      </section>

      <Services />

      <section id="espaces" className="scroll-mt-20 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Apparition className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Quatre espaces, un seul registre.
            </h2>
            <p className="mt-3 text-slate-600">
              Les mêmes données, vues par chacun selon son rôle. Un établissement ne voit jamais les
              élèves d’un autre.
            </p>
          </Apparition>
          <dl className="mt-10 border-t-2 border-slate-900">
            {espaces.map(({ nom, qui, quoi }, i) => (
              <Apparition
                key={nom}
                delai={i * 90}
                className="ligne-registre grid gap-1 py-5 sm:grid-cols-[10rem_14rem_1fr] sm:gap-6"
              >
                <dt className="text-xl font-bold">{nom}</dt>
                <dd className="text-sm font-medium text-marque-700 sm:pt-1">{qui}</dd>
                <dd className="text-slate-600 sm:pt-0.5">{quoi}</dd>
              </Apparition>
            ))}
          </dl>
        </div>
      </section>

      <section className="pb-16 sm:pb-24">
        <Apparition className="mx-auto max-w-6xl px-4 sm:px-6">
          <Link
            to="/educourses"
            className="cahier marge-rouge group flex flex-col gap-4 rounded-lg py-8 pr-6 pl-12 ring-1 ring-slate-200 transition hover:ring-marque-400 sm:flex-row sm:items-center sm:justify-between sm:pl-14"
          >
            <span className="max-w-2xl space-y-2">
              <span className="etiquette block">EduCourses</span>
              <span className="block text-2xl font-bold tracking-tight">
                Les cours en ligne, de la 6e à la Terminale.
              </span>
              <span className="block text-slate-600">
                Tout le programme, leçon par leçon, avec exercices corrigés et quiz. Pour les
                élèves, et pour les parents qui veulent faire travailler leurs enfants à la maison.
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-marque-700">
              Découvrir
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </Link>
        </Apparition>
      </section>

      <section
        id="fonctionnement"
        className="scroll-mt-20 border-y border-slate-200 bg-white py-16 sm:py-24"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Apparition className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Du conseil de classe à l’employeur.
            </h2>
          </Apparition>
          <ol className="mt-12 grid gap-10 lg:grid-cols-3 lg:gap-8">
            {etapes.map(([titre, texte], index) => (
              <Apparition as="li" key={titre} delai={index * 160} className="relative">
                <span
                  className="barre-etape absolute top-5 right-0 left-12 hidden h-px bg-slate-300 lg:block"
                  aria-hidden="true"
                />
                <span className="pastille tampon-encre relative h-10 w-10 justify-center !p-0 !text-sm text-marque-700">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-lg font-bold">{titre}</h3>
                <p className="mt-2 leading-relaxed text-slate-600">{texte}</p>
              </Apparition>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-3">
          {[
            [
              '10',
              'caractères',
              'pour l’identifiant de chaque élève, avec un caractère de contrôle qui détecte les fautes de frappe.',
            ],
            [
              '0',
              'déplacement',
              'pour obtenir un duplicata : la demande se fait en ligne et le secrétariat la traite.',
            ],
            [
              '1',
              'feuille',
              'pour distribuer les accès d’une classe : identifiants et QR codes imprimés, sans téléphone ni e-mail.',
            ],
          ].map(([chiffre, unite, texte], i) => (
            <Apparition key={unite} delai={i * 120} className="border-t-2 border-slate-900 pt-5">
              <p className="flex items-baseline gap-2">
                <span className="chiffres text-5xl font-semibold text-marque-700">{chiffre}</span>
                <span className="text-lg font-bold">{unite}</span>
              </p>
              <p className="mt-3 text-slate-600">{texte}</p>
            </Apparition>
          ))}
        </div>
      </section>
    </>
  );
}
