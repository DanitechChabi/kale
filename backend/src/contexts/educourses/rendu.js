// Rendu des leçons : Markdown → HTML, formules LaTeX → KaTeX (côté serveur).
//
// Les formules ($…$ en ligne, $$…$$ centrées) sont mises de côté avant le Markdown,
// le HTML produit est nettoyé (liste blanche), puis les formules rendues par KaTeX
// (sans commandes « de confiance » : pas de liens ni de HTML arbitraire) sont
// réinsérées. Le navigateur n'a besoin que de la feuille de style de KaTeX.
import katex from 'katex';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const BALISES = [
  ...sanitizeHtml.defaults.allowedTags.filter((b) => b !== 'a'),
  'h2',
  'h3',
  'h4',
  'del',
  'sup',
  'sub',
];

function extraireFormules(markdown) {
  const formules = [];
  const marque = (tex, bloc) => {
    formules.push({ tex: tex.trim(), bloc });
    return `@@FORMULE${formules.length - 1}@@`;
  };
  const texte = markdown
    // Formules centrées $$…$$ (éventuellement sur plusieurs lignes)
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => `\n\n${marque(tex, true)}\n\n`)
    // Formules en ligne $…$ (pas de $ isolé, pas de retour à la ligne)
    .replace(/\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g, (_, tex) => marque(tex, false));
  return { texte, formules };
}

/** Markdown d'une leçon → HTML sûr, formules comprises. */
export function rendreMarkdown(markdown) {
  const { texte, formules } = extraireFormules(markdown);
  const html = sanitizeHtml(marked.parse(texte, { gfm: true, breaks: false }), {
    allowedTags: BALISES,
    allowedAttributes: { th: ['align'], td: ['align'] },
  });
  return html.replace(/(<p>)?@@FORMULE(\d+)@@(<\/p>)?/g, (tout, ouvre, n, ferme) => {
    const { tex, bloc } = formules[Number(n)];
    const rendu = katex.renderToString(tex, {
      displayMode: bloc,
      throwOnError: false,
      output: 'html',
      trust: false,
      strict: 'ignore',
    });
    if (bloc) return `<div class="formule">${rendu}</div>`;
    return `${ouvre ?? ''}${rendu}${ferme ?? ''}`;
  });
}
