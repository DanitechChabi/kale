// Mise en page des bulletins et relevés (PDF A4, vectoriel, polices embarquées).
//
// Le PDF est produit une seule fois, à partir de l'instantané `donnees`, puis
// figé : son empreinte SHA-256 est enregistrée et publiée. Il n'est jamais régénéré.
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { formaterIdentifiantEleve } from '../../utils/identifiantEleve.js';
import { formaterNumero } from '../../utils/numeroDocument.js';
import { tracesRosace } from '../../utils/rosace.js';
import {
  LIBELLES_TYPES_ETABLISSEMENT,
  dateLongue,
  libelleCourtPeriode,
  libellePeriode,
  note,
  rang,
  titreDocument,
} from './contenu.js';

const police = (fichier) =>
  fileURLToPath(new URL(`../../../assets/polices/${fichier}`, import.meta.url));
const POLICES = {
  texte: police('schibsted-grotesk-latin-400-normal.ttf'),
  texteDemi: police('schibsted-grotesk-latin-600-normal.ttf'),
  texteGras: police('schibsted-grotesk-latin-700-normal.ttf'),
  chiffres: police('ibm-plex-mono-latin-400-normal.ttf'),
  chiffresGras: police('ibm-plex-mono-latin-600-normal.ttf'),
};

const COULEURS = {
  encre: '#0b2a1a',
  marque: '#065f33',
  marqueClair: '#d4ecdd',
  fond: '#f4f8f5',
  gris: '#5b6b61',
  grisClair: '#c9d4cc',
  reglure: '#c9dceb',
  rouge: '#c8102e',
  vert: '#008751',
  jaune: '#fcd116',
  sceau: '#a8820f',
};

const MARGE = 36;
const LARGEUR_PAGE = 595.28;
const LARGEUR = LARGEUR_PAGE - MARGE * 2;

/** Raccourcit un texte trop long pour sa colonne (« … » final). */
function tronquer(doc, texte, largeur) {
  if (!largeur || doc.widthOfString(texte) <= largeur) return texte;
  let fin = texte.length;
  while (fin > 1 && doc.widthOfString(`${texte.slice(0, fin).trimEnd()}…`) > largeur) fin--;
  return `${texte.slice(0, fin).trimEnd()}…`;
}

/** Écrit un texte sur une ligne (tronqué si `ellipsis`), sans retour automatique. */
function ecrire(
  doc,
  texte,
  x,
  y,
  { police: p = 'texte', taille = 9, couleur = COULEURS.encre, ellipsis, ...options } = {},
) {
  doc.font(p).fontSize(taille).fillColor(couleur);
  let contenu = String(texte ?? '');
  if (ellipsis && !options.lineBreak) contenu = tronquer(doc, contenu, options.width);
  doc.text(contenu, x, y, { lineBreak: false, ...options });
}

/** « +2290121304050 » → « +229 01 21 30 40 50 » */
const telephoneLisible = (numero) => {
  const m = /^\+229(\d{10})$/.exec(numero ?? '');
  return m ? `+229 ${m[1].replace(/(\d{2})(?=\d)/g, '$1 ')}` : numero;
};

/** Bande guillochée (sinusoïdes déphasées), comme sur les diplômes. */
function bandeGuillochee(doc, x, y, largeur, hauteur, couleur) {
  doc.save().lineWidth(0.35).strokeColor(couleur).opacity(0.55);
  const lignes = 9;
  for (let i = 0; i < lignes; i++) {
    const phase = (i / lignes) * Math.PI * 2;
    for (let k = 0; k <= largeur; k += 3) {
      const yy =
        y +
        hauteur / 2 +
        hauteur * 0.32 * Math.sin((k / (largeur / 3.2)) * Math.PI * 2 + phase) +
        hauteur * 0.12 * Math.sin((k / (largeur / 7.5)) * Math.PI * 2 - phase * 2);
      if (k === 0) doc.moveTo(x + k, yy);
      else doc.lineTo(x + k, yy);
    }
    doc.stroke();
  }
  doc.restore();
}

/** Rosace propre au document (même tracé que sur la page de vérification). */
function rosace(doc, numero, x, y, taille) {
  doc.save().lineWidth(0.3).strokeColor(COULEURS.marque);
  for (const points of tracesRosace(numero, taille / 2, 240)) {
    points.forEach(([px, py], i) => (i ? doc.lineTo(x + px, y + py) : doc.moveTo(x + px, y + py)));
    doc.closePath().stroke();
  }
  doc.restore();
}

