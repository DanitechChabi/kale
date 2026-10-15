// Écriture dans le journal d'audit (table en ajout seul).
// Avec un client isolé, ecoleId est imposé automatiquement : ne pas le passer.
export function journaliser(client, entree) {
  const {
    ecoleId,
    utilisateurId = null,
    action,
    entite,
    entiteId,
    avant,
    apres,
    adresseIp,
  } = entree;
  return client.journalAudit.create({
    data: {
      ...(ecoleId !== undefined && { ecoleId }),
      utilisateurId,
      action,
      entite,
      entiteId,
      ancienneValeur: avant ?? undefined,
      nouvelleValeur: apres ?? undefined,
      adresseIp: adresseIp ?? null,
    },
  });
}
