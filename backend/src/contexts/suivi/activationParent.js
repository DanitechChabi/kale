// Activation d'un compte parent sans passer par le secrétariat.
//
// Preuve demandée : l'identifiant EduRelevé de l'enfant (imprimé sur sa fiche de
// connexion), sa date de naissance, et un téléphone identique au contact déclaré
// par l'établissement à l'inscription. Les trois doivent correspondre ; la réponse
// est la même quelle que soit l'information fausse (aucune fuite).
// Client global : le parent n'a pas encore de compte ni d'établissement ; les
// écritures dans l'école de l'enfant passent par son client isolé.
import { prisma } from '../../config/prisma.js';
import { prismaPourEcole } from '../../db/isolation.js';
import { ErreurApi } from '../../middlewares/erreurs.js';
import { normaliserIdentifiantEleve } from '../../utils/identifiantEleve.js';
import { hacherMotDePasse } from '../../utils/motDePasse.js';
import { journaliser } from '../audit/journal.js';

const memeJour = (a, b) =>
  new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);

export async function activerCompteParent(donnees, { adresseIp } = {}) {
  const identifiant = normaliserIdentifiantEleve(donnees.identifiantEleve);
  const eleve =
    identifiant &&
    (await prisma.eleve.findUnique({
      where: { identifiant },
      select: {
        id: true,
        ecoleId: true,
        dateNaissance: true,
        telephoneContactParent: true,
        ecole: { select: { statutVerification: true, actif: true } },
      },
    }));
  const correspond =
    eleve &&
    eleve.ecole.statutVerification === 'VERIFIEE' &&
    eleve.ecole.actif &&
    memeJour(eleve.dateNaissance, donnees.dateNaissance) &&
    eleve.telephoneContactParent === donnees.telephone;
  if (!correspond) {
    throw new ErreurApi(
      404,
      'INFORMATIONS_INCORRECTES',
      'Ces informations ne correspondent pas à celles enregistrées par l’établissement. Vérifiez-les, ou demandez au secrétariat de mettre à jour votre numéro.',
    );
  }

  const db = prismaPourEcole(eleve.ecoleId);
  let compte = await prisma.utilisateur.findUnique({ where: { telephone: donnees.telephone } });
  if (compte && compte.role !== 'PARENT') {
    throw new ErreurApi(
      409,
      'IDENTIFIANT_DEJA_UTILISE',
      'Ce numéro est déjà utilisé par un autre type de compte',
    );
  }
  const compteExistant = Boolean(compte);
  if (!compte) {
    compte = await prisma.utilisateur.create({
      data: {
        role: 'PARENT',
        nom: donnees.nom.toUpperCase(),
        prenoms: donnees.prenoms,
        telephone: donnees.telephone,
        motDePasseHash: await hacherMotDePasse(donnees.motDePasse),
        doitChangerMotDePasse: false,
      },
    });
  }
  await db.lienParentEleve.upsert({
    where: { parentId_eleveId: { parentId: compte.id, eleveId: eleve.id } },
    update: {},
    create: { parentId: compte.id, eleveId: eleve.id, lien: donnees.lien },
  });
  await journaliser(db, {
    utilisateurId: compte.id,
    action: compteExistant ? 'MODIFICATION' : 'CREATION',
    entite: 'LienParentEleve',
    entiteId: eleve.id,
    apres: { parent: compte.id, lien: donnees.lien, activationEnLigne: true },
    adresseIp,
  });
  return { compteExistant };
}