/** QR code vectoriel (net à toute taille d'impression). */
function qrCode(doc, texte, x, y, taille) {
  const { modules } = QRCode.create(texte, { errorCorrectionLevel: 'M' });
  const cote = taille / modules.size;
  doc.save().fillColor(COULEURS.encre);
  for (let ligne = 0; ligne < modules.size; ligne++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(ligne, col)) doc.rect(x + col * cote, y + ligne * cote, cote, cote);
    }
  }
  doc.fill().restore();
}

/** Petit drapeau du Bénin (vert, jaune, rouge). */
function drapeau(doc, x, y, h) {
  const l = h * 1.5;
  doc.save();
  doc.rect(x, y, l * 0.4, h).fill(COULEURS.vert);
  doc.rect(x + l * 0.4, y, l * 0.6, h / 2).fill(COULEURS.jaune);
  doc.rect(x + l * 0.4, y + h / 2, l * 0.6, h / 2).fill(COULEURS.rouge);
  doc.restore();
}

function enTete(doc, d) {
  const e = d.etablissement;
  let y = MARGE;
  drapeau(doc, MARGE, y + 1, 12);
  ecrire(doc, 'RÉPUBLIQUE DU BÉNIN', MARGE + 24, y, { police: 'texteGras', taille: 9 });
  ecrire(doc, 'Fraternité – Justice – Travail', MARGE + 24, y + 11, {
    taille: 7.5,
    couleur: COULEURS.gris,
  });
  ecrire(
    doc,
    'Ministère des Enseignements Secondaire, Technique et de la Formation Professionnelle',
    MARGE,
    y + 26,
    { taille: 7, couleur: COULEURS.gris, width: 250 },
  );

  const xDroite = MARGE + LARGEUR / 2 + 10;
  const largeurDroite = LARGEUR / 2 - 10;
  ecrire(doc, e.nom, xDroite, y, {
    police: 'texteGras',
    taille: 10.5,
    width: largeurDroite,
    align: 'right',
    lineBreak: true,
    height: 28,
    ellipsis: true,
  });
  const lignes = [
    `${LIBELLES_TYPES_ETABLISSEMENT[e.type] ?? ''} ${e.statut === 'PRIVE' ? 'privé' : 'public'}`.trim(),
    [e.commune, e.departement].filter(Boolean).join(' · '),
    [e.code && `Code ${e.code}`, e.telephone && `Tél. ${telephoneLisible(e.telephone)}`]
      .filter(Boolean)
      .join(' · '),
  ].filter(Boolean);
  const yLignes = doc.y + 1;
  lignes.forEach((l, i) =>
    ecrire(doc, l, xDroite, yLignes + i * 10, {
      taille: 7.5,
      couleur: COULEURS.gris,
      width: largeurDroite,
      align: 'right',
    }),
  );

  y = Math.max(MARGE + 46, yLignes + lignes.length * 10) + 8;
  bandeGuillochee(doc, MARGE, y, LARGEUR, 30, COULEURS.marque);
  // Titre posé sur la bande, sur un cartouche blanc
  const titre = (
    d.type === 'BULLETIN_PERIODE' ? 'Bulletin de notes' : 'Relevé de notes annuel'
  ).toUpperCase();
  doc.font('texteGras').fontSize(13);
  const largeurTitre = doc.widthOfString(titre) + 28;
  doc.rect(MARGE + (LARGEUR - largeurTitre) / 2, y + 4, largeurTitre, 22).fill('#ffffff');
  ecrire(doc, titre, MARGE, y + 9, {
    police: 'texteGras',
    taille: 13,
    width: LARGEUR,
    align: 'center',
    characterSpacing: 0.6,
  });
  const sousTitre = [d.periode && libellePeriode(d.periode), `Année scolaire ${d.anneeScolaire}`];
  ecrire(doc, sousTitre.filter(Boolean).join(' · '), MARGE, y + 33, {
    police: 'texteDemi',
    taille: 9,
    couleur: COULEURS.marque,
    width: LARGEUR,
    align: 'center',
  });
  return y + 50;
}

