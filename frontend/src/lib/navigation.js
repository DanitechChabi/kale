// Page d'arrivée après connexion, selon le rôle et l'état du compte.
export function accueilSelonRole(utilisateur) {
  if (utilisateur.doitChangerMotDePasse) return '/espace/mot-de-passe';
  if (utilisateur.role === 'ADMIN_ECOLE' && utilisateur.ecole?.statutVerification !== 'VERIFIEE') {
    return '/espace/dossier';
  }
  if (utilisateur.role === 'MINISTERE') return '/espace/tableau-de-bord';
  if (utilisateur.role === 'SUPER_ADMIN') return '/espace/verification';
  return '/espace';
}

export const formaterTaille = (octets) =>
  octets < 1024 * 1024
    ? `${Math.max(1, Math.round(octets / 1024))} Ko`
    : `${(octets / 1024 / 1024).toFixed(1)} Mo`;

export const formaterDate = (date, avecHeure = false) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(avecHeure && { hour: '2-digit', minute: '2-digit' }),
  }).format(new Date(date));

/** « +2290197554433 » → « +229 01 97 55 44 33 » (les autres formats restent inchangés). */
export function formaterTelephone(numero) {
  const m = /^\+229(\d{10})$/.exec(numero ?? '');
  return m ? `+229 ${m[1].replace(/(\d{2})(?=\d)/g, '$1 ')}` : numero;
}
