// Fournisseurs d'envoi de SMS.
//
// Un fournisseur est un objet { nom, envoyer({ telephone, message }) } ; `envoyer`
// renvoie { idExterne } ou lève une erreur (le message sera retenté). Pour brancher
// un opérateur ou un agrégateur (MTN, Moov, Africa's Talking…), il suffit d'ajouter
// ici un fournisseur qui appelle son API, puis de l'autoriser dans SMS_FOURNISSEUR
// (config/env.js) ; le reste de l'application ne change pas.
import { randomUUID } from 'node:crypto';
import { config } from '../../config/env.js';

/** Enregistre le message sans l'envoyer (développement, ou avant contrat opérateur). */
const journal = {
  nom: 'journal',
  async envoyer({ telephone, message }) {
    if (!config.estTest) console.log(`[SMS → ${telephone}] ${message}`);
    return { idExterne: `journal-${randomUUID()}` };
  },
};

const FOURNISSEURS = { journal };

let remplacement = null;

/** Fournisseur actif (les tests peuvent en substituer un). */
export const fournisseurSms = () => remplacement ?? FOURNISSEURS[config.SMS_FOURNISSEUR];

/** Réservé aux tests : remplace le fournisseur (null pour revenir à la configuration). */
export function remplacerFournisseurSms(fournisseur) {
  remplacement = fournisseur;
}