function identite(doc, d, y) {
  const el = d.eleve;
  const c = d.classe;
  const hauteur = 58;
  doc.save().rect(MARGE, y, LARGEUR, hauteur).fill(COULEURS.fond).restore();
  // Marge rouge du cahier
  doc.save().rect(MARGE, y, 2, hauteur).fill(COULEURS.rouge).restore();

  const champ = (libelle, valeur, x, yy, { mono = false, largeur = 160 } = {}) => {
    ecrire(doc, libelle.toUpperCase(), x, yy, {
      police: 'texteDemi',
      taille: 6,
      couleur: COULEURS.gris,
      characterSpacing: 0.5,
    });
    ecrire(doc, valeur, x, yy + 8, {
      police: mono ? 'chiffres' : 'texteDemi',
      taille: 9,
      width: largeur,
      ellipsis: true,
    });
  };

  const x1 = MARGE + 12;
  const x2 = MARGE + 222;
  const x3 = MARGE + 330;
  const x4 = MARGE + 430;
  ecrire(doc, 'ÉLÈVE', x1, y + 7, {
    police: 'texteDemi',
    taille: 6,
    couleur: COULEURS.gris,
    characterSpacing: 0.5,
  });
  ecrire(doc, el.nom, x1, y + 15, { police: 'texteGras', taille: 12, width: 200, ellipsis: true });
  ecrire(doc, el.prenoms, x1, y + 29, {
    police: 'texteDemi',
    taille: 10,
    width: 200,
    ellipsis: true,
  });
  const naissance = `${el.sexe === 'F' ? 'Née' : 'Né'} le ${dateLongue(el.dateNaissance)}${
    el.lieuNaissance ? ` à ${el.lieuNaissance}` : ''
  }`;
  ecrire(doc, naissance, x1, y + 43, {
    taille: 7.5,
    couleur: COULEURS.gris,
    width: 205,
    ellipsis: true,
  });

  champ('Classe', `${c.nom}${c.serie ? ` · série ${c.serie}` : ''}`, x2, y + 7, { largeur: 100 });
  champ('Effectif', `${c.effectif} élèves`, x2, y + 31, { largeur: 100 });
  champ('Matricule', el.matricule, x3, y + 7, { mono: true, largeur: 95 });
  champ('Redoublant', c.redoublant ? 'Oui' : 'Non', x3, y + 31, { largeur: 95 });
  champ('Identifiant EduRelevé', formaterIdentifiantEleve(el.identifiant), x4, y + 7, {
    mono: true,
    largeur: 95,
  });
  if (el.npi) champ('NPI', el.npi, x4, y + 31, { mono: true, largeur: 95 });
  return y + hauteur + 12;
}

/** Colonnes du tableau selon le type de document. */
function colonnes(d) {
  if (d.type === 'BULLETIN_PERIODE') {
    const cols = [
      { titre: 'Matière', largeur: 132, valeur: (m) => m.matiere, police: 'texteDemi' },
      { titre: 'Coef.', largeur: 30, valeur: (m) => m.coefficient, droite: true, mono: true },
      {
        titre: 'Interr.',
        largeur: 44,
        valeur: (m) => note(m.moyenneInterrogations),
        droite: true,
        mono: true,
      },
      {
        titre: 'Devoirs',
        largeur: 68,
        valeur: (m) => m.devoirs.map((v) => note(v)).join('  ') || '–',
        droite: true,
        mono: true,
      },
      {
        titre: 'Moy./20',
        largeur: 44,
        valeur: (m) => note(m.moyenne),
        droite: true,
        mono: true,
        gras: true,
      },
      { titre: 'Points', largeur: 44, valeur: (m) => note(m.points), droite: true, mono: true },
      { titre: 'Rang', largeur: 38, valeur: (m) => rang(m.rang), droite: true, mono: true },
      { titre: 'Appréciation', largeur: 63, valeur: (m) => m.appreciation },
      { titre: 'Professeur', largeur: 60, valeur: (m) => m.enseignant ?? '', petit: true },
    ];
    // Sans enseignant désigné, la colonne « Professeur » laisse sa place aux noms de matières
    if (d.matieres.some((m) => m.enseignant)) return cols;
    cols[0].largeur += cols.pop().largeur;
    return cols;
  }
  return [
    { titre: 'Matière', largeur: 130, valeur: (m) => m.matiere, police: 'texteDemi' },
    { titre: 'Coef.', largeur: 32, valeur: (m) => m.coefficient, droite: true, mono: true },
    ...d.periodes.map((p, i) => ({
      titre: libelleCourtPeriode(p),
      largeur: 42,
      valeur: (m) => note(m.moyennesPeriodes[i]),
      droite: true,
      mono: true,
    })),
    {
      titre: 'Moy. ann.',
      largeur: 50,
      valeur: (m) => note(m.moyenne),
      droite: true,
      mono: true,
      gras: true,
    },
    { titre: 'Points', largeur: 48, valeur: (m) => note(m.points), droite: true, mono: true },
    { titre: 'Rang', largeur: 42, valeur: (m) => rang(m.rang), droite: true, mono: true },
    { titre: 'Appréciation', largeur: 0, valeur: (m) => m.appreciation },
  ];
}

