// Démarrage du serveur HTTP.
import { config } from './config/env.js';
import { prisma } from './config/prisma.js';
import { creerApp } from './app.js';
import { reprendreEnvoisInterrompus } from './contexts/notifications/serviceNotifications.js';

const app = creerApp();

const serveur = app.listen(config.PORT, () => {
  console.log(`✅ API EduRelevé démarrée sur http://localhost:${config.PORT} (${config.NODE_ENV})`);
  // SMS restés en file (serveur arrêté pendant un envoi)
  reprendreEnvoisInterrompus().catch((erreur) => console.error('Reprise des SMS :', erreur));
});

// Arrêt propre : on ferme le serveur puis la connexion à la base
async function arreter(signal) {
  console.log(`\n${signal} reçu, arrêt en cours…`);
  serveur.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', arreter);
process.on('SIGTERM', arreter);
