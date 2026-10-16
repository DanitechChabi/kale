// Chargement du catalogue EduCourses : programmes (prisma/donnees/educourses/programmes/*.json)
// et leçons rédigées (prisma/donnees/educourses/cours/<DOSSIER>/<CC>-<LL>.md).
//
// Idempotent : un programme validé par le ministère (est_verifie) n'est jamais
// modifié ; une leçon n'est recalculée que si son fichier a changé (empreinte).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyserLecon, cleDossier, indicesFichier } from '../src/contexts/educourses/format.js';
import { rendreMarkdown } from '../src/contexts/educourses/rendu.js';

const RACINE = join(import.meta.dirname, 'donnees/educourses');
const NIVEAUX = [
  'SIXIEME',
  'CINQUIEME',
  'QUATRIEME',
  'TROISIEME',
  'SECONDE',
  'PREMIERE',
  'TERMINALE',
];
const CONFIANCES = { officiel: 'OFFICIEL', recoupe: 'RECOUPE', reconstitue: 'RECONSTITUE' };

export const cleProgramme = (niveau, matiere, series = []) =>
  `${niveau}|${matiere}|${[...series].sort().join('+')}`;

function lireProgrammes(nomsMatieres) {
  const dossier = join(RACINE, 'programmes');
  return readdirSync(dossier)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => JSON.parse(readFileSync(join(dossier, f), 'utf8')))
    .map((p) => ({
      ...p,
      series: p.series ?? [],
      nomMatiere: p.nomMatiere ?? nomsMatieres[p.matiere] ?? p.matiere,
    }));
}

async function chargerProgramme(client, p, ordre) {
  const cle = cleProgramme(p.niveau, p.matiere, p.series);
  const existant = await client.ecProgramme.findUnique({ where: { cle } });
  if (existant?.estVerifie) return existant;
  const programme = await client.ecProgramme.upsert({
    where: { cle },
    update: {
      nomMatiere: p.nomMatiere,
      confiance: CONFIANCES[p.confiance] ?? 'RECONSTITUE',
      sources: p.sources ?? [],
      ordre,
    },
    create: {
      cle,
      niveau: p.niveau,
      series: p.series,
      matiereCode: p.matiere,
      nomMatiere: p.nomMatiere,
      confiance: CONFIANCES[p.confiance] ?? 'RECONSTITUE',
      sources: p.sources ?? [],
      ordre,
    },
  });
  for (const [i, c] of p.chapitres.entries()) {
    const chapitre = await client.ecChapitre.upsert({
      where: { programmeId_ordre: { programmeId: programme.id, ordre: i + 1 } },
      update: { titre: c.titre },
      create: { programmeId: programme.id, ordre: i + 1, titre: c.titre },
    });
    for (const [j, l] of c.lecons.entries()) {
      await client.ecLecon.upsert({
        where: { chapitreId_ordre: { chapitreId: chapitre.id, ordre: j + 1 } },
        update: { titre: l.titre, objectifs: l.objectifs ?? [] },
        create: {
          chapitreId: chapitre.id,
          ordre: j + 1,
          titre: l.titre,
          objectifs: l.objectifs ?? [],
        },
      });
    }
  }
  return programme;
}

/** Rédaction d'une leçon : HTML du cours, exercices et quiz. */
export function preparerLecon(texte) {
  const lecon = analyserLecon(texte);
  return {
    titre: lecon.titre,
    duree: lecon.duree,
    contenuHtml: rendreMarkdown(lecon.cours),
    exercices: lecon.exercices.map((e) => ({
      titre: e.titre,
      niveau: e.niveau,
      enonceHtml: rendreMarkdown(e.enonce),
      corrigeHtml: rendreMarkdown(e.corrige),
    })),
    quiz: lecon.quiz.map((q) => ({
      question: rendreMarkdown(q.question),
      choix: q.choix.map((c) => rendreMarkdown(c)),
      bonne: q.bonne,
      explication: q.explication ? rendreMarkdown(q.explication) : null,
    })),
  };
}

async function chargerLecons(client) {
  const dossierCours = join(RACINE, 'cours');
  if (!existsSync(dossierCours)) return { lecons: 0, erreurs: [] };
  let lecons = 0;
  const erreurs = [];
  for (const dossier of readdirSync(dossierCours).sort()) {
    const { niveau, matiere, series } = cleDossier(dossier);
    const programme = await client.ecProgramme.findUnique({
      where: { cle: cleProgramme(niveau, matiere, series) },
    });
    if (!programme) {
      erreurs.push(`${dossier} : aucun programme correspondant`);
      continue;
    }
    for (const nom of readdirSync(join(dossierCours, dossier)).filter((f) => f.endsWith('.md'))) {
      try {
        const { chapitre, lecon } = indicesFichier(nom);
        const texte = readFileSync(join(dossierCours, dossier, nom), 'utf8');
        const empreinte = createHash('sha256').update(texte).digest('hex');
        const cible = await client.ecLecon.findFirst({
          where: { ordre: lecon, chapitre: { programmeId: programme.id, ordre: chapitre } },
          select: { id: true, empreinte: true },
        });
        if (!cible) throw new Error('leçon absente du programme');
        lecons++;
        if (cible.empreinte === empreinte) continue;
        // Le titre fait foi dans le programme (JSON) : celui du fichier n'est qu'un repère
        const contenu = preparerLecon(texte);
        delete contenu.titre;
        await client.ecLecon.update({
          where: { id: cible.id },
          data: { ...contenu, empreinte, redigeeLe: new Date() },
        });
      } catch (erreur) {
        erreurs.push(`${dossier}/${nom} : ${erreur.message}`);
      }
    }
  }
  return { lecons, erreurs };
}

/** Charge tout le catalogue ; renvoie un résumé. */
export async function chargerEduCourses(client) {
  const matieres = await client.matiereReference.findMany({ select: { code: true, nom: true } });
  const noms = Object.fromEntries(matieres.map((m) => [m.code, m.nom]));
  const programmes = lireProgrammes(noms).filter((p) => NIVEAUX.includes(p.niveau));
  for (const [i, p] of programmes.entries()) await chargerProgramme(client, p, i);
  const { lecons, erreurs } = await chargerLecons(client);
  for (const e of erreurs) console.warn(`  EduCourses — ${e}`);
  return `${programmes.length} programmes, ${lecons} leçons rédigées`;
}