function tableau(doc, d, y) {
  const cols = colonnes(d);
  const fixe = cols.reduce((s, c) => s + c.largeur, 0);
  const reste = cols.find((c) => c.largeur === 0);
  if (reste) reste.largeur = LARGEUR - fixe;
  const hauteurLigne = d.matieres.length > 16 ? 14 : 16;

  // En-tête du registre : filet épais
  let x = MARGE;
  for (const c of cols) {
    ecrire(doc, c.titre.toUpperCase(), x + 4, y, {
      police: 'texteDemi',
      taille: 6.2,
      couleur: COULEURS.gris,
      width: c.largeur - 8,
      align: c.droite ? 'right' : 'left',
      characterSpacing: 0.3,
    });
    x += c.largeur;
  }
  y += 11;
  doc
    .save()
    .lineWidth(1.2)
    .strokeColor(COULEURS.encre)
    .moveTo(MARGE, y)
    .lineTo(MARGE + LARGEUR, y)
    .stroke()
    .restore();

  d.matieres.forEach((m, i) => {
    const yy = y + i * hauteurLigne;
    if (i % 2 === 1)
      doc.save().rect(MARGE, yy, LARGEUR, hauteurLigne).fill(COULEURS.fond).restore();
    let xx = MARGE;
    for (const c of cols) {
      const insuffisant = c.gras && m.moyenne !== null && m.moyenne < 10;
      ecrire(doc, c.valeur(m), xx + 4, yy + (hauteurLigne - 9) / 2 + 1, {
        police: c.mono ? (c.gras ? 'chiffresGras' : 'chiffres') : (c.police ?? 'texte'),
        taille: c.petit ? 6.8 : c.mono ? 8 : 8.2,
        couleur: insuffisant ? COULEURS.rouge : c.petit ? COULEURS.gris : COULEURS.encre,
        width: c.largeur - 8,
        align: c.droite ? 'right' : 'left',
        ellipsis: true,
      });
      xx += c.largeur;
    }
    if (m.estFacultative) {
      ecrire(
        doc,
        'facultative',
        MARGE + 4 + doc.font('texteDemi').fontSize(8.2).widthOfString(m.matiere) + 4,
        yy + (hauteurLigne - 9) / 2 + 2,
        {
          taille: 6,
          couleur: COULEURS.sceau,
        },
      );
    }
    doc
      .save()
      .lineWidth(0.4)
      .strokeColor(COULEURS.reglure)
      .moveTo(MARGE, yy + hauteurLigne)
      .lineTo(MARGE + LARGEUR, yy + hauteurLigne)
      .stroke()
      .restore();
  });

  // Totaux
  y += d.matieres.length * hauteurLigne;
  doc
    .save()
    .lineWidth(1.2)
    .strokeColor(COULEURS.encre)
    .moveTo(MARGE, y)
    .lineTo(MARGE + LARGEUR, y)
    .stroke()
    .restore();
  const r = d.resultats;
  ecrire(doc, 'TOTAUX', MARGE + 4, y + 5, { police: 'texteGras', taille: 7.5 });
  ecrire(doc, r.totalCoefficients, MARGE + cols[0].largeur + 4, y + 5, {
    police: 'chiffresGras',
    taille: 8,
    width: cols[1].largeur - 8,
    align: 'right',
  });
  const iPoints = cols.findIndex((c) => c.titre === 'Points');
  const xPoints = MARGE + cols.slice(0, iPoints).reduce((s, c) => s + c.largeur, 0);
  ecrire(doc, note(r.totalPoints), xPoints + 4, y + 5, {
    police: 'chiffresGras',
    taille: 8,
    width: cols[iPoints].largeur - 8,
    align: 'right',
  });
  return y + 24;
}

