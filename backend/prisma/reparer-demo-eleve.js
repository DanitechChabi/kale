// Réparation ciblée du compte élève de démonstration (SENAH-6EA2Q).
//
// Utile si le chargement complet de la démonstration a été interrompu (instance
// gratuite) : les établissements et la plupart des comptes existent, mais le compte
// de connexion de l'élève, créé en fin de seed, manque. Cette réparation est légère
// et idempotente : elle ne fait rien si l'identifiant existe déjà, et ne touche à
// aucun document archivé. Elle attache un compte ELEVE à une élève existante de
// l'établissement de démonstration (une fille sans compte, de préférence ayant déjà
// des relevés archivés pour que son espace « Mes bulletins » soit garni).
import { caractereControle } from '../src/utils/identifiantEleve.js';
import { hacherMotDePasse } from '../src/utils/motDePasse.js';

const CODE_ECOLE_DEMO = 'DEMO-CEG-COCOTIERS';
const IDENTIFIANT_CORPS = 'SENAH6EA2';
const MOT_DE_PASSE = 'EduReleve2026';

export async function reparerEleveDemo(prisma, { journal = console.log } = {}) {
  const identifiant = IDENTIFIANT_CORPS + caractereControle(IDENTIFIANT_CORPS);

  if (await prisma.eleve.findUnique({ where: { identifiant }, select: { id: true } })) {
    journal(`Compte élève de démonstration déjà présent (${identifiant}).`);
    return false;
  }

  const ecole = await prisma.ecole.findUnique({
    where: { code: CODE_ECOLE_DEMO },
    select: { id: true },
  });
  if (!ecole) {
    journal('Établissement de démonstration absent : réparation élève ignorée.');
    return false;
  }

  // Une élève sans compte, avec des relevés archivés de préférence (espace garni)
  const base = { ecoleId: ecole.id, utilisateurId: null, sexe: 'F' };
  const candidate =
    (await prisma.eleve.findFirst({
      where: { ...base, relevesArchives: { some: {} } },
      orderBy: { creeLe: 'asc' },
      select: { id: true },
    })) ??
    (await prisma.eleve.findFirst({
      where: base,
      orderBy: { creeLe: 'asc' },
      select: { id: true },
    }));
  if (!candidate) {
    journal('Aucune élève disponible pour le compte de démonstration : réparation ignorée.');
    return false;
  }

  const compte = await prisma.utilisateur.create({
    data: {
      role: 'ELEVE',
      ecoleId: ecole.id,
      nom: 'HOUNKPATIN',
      prenoms: 'Sèna Marie-Ange',
      motDePasseHash: await hacherMotDePasse(MOT_DE_PASSE),
      doitChangerMotDePasse: false,
    },
  });
  await prisma.eleve.update({
    where: { id: candidate.id },
    data: {
      utilisateurId: compte.id,
      identifiant,
      nom: 'HOUNKPATIN',
      prenoms: 'Sèna Marie-Ange',
      sexe: 'F',
    },
  });
  journal(`Compte élève de démonstration créé (${identifiant}, mot de passe commun).`);
  return true;
}
