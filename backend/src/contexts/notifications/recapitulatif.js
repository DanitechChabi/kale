// Récapitulatif mensuel des notes, envoyé par SMS aux parents.
//
// Au début de chaque mois (du 1er au 7), le serveur prépare pour chaque élève noté
// le mois précédent un SMS : moyenne des notes du mois par matière et moyenne de
// la période à ce jour. La clé « recap:<élève>:<mois> » garantit un seul SMS par
// élève et par mois, quel que soit le nombre de vérifications (redémarrages,
// service mis en veille puis réveillé, envoi manuel par la direction).
import { config } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { prismaPourEcole } from '../../db/isolation.js';
import { arrondir, surVingt } from '../notes/calcul.js';
import { resultatsClasse } from '../notes/serviceNotes.js';
import { messageRecapNotes } from './messages.js';
import { planifier } from './serviceNotifications.js';

/** « 2026-10 » → bornes du mois (dates UTC, colonnes DATE) */
function bornesMois(mois) {
  const [annee, numero] = mois.split('-').map(Number);
  return {
    debut: new Date(Date.UTC(annee, numero - 1, 1)),
    fin: new Date(Date.UTC(annee, numero, 0)),
  };
}

/** Mois précédant une date, au format « AAAA-MM ». */
export function moisPrecedent(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * Prépare les SMS d'un établissement pour un mois. `db` : client isolé.
 * Renvoie { eleves, smsEnFile }.
 */
export async function recapitulatifEtablissement(db, mois) {
  const ecole = await db.ecole.findFirst({ select: { smsRecapNotes: true } });
  if (!ecole.smsRecapNotes) return { eleves: 0, smsEnFile: 0 };
  const { debut, fin } = bornesMois(mois);

  const evaluations = await db.evaluation.findMany({
    where: { date: { gte: debut, lte: fin } },
    include: {
      notes: { where: { absent: false } },
      enseignement: {
        select: {
          classeId: true,
          matiere: {
            select: { nom: true, matiereReference: { select: { ordreAffichage: true } } },
          },
        },
      },
    },
    orderBy: { date: 'asc' },
  });
  if (!evaluations.length) return { eleves: 0, smsEnFile: 0 };

  // Notes du mois par élève et par matière, ramenées sur 20
  const parEleve = new Map(); // eleveId → { classeId, periodeId, matieres: Map(nom → { ordre, valeurs }) }
  for (const ev of evaluations) {
    for (const n of ev.notes) {
      const fiche = parEleve.get(n.eleveId) ?? {
        classeId: ev.enseignement.classeId,
        periodeId: ev.periodeId,
        matieres: new Map(),
      };
      fiche.periodeId = ev.periodeId; // période de la dernière évaluation du mois
      const nom = ev.enseignement.matiere.nom;
      const matiere = fiche.matieres.get(nom) ?? {
        ordre: ev.enseignement.matiere.matiereReference?.ordreAffichage ?? 999,
        valeurs: [],
      };
      matiere.valeurs.push(surVingt(n.valeur, ev.bareme));
      fiche.matieres.set(nom, matiere);
      parEleve.set(n.eleveId, fiche);
    }
  }

  // Moyenne de la période à ce jour : un calcul par classe et par période
  const resultats = new Map();
  const moyennePeriode = async (classeId, periodeId) => {
    const cle = `${classeId}|${periodeId}`;
    if (!resultats.has(cle)) resultats.set(cle, await resultatsClasse(db, classeId, periodeId));
    return resultats.get(cle);
  };

  const eleves = await db.eleve.findMany({
    where: { id: { in: [...parEleve.keys()] } },
    select: { id: true, nom: true, prenoms: true },
  });
  const evenements = [];
  for (const eleve of eleves) {
    const fiche = parEleve.get(eleve.id);
    const r = await moyennePeriode(fiche.classeId, fiche.periodeId);
    const matieres = [...fiche.matieres]
      .sort(([a, x], [b, y]) => x.ordre - y.ordre || a.localeCompare(b))
      .map(([matiere, { valeurs }]) => ({
        matiere,
        moyenne: arrondir(valeurs.reduce((s, v) => s + v, 0) / valeurs.length),
      }));
    evenements.push({
      eleveId: eleve.id,
      type: 'RECAP_NOTES',
      cle: `recap:${eleve.id}:${mois}`,
      message: messageRecapNotes({
        eleve,
        mois,
        matieres,
        periode: r.periode,
        moyenneGenerale: r.eleves.find((e) => e.id === eleve.id)?.moyenneGenerale ?? null,
        url: `${config.URL_PUBLIQUE_FRONTEND.replace(/\/$/, '')}/connexion`,
      }),
    });
  }
  return { eleves: evenements.length, smsEnFile: await planifier(db, evenements) };
}

/**
 * Tous les établissements vérifiés, pour le mois précédent, pendant les 7 premiers
 * jours du mois (rattrapage si le serveur était arrêté le 1er). Client global pour
 * lister les établissements ; chacun est ensuite traité avec son client isolé.
 */
export async function recapitulatifsAutomatiques(maintenant = new Date()) {
  if (maintenant.getUTCDate() > 7) return { etablissements: 0, smsEnFile: 0 };
  const mois = moisPrecedent(maintenant);
  const ecoles = await prisma.ecole.findMany({
    where: { statutVerification: 'VERIFIEE', actif: true, smsRecapNotes: true },
    select: { id: true },
  });
  let smsEnFile = 0;
  for (const { id } of ecoles) {
    try {
      smsEnFile += (await recapitulatifEtablissement(prismaPourEcole(id), mois)).smsEnFile;
    } catch (erreur) {
      console.error(`Récapitulatif ${mois} de l'établissement ${id} :`, erreur);
    }
  }
  return { etablissements: ecoles.length, mois, smsEnFile };
}

/** Vérification au démarrage puis toutes les 6 heures (sans effet hors du début de mois). */
export function planifierRecapitulatifs() {
  const verifier = () =>
    recapitulatifsAutomatiques().catch((erreur) => console.error('Récapitulatifs :', erreur));
  verifier();
  setInterval(verifier, 6 * 60 * 60 * 1000).unref();
}
