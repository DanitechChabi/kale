// Normalisation des identifiants de connexion (e-mail ou téléphone).
import { z } from 'zod';

/**
 * Normalise un numéro béninois au format international « +229XXXXXXXXXX ».
 * - 10 chiffres commençant par 01 (format en vigueur depuis 2024) → +229 01…
 * - 8 chiffres (ancien format) → préfixe 01 ajouté
 * - 00229… ou +229… → +229…
 * Les autres numéros internationaux (+…) sont conservés tels quels.
 * Retourne null si le numéro est invalide.
 */
export function normaliserTelephone(brut) {
  if (typeof brut !== 'string') return null;
  let numero = brut.trim().replace(/[\s.\-()]/g, '');
  if (numero.startsWith('00')) numero = `+${numero.slice(2)}`;
  if (numero.startsWith('+229')) numero = numero.slice(4);
  else if (numero.startsWith('+')) return /^\+\d{8,15}$/.test(numero) ? numero : null;

  if (/^\d{8}$/.test(numero)) numero = `01${numero}`;
  return /^01\d{8}$/.test(numero) ? `+229${numero}` : null;
}

export const normaliserEmail = (email) => email.trim().toLowerCase();

/** Identifiant saisi à la connexion : e-mail ou numéro de téléphone. */
export function analyserIdentifiant(identifiant) {
  const valeur = identifiant.trim();
  if (valeur.includes('@')) return { email: normaliserEmail(valeur) };
  const telephone = normaliserTelephone(valeur);
  return telephone ? { telephone } : null;
}

export const schemaTelephone = z.string().transform((v, ctx) => {
  const numero = normaliserTelephone(v);
  if (!numero) {
    ctx.addIssue({ code: 'custom', message: 'Numéro de téléphone invalide' });
    return z.NEVER;
  }
  return numero;
});

export const schemaEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Adresse e-mail invalide').max(255));
