// Détection des notes suspectes, présentée avant la clôture d'une période.
// Ce ne sont pas des erreurs : des signaux à vérifier avant de figer les notes.
import { arrondir, statistiques, surVingt } from './calcul.js';

export const SEUILS = {
  ecartPersonnel: 8, // points d'écart entre une note et les autres notes de l'élève dans la matière
  sautPeriode: 7, // points d'écart de moyenne matière avec la période précédente
  moyenneBasse: 5,
  moyenneHaute: 17,
  partIdentique: 0.8, // part de notes identiques dans une évaluation
  modificationsRepetees: 3,
};

/**
 * `evaluations` : [{ id, libelle, matiere, notes: [{ id, eleveId, valeur, bareme, absent }] }]
 * `moyennesPrecedentes` : Map(`${eleveId}|${matiere}` → moyenne de la période précédente)
 * `moyennesActuelles` : Map(`${eleveId}|${matiere}` → moyenne de la période)
 * `historiques` : Map(noteId → { modifications, apresFinPeriode })
 * `noms` : Map(eleveId → « NOM Prénoms »)
 */
export function detecterAnomalies({
  evaluations,
  moyennesPrecedentes = new Map(),
  moyennesActuelles = new Map(),
  historiques = new Map(),
  noms = new Map(),
}) {
  const anomalies = [];
  const nom = (id) => noms.get(id) ?? 'Élève';

  // 1. Évaluations atypiques (moyenne extrême, notes recopiées)
  for (const e of evaluations) {
    const valeurs = e.notes
      .filter((n) => !n.absent && n.valeur !== null)
      .map((n) => surVingt(n.valeur, n.bareme));
    if (valeurs.length < 5) continue;
    const { moyenne } = statistiques(valeurs);
    if (moyenne < SEUILS.moyenneBasse || moyenne > SEUILS.moyenneHaute) {
      anomalies.push({
        type: 'EVALUATION_ATYPIQUE',
        gravite: 'attention',
        matiere: e.matiere,
        evaluationId: e.id,
        message: `${e.matiere} · ${e.libelle} : moyenne de classe de ${moyenne.toFixed(2).replace('.', ',')}/20`,
      });
    }
    const frequences = new Map();
    for (const v of valeurs) frequences.set(v, (frequences.get(v) ?? 0) + 1);
    const [valeurFrequente, nombre] = [...frequences.entries()].sort((a, b) => b[1] - a[1])[0];
    if (nombre / valeurs.length >= SEUILS.partIdentique) {
      anomalies.push({
        type: 'NOTES_IDENTIQUES',
        gravite: 'attention',
        matiere: e.matiere,
        evaluationId: e.id,
        message: `${e.matiere} · ${e.libelle} : ${nombre} élèves sur ${valeurs.length} ont exactement ${String(arrondir(valeurFrequente)).replace('.', ',')}`,
      });
    }
  }

  // 2. Note très éloignée des autres notes de l'élève dans la même matière
  const parEleveMatiere = new Map();
  for (const e of evaluations) {
    for (const n of e.notes) {
      if (n.absent || n.valeur === null) continue;
      const cle = `${n.eleveId}|${e.matiere}`;
      if (!parEleveMatiere.has(cle)) parEleveMatiere.set(cle, []);
      parEleveMatiere
        .get(cle)
        .push({ note: n, evaluation: e, sur20: surVingt(n.valeur, n.bareme) });
    }
  }
  for (const [cle, liste] of parEleveMatiere) {
    if (liste.length < 3) continue;
    for (const element of liste) {
      const autres = liste.filter((x) => x !== element).map((x) => x.sur20);
      const reference = autres.reduce((s, v) => s + v, 0) / autres.length;
      if (Math.abs(element.sur20 - reference) >= SEUILS.ecartPersonnel) {
        const [eleveId, matiere] = cle.split('|');
        anomalies.push({
          type: 'ECART_PERSONNEL',
          gravite: 'info',
          eleveId,
          matiere,
          noteId: element.note.id,
          message: `${nom(eleveId)} · ${matiere} · ${element.evaluation.libelle} : ${String(arrondir(element.sur20)).replace('.', ',')} alors que ses autres notes tournent autour de ${String(arrondir(reference)).replace('.', ',')}`,
        });
      }
    }
  }

  // 3. Saut de moyenne par rapport à la période précédente
  for (const [cle, actuelle] of moyennesActuelles) {
    const precedente = moyennesPrecedentes.get(cle);
    if (actuelle === null || precedente === null || precedente === undefined) continue;
    if (Math.abs(actuelle - precedente) >= SEUILS.sautPeriode) {
      const [eleveId, matiere] = cle.split('|');
      anomalies.push({
        type: 'SAUT_PERIODE',
        gravite: 'attention',
        eleveId,
        matiere,
        message: `${nom(eleveId)} · ${matiere} : moyenne passée de ${String(precedente).replace('.', ',')} à ${String(actuelle).replace('.', ',')}`,
      });
    }
  }

  // 4. Notes modifiées plusieurs fois ou après la fin de la période
  for (const e of evaluations) {
    for (const n of e.notes) {
      const h = historiques.get(n.id);
      if (!h) continue;
      if (h.modifications >= SEUILS.modificationsRepetees || h.apresFinPeriode) {
        anomalies.push({
          type: 'MODIFICATION',
          gravite: 'attention',
          eleveId: n.eleveId,
          matiere: e.matiere,
          noteId: n.id,
          message: `${nom(n.eleveId)} · ${e.matiere} · ${e.libelle} : note modifiée ${h.modifications} fois${h.apresFinPeriode ? ', dont après la fin de la période' : ''}`,
        });
      }
    }
  }

  return anomalies;
}