function resultats(doc, d, y) {
  const r = d.resultats;
  const hauteur = 86;
  const largeurGauche = 200;

  // Moyenne générale, en grand
  doc
    .save()
    .rect(MARGE, y, largeurGauche, hauteur)
    .lineWidth(1)
    .strokeColor(COULEURS.encre)
    .stroke()
    .restore();
  ecrire(
    doc,
    d.type === 'BULLETIN_PERIODE' ? 'MOYENNE GÉNÉRALE' : 'MOYENNE ANNUELLE',
    MARGE + 12,
    y + 10,
    {
      police: 'texteDemi',
      taille: 6.5,
      couleur: COULEURS.gris,
      characterSpacing: 0.5,
    },
  );
  ecrire(doc, note(r.moyenneGenerale), MARGE + 12, y + 20, {
    police: 'chiffresGras',
    taille: 28,
    couleur: r.moyenneGenerale !== null && r.moyenneGenerale < 10 ? COULEURS.rouge : COULEURS.encre,
  });
  ecrire(
    doc,
    '/ 20',
    MARGE + 12 + doc.font('chiffresGras').fontSize(28).widthOfString(note(r.moyenneGenerale)) + 4,
    y + 35,
    {
      police: 'chiffres',
      taille: 9,
      couleur: COULEURS.gris,
    },
  );
  ecrire(doc, `Rang : ${rang(r.rang, r.exAequo)} sur ${r.classes}`, MARGE + 12, y + 56, {
    police: 'texteDemi',
    taille: 9,
  });
  if (r.distinction) {
    ecrire(doc, r.distinction, MARGE + 12, y + 69, {
      police: 'texteGras',
      taille: 8.5,
      couleur: COULEURS.sceau,
    });
  }

  // Statistiques de la classe et assiduité
  const x = MARGE + largeurGauche + 14;
  const lignes = [
    ['Moyenne de la classe', note(r.moyenneClasse)],
    ['Plus forte moyenne', note(r.plusForte)],
    ['Plus faible moyenne', note(r.plusFaible)],
  ];
  if (d.type === 'RELEVE_ANNUEL') {
    for (const p of r.periodes) {
      lignes.push([
        `Moyenne ${libelleCourtPeriode(p)}`,
        `${note(p.moyenne)} (${rang(p.rang)}${p.exAequo ? ' éq.' : ''})`,
      ]);
    }
  }
  if (d.absences) {
    lignes.push([
      'Absences (dont non justifiées)',
      `${d.absences.absences} (${d.absences.nonJustifiees})`,
    ]);
    if (d.absences.retards) lignes.push(['Retards', String(d.absences.retards)]);
  }
  lignes.slice(0, 8).forEach(([libelle, valeur], i) => {
    const yy = y + 4 + i * 11;
    ecrire(doc, libelle, x, yy, {
      taille: 7.8,
      couleur: COULEURS.gris,
      width: 112,
      ellipsis: true,
    });
    ecrire(doc, valeur, x + 112, yy, {
      police: 'chiffres',
      taille: 7.8,
      width: 76,
      align: 'right',
      ellipsis: true,
    });
  });

  // Visa
  const xVisa = MARGE + LARGEUR - 118;
  ecrire(doc, 'LE CHEF D’ÉTABLISSEMENT', xVisa, y + 4, {
    police: 'texteDemi',
    taille: 6.5,
    couleur: COULEURS.gris,
    width: 118,
    align: 'center',
    characterSpacing: 0.4,
  });
  if (d.etablissement.chef) {
    ecrire(doc, d.etablissement.chef, xVisa, y + 70, {
      police: 'texteDemi',
      taille: 8,
      width: 118,
      align: 'center',
      ellipsis: true,
    });
  }
  return y + hauteur + 14;
}

