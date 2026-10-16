// Tableau de bord du ministère : /api/ministere (MINISTERE, SUPER_ADMIN), lecture seule.
import { Router } from 'express';
import { z } from 'zod';
import { tableauDeBord } from '../contexts/ministere/serviceTableauDeBord.js';
import {
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import { valider } from '../middlewares/valider.js';

export const routeurMinistere = Router();
routeurMinistere.use(
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole('SUPER_ADMIN', 'MINISTERE'),
);

const schemaFiltres = z.object({
  annee: z
    .string()
    .regex(/^\d{4}-\d{4}$/, 'Format attendu : 2026-2027')
    .optional(),
  departementId: z.uuid().optional(),
  communeId: z.uuid().optional(),
  ecoleId: z.uuid().optional(),
});

routeurMinistere.get('/tableau-de-bord', valider({ query: schemaFiltres }), async (req, res) => {
  res.json(await tableauDeBord(req.valide.query));
});

// Colonnes de l'export (détail de la zone : départements, communes ou établissements)
const COLONNES = [
  ['Zone', (l) => l.nom],
  ['Établissements vérifiés', (l) => l.etablissements],
  ['Effectif', (l) => l.effectif],
  ['Part de filles (%)', (l) => l.partFilles],
  ['Élèves évalués', (l) => l.elevesEvalues],
  ['Moyenne générale', (l) => l.moyenneGenerale],
  ['Taux de réussite (%)', (l) => l.tauxReussite],
  ['Taux d’absence (%)', (l) => l.tauxAbsence],
  ['Documents délivrés', (l) => l.documentsDelivres],
  ['Délai bulletin après clôture (jours)', (l) => l.delaiBulletinJours],
  ['Duplicatas demandés', (l) => l.duplicatas.demandes],
  ['Duplicatas délivrés', (l) => l.duplicatas.delivres],
  ['Délai moyen duplicata (heures)', (l) => l.duplicatas.delaiMoyenHeures],
];

// Marque d'ordre des octets : le tableur reconnaît l'UTF-8 (accents)
const BOM = '\uFEFF';

/** Cellule CSV (séparateur « ; », virgule décimale : ouverture directe dans un tableur français). */
function cellule(valeur) {
  if (valeur === null || valeur === undefined) return '';
  if (typeof valeur === 'number') return String(valeur).replace('.', ',');
  const texte = String(valeur);
  // Neutralise les formules (=, +, -, @) et protège les guillemets
  const sur = /^[=+\-@]/.test(texte) ? `'${texte}` : texte;
  return /[;"\n]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur;
}

routeurMinistere.get(
  '/tableau-de-bord.csv',
  valider({ query: schemaFiltres }),
  async (req, res) => {
    const tableau = await tableauDeBord(req.valide.query);
    const lignes = [
      ...(tableau.detail.length
        ? tableau.detail
        : [{ ...tableau.synthese, nom: tableau.zone.nom }]),
    ];
    const csv = [
      COLONNES.map(([titre]) => cellule(titre)).join(';'),
      ...lignes.map((l) => COLONNES.map(([, valeur]) => cellule(valeur(l))).join(';')),
    ].join('\r\n');
    const nom = `edureleve-${tableau.annee ?? 'annee'}-${tableau.zone.nom}`
      .normalize('NFD')
      .replace(/[^\w-]+/g, '-')
      .toLowerCase();
    res
      .set('Content-Type', 'text/csv; charset=utf-8')
      .set('Content-Disposition', `attachment; filename="${nom}.csv"`)
      .send(`${BOM}${csv}`);
  },
);
