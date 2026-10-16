// Format des fichiers de leçon EduCourses (prisma/donnees/educourses/cours/).
//
// Un fichier par leçon : cours/<NIVEAU>-<MATIERE>[-<SERIES>]/<chapitre>-<leçon>.md
// (indices à deux chiffres, dans l'ordre du programme), par exemple
// cours/SIXIEME-MATH/02-05.md ou cours/TERMINALE-MATH-C/03-01.md.
//
//   ---
//   titre: Le cercle
//   duree: 45
//   ---
//   (cours en Markdown ; formules entre $…$ ou $$…$$)
//
//   === EXERCICES ===
//   ### Exercice 1 — facile
//   énoncé…
//   #### Corrigé
//   corrigé…
//
//   === QUIZ ===
//   ? Question
//   - mauvaise réponse
//   + bonne réponse (une seule)
//   - mauvaise réponse
//   > explication

export class ErreurFormat extends Error {}

/** « SIXIEME-MATH » ou « TERMINALE-MATH-C » → clé de programme « SIXIEME|MATH|C » */
export function cleDossier(dossier) {
  const [niveau, ...reste] = dossier.split('-');
  // Codes de matière avec tiret (LV2-ALL, SPE-G2-COMPTA) : la série est le dernier
  // segment seulement s'il ressemble à une série (A1, C, D, G2…)
  const serieProbable =
    reste.length > 1 &&
    /^(A1|A2|B|C|D|E|F[1-4]|G[1-3]|EA)(\+(A1|A2|B|C|D|E|F[1-4]|G[1-3]|EA))*$/.test(reste.at(-1));
  const series = serieProbable ? reste.pop().split('+') : [];
  return { niveau, matiere: reste.join('-'), series };
}

/** « 02-05.md » → { chapitre: 2, lecon: 5 } (base 1) */
export function indicesFichier(nom) {
  const m = /^(\d{2})-(\d{2})\.md$/.exec(nom);
  if (!m) throw new ErreurFormat(`Nom de fichier invalide : ${nom} (attendu CC-LL.md)`);
  return { chapitre: Number(m[1]), lecon: Number(m[2]) };
}

function lireEntete(texte) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(texte);
  if (!m) throw new ErreurFormat('En-tête --- titre / duree --- absent');
  const entete = Object.fromEntries(
    m[1]
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => {
        const i = l.indexOf(':');
        if (i < 0) throw new ErreurFormat(`Ligne d'en-tête invalide : ${l}`);
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
  if (!entete.titre) throw new ErreurFormat('En-tête : « titre » manquant');
  const duree = Number(entete.duree);
  if (!Number.isInteger(duree) || duree < 5 || duree > 240) {
    throw new ErreurFormat('En-tête : « duree » doit être un nombre de minutes (5 à 240)');
  }
  return { titre: entete.titre, duree, reste: texte.slice(m[0].length) };
}

function lireExercices(bloc) {
  const parties = bloc.split(/^### /m).slice(1);
  return parties.map((partie, i) => {
    const [entete, ...corps] = partie.split('\n');
    const texte = corps.join('\n');
    const [enonce, corrige] = texte.split(/^#### Corrigé\s*$/m);
    if (corrige === undefined || !enonce.trim() || !corrige.trim()) {
      throw new ErreurFormat(`Exercice ${i + 1} : énoncé et « #### Corrigé » obligatoires`);
    }
    const niveau =
      /—\s*(facile|moyen|approfondissement)\s*$/i.exec(entete)?.[1]?.toLowerCase() ?? 'moyen';
    return {
      titre: entete.replace(/\s*—.*$/, '').trim(),
      niveau,
      enonce: enonce.trim(),
      corrige: corrige.trim(),
    };
  });
}

function lireQuiz(bloc) {
  const questions = bloc
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return questions.map((q, i) => {
    const lignes = q.split('\n').map((l) => l.trim());
    if (!lignes[0].startsWith('? '))
      throw new ErreurFormat(`Quiz, question ${i + 1} : doit commencer par « ? »`);
    const choix = lignes
      .filter((l) => /^[+-] /.test(l))
      .map((l) => ({ texte: l.slice(2).trim(), juste: l[0] === '+' }));
    const bonnes = choix.filter((c) => c.juste).length;
    if (choix.length < 2 || bonnes !== 1) {
      throw new ErreurFormat(
        `Quiz, question ${i + 1} : au moins 2 choix et exactement une ligne « + »`,
      );
    }
    const explication = lignes
      .filter((l) => l.startsWith('> '))
      .map((l) => l.slice(2))
      .join(' ');
    return {
      question: lignes[0].slice(2).trim(),
      choix: choix.map((c) => c.texte),
      bonne: choix.findIndex((c) => c.juste),
      explication: explication || null,
    };
  });
}

/** Analyse un fichier de leçon ; lève ErreurFormat avec un message précis. */
export function analyserLecon(texte) {
  const normal = texte.replace(/\r\n/g, '\n');
  const { titre, duree, reste } = lireEntete(normal);
  const [cours, apresCours] = reste.split(/^=== EXERCICES ===\s*$/m);
  if (apresCours === undefined) throw new ErreurFormat('Section « === EXERCICES === » absente');
  const [exercicesBrut, quizBrut] = apresCours.split(/^=== QUIZ ===\s*$/m);
  if (quizBrut === undefined) throw new ErreurFormat('Section « === QUIZ === » absente');
  if (cours.trim().length < 400)
    throw new ErreurFormat('Cours trop court (moins de 400 caractères)');
  const exercices = lireExercices(exercicesBrut);
  if (exercices.length < 2) throw new ErreurFormat('Au moins 2 exercices corrigés');
  const quiz = lireQuiz(quizBrut);
  if (quiz.length < 3) throw new ErreurFormat('Au moins 3 questions de quiz');
  return { titre, duree, cours: cours.trim(), exercices, quiz };
}