/** Cadre réglé (lignes du cahier, marge rouge) pour les observations manuscrites. */
function observations(doc, y) {
  const lignes = 3;
  const pas = 18;
  const hauteur = 16 + lignes * pas;
  if (y + hauteur > 842 - MARGE - 110) return y; // place réservée au bloc d'authentification
  ecrire(doc, 'OBSERVATIONS DU CONSEIL DE CLASSE', MARGE, y, {
    police: 'texteDemi',
    taille: 6.5,
    couleur: COULEURS.gris,
    characterSpacing: 0.5,
  });
  doc.save().lineWidth(0.5).strokeColor(COULEURS.reglure);
  for (let i = 1; i <= lignes; i++) {
    doc.moveTo(MARGE, y + 8 + i * pas).lineTo(MARGE + LARGEUR, y + 8 + i * pas);
  }
  doc.stroke().restore();
  doc.save().lineWidth(0.6).strokeColor(COULEURS.rouge).opacity(0.6);
  doc
    .moveTo(MARGE + 22, y + 12)
    .lineTo(MARGE + 22, y + hauteur)
    .stroke()
    .restore();
  return y + hauteur + 10;
}

function authentification(doc, d, y, urlVerification) {
  const hauteur = 104;
  const yBas = Math.max(y, 842 - MARGE - hauteur);
  doc
    .save()
    .lineWidth(0.5)
    .strokeColor(COULEURS.grisClair)
    .moveTo(MARGE, yBas)
    .lineTo(MARGE + LARGEUR, yBas)
    .stroke()
    .restore();
  const yy = yBas + 10;

  qrCode(doc, urlVerification, MARGE, yy, 84);
  rosace(doc, d.numero, MARGE + 96, yy, 84);

  const x = MARGE + 196;
  const largeur = LARGEUR - 196;
  ecrire(doc, 'DOCUMENT ARCHIVÉ N°', x, yy, {
    police: 'texteDemi',
    taille: 6.5,
    couleur: COULEURS.gris,
    characterSpacing: 0.5,
  });
  ecrire(doc, formaterNumero(d.numero), x, yy + 9, {
    police: 'chiffresGras',
    taille: 15,
    characterSpacing: 0.5,
  });
  ecrire(
    doc,
    `Délivré le ${dateLongue(d.delivrance.le)}${d.delivrance.par ? ` par ${d.delivrance.par}` : ''}.`,
    x,
    yy + 30,
    { taille: 7.5, couleur: COULEURS.gris, width: largeur },
  );
  doc.font('texte').fontSize(7.5).fillColor(COULEURS.encre);
  doc.text(
    `Authenticité vérifiable sans compte : scannez le code ou ouvrez ${urlVerification.replace(/^https?:\/\//, '')}. ` +
      'L’archive conserve l’empreinte numérique de ce fichier ; toute modification le rend non conforme. ' +
      'La rosace est propre à ce document et s’affiche à l’identique lors de la vérification.',
    x,
    yy + 42,
    { width: largeur, lineGap: 1 },
  );
  if (d.remplace) {
    ecrire(
      doc,
      `Remplace le document n° ${formaterNumero(d.remplace.numero)} — ${d.remplace.motif}`,
      x,
      yy + 82,
      {
        police: 'texteDemi',
        taille: 7.2,
        couleur: COULEURS.rouge,
        width: largeur,
        ellipsis: true,
      },
    );
  }
}

/** Produit le PDF d'un document à partir de son instantané ; renvoie un Buffer. */
export function rendrePdf(donnees, { urlVerification }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGE,
      info: {
        Title: `${titreDocument(donnees)} — ${donnees.eleve.nom} ${donnees.eleve.prenoms}`,
        Author: donnees.etablissement.nom,
        Subject: `Document archivé n° ${formaterNumero(donnees.numero)}`,
        Creator: 'EduRelevé',
        Producer: 'EduRelevé',
      },
      lang: 'fr-FR',
    });
    for (const [nom, fichier] of Object.entries(POLICES)) doc.registerFont(nom, fichier);
    const morceaux = [];
    doc.on('data', (m) => morceaux.push(m));
    doc.on('end', () => resolve(Buffer.concat(morceaux)));
    doc.on('error', reject);

    let y = enTete(doc, donnees);
    y = identite(doc, donnees, y);
    y = tableau(doc, donnees, y);
    y = resultats(doc, donnees, y);
    y = observations(doc, y);
    authentification(doc, donnees, y, urlVerification);
    doc.end();
  });
}
