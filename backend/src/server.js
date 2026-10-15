// Démarrage du serveur HTTP.
import { config } from './config/env.js';
import { prisma } from './config/prisma.js';
import { creerApp } from './app.js';

const app = creerApp();

const serveur = app.listen(config.PORT, () => {
  console.log(`✅ API EduRelevé démarrée sur http://localhost:${config.PORT} (${config.NODE_ENV})`);
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
