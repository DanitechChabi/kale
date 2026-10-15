// Fabriques partagées par les tests d'intégration.
import request from 'supertest';
import { creerApp } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { hacherMotDePasse } from '../../src/utils/motDePasse.js';

export { prisma };
export const app = creerApp();
export const MOT_DE_PASSE = 'Cotonou2026';

let compteur = 0;
export const unique = () => `${Date.now().toString(36)}${(++compteur).toString(36)}`;
const telephoneUnique = () => `+22901${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;

let hacheCommun;
const hacheMotDePasse = async () => (hacheCommun ??= await hacherMotDePasse(MOT_DE_PASSE));

export async function communeTest() {
  const departement = await prisma.departement.upsert({
    where: { code: 'AQ' },
    update: {},
    create: { code: 'AQ', nom: 'Atlantique' },
  });
  return prisma.commune.upsert({
    where: { departementId_nom: { departementId: departement.id, nom: 'Abomey-Calavi' } },
    update: {},
    create: { nom: 'Abomey-Calavi', departementId: departement.id },
  });
}

export async function creerEcole({ statutVerification = 'VERIFIEE', statut = 'PUBLIC' } = {}) {
  const commune = await communeTest();
  return prisma.ecole.create({
    data: {
      code: `T-${unique()}`.toUpperCase(),
      nom: `Établissement ${unique()}`,
      statut,
      type: 'LYCEE',
      ordres: ['GENERAL'],
      communeId: commune.id,
      statutVerification,
      motifDecision: ['REJETEE', 'SUSPENDUE'].includes(statutVerification) ? 'Motif de test' : null,
    },
  });
}

export async function creerCompte(
  role,
  { ecoleId = null, doitChangerMotDePasse = false, actif = true } = {},
) {
  return prisma.utilisateur.create({
    data: {
      role,
      ecoleId,
      nom: 'TEST',
      prenoms: role.toLowerCase(),
      email: `${role.toLowerCase()}.${unique()}@test.bj`,
      telephone: telephoneUnique(),
      motDePasseHash: await hacheMotDePasse(),
      doitChangerMotDePasse,
      actif,
    },
  });
}

export async function creerEleve(ecoleId) {
  return prisma.eleve.create({
    data: {
      ecoleId,
      matricule: unique(),
      nom: 'ELEVE',
      prenoms: `Test ${unique()}`,
      sexe: 'F',
      dateNaissance: new Date('2010-05-05'),
    },
  });
}

/** Connexion via l'API ; renvoie le jeton d'accès, le cookie de session et la réponse. */
export async function connecter(compte, motDePasse = MOT_DE_PASSE) {
  const reponse = await request(app)
    .post('/api/auth/connexion')
    .send({ identifiant: compte.email, motDePasse });
  return { jeton: reponse.body.jetonAcces, cookie: reponse.headers['set-cookie'], reponse };
}

export const avecJeton = (jeton) => ({ Authorization: `Bearer ${jeton}` });

// Fichiers minimaux reconnus par leur signature
export const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
export const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
