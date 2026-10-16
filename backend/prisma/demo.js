// Données de démonstration : 3 établissements fictifs dans 3 départements, deux années
// scolaires (2025-2026 terminée et archivée, 2026-2027 en cours) et un compte par rôle.
//
// Usage : npm run demo --prefix backend   (référentiel et catalogue EduCourses chargés avant)
// En production, ajouter « -- --confirmer » : le script refuse sinon de s'exécuter.
//
// Tout passe par l'API de l'application (même règles, mêmes triggers, PDF réellement
// archivés), sauf la création des comptes et des fiches élèves, faite directement en base
// comme le ferait un import. Le script ne s'exécute qu'une fois : il s'arrête si les
// établissements de démonstration existent déjà.
import { PrismaClient } from '@prisma/client';

const MOT_DE_PASSE = 'EduReleve2026';
const ANCIENNE = { libelle: '2025-2026', dateDebut: '2025-09-15', dateFin: '2026-07-10' };
const COURANTE = { libelle: '2026-2027', dateDebut: '2026-09-14', dateFin: '2027-07-09' };

// Comptes de démonstration (téléphones fictifs, mot de passe commun)
export const COMPTES = {
  superAdmin: '+2290100000001',
  ministere: '+2290100000002',
  parent: '+2290100000003',
};

const ECOLES = [
  {
    code: 'DEMO-CEG-COCOTIERS',
    nom: 'CEG Les Cocotiers',
    sigle: 'CEG-LC',
    statut: 'PUBLIC',
    type: 'CEG',
    commune: 'Cotonou',
    chef: 'Mme Afiavi DOSSOU-YOVO',
    telephone: '+2290121304050',
    niveau: 0.6, // effet établissement sur les notes
    comptes: { admin: '+2290100000010', secretariat: '+2290100000011', prof: '+2290100000012' },
    classes: [['SIXIEME'], ['SIXIEME'], ['CINQUIEME'], ['QUATRIEME'], ['TROISIEME']],
  },
  {
    code: 'DEMO-LYC-RONIERS',
    nom: 'Lycée Les Rôniers',
    sigle: 'LYC-LR',
    statut: 'PUBLIC',
    type: 'LYCEE',
    commune: 'Parakou',
    chef: 'M. Moumouni GOUNOU',
    telephone: '+2290123617080',
    niveau: -0.4,
    comptes: { admin: '+2290100000020', secretariat: '+2290100000021', prof: '+2290100000022' },
    classes: [
      ['TROISIEME'],
      ['SECONDE', 'C'],
      ['SECONDE', 'A2'],
      ['PREMIERE', 'D'],
      ['TERMINALE', 'D'],
    ],
  },
  {
    code: 'DEMO-CS-LUMIERE',
    nom: 'Complexe scolaire La Lumière',
    sigle: 'CS-LUM',
    statut: 'PRIVE_LAIC',
    type: 'COMPLEXE_SCOLAIRE',
    commune: 'Abomey',
    chef: 'M. Fiacre HOUNGBEDJI',
    telephone: '+2290122500712',
    niveau: 0.2,
    comptes: { admin: '+2290100000030', secretariat: '+2290100000031', prof: '+2290100000032' },
    classes: [['SIXIEME'], ['QUATRIEME'], ['TROISIEME'], ['TERMINALE', 'A1']],
  },
];

const NOMS = [
  'AGOSSOU',
  'HOUNKPATIN',
  'DOSSOU',
  'KPOSSOU',
  'ZINSOU',
  'TOSSOU',
  'AHOUANDJINOU',
  'GBAGUIDI',
  'HOUNGBEDJI',
  'ADJOVI',
  'BIO',
  'GOUNOU',
  'SANNI',
  'OROU',
  'YAROU',
  'SAKA',
  'IDRISSOU',
  'AKPOVI',
  'ASSOGBA',
  'DEGBE',
  'GANDONOU',
  'HOUENOU',
  'KIKI',
  'LOKO',
  'MENSAH',
  'OGOUNCHI',
  'SOSSOU',
  'TCHIBOZO',
  'VODOUNON',
  'YEHOUENOU',
  'ADANDE',
  'BOKO',
  'CODJIA',
  'DJOSSOU',
  'FAGLA',
  'HOUNSOU',
  'KOUTON',
  'MEDJI',
  'NOUDOGBESSI',
  'SEGBO',
];
const PRENOMS_F = [
  'Sèna',
  'Afi',
  'Grâce',
  'Rachidatou',
  'Fatoumata',
  'Aïcha',
  'Inès',
  'Prudence',
  'Espérance',
  'Merveille',
  'Dorcas',
  'Fifamè',
  'Houéfa',
  'Ornella',
  'Carmelle',
  'Rosine',
  'Nafissatou',
  'Zénabou',
  'Mahugnon',
  'Sêmèvo',
];
const PRENOMS_M = [
  'Koffi',
  'Romuald',
  'Mathias',
  'Moumouni',
  'Ibrahim',
  'Chabi',
  'Gounou',
  'Orou',
  'Yacoubou',
  'Fiacre',
  'Gildas',
  'Rodrigue',
  'Ezéchiel',
  'Arnaud',
  'Fréjus',
  'Charbel',
  'Florentin',
  'Hermann',
  'Tanguy',
  'Jean-Baptiste',
];
const NIVEAUX = [
  'SIXIEME',
  'CINQUIEME',
  'QUATRIEME',
  'TROISIEME',
  'SECONDE',
  'PREMIERE',
  'TERMINALE',
];
const ELEVES_PAR_CLASSE = 24;

// Générateur pseudo-aléatoire déterministe : la démonstration est identique à chaque chargement
let graine = 20262027;
const alea = () => (graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648;
const choisir = (liste) => liste[Math.floor(alea() * liste.length)];
const gauss = () => Math.sqrt(-2 * Math.log(alea() || 1e-9)) * Math.cos(2 * Math.PI * alea());
const quart = (v) => Math.min(20, Math.max(0, Math.round(v * 4) / 4));
const jourIso = (d) => d.toISOString().slice(0, 10);
const plus = (date, jours) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return jourIso(d);
};

/** Client HTTP vers l'application démarrée en mémoire. */
function clientApi(base) {
  const appel = async (methode, chemin, { corps, jeton, attendu } = {}) => {
    const estFormulaire = corps instanceof FormData;
    const reponse = await fetch(`${base}${chemin}`, {
      method: methode,
      headers: {
        ...(corps && !estFormulaire && { 'Content-Type': 'application/json' }),
        ...(jeton && { Authorization: `Bearer ${jeton}` }),
      },
      body: corps ? (estFormulaire ? corps : JSON.stringify(corps)) : undefined,
    });
    const donnees = await reponse.json().catch(() => null);
    if (!reponse.ok && reponse.status !== attendu) {
      const erreur = new Error(
        `${methode} ${chemin} → ${reponse.status} ${JSON.stringify(donnees?.erreur)}`,
      );
      erreur.statut = reponse.status;
      erreur.code = donnees?.erreur?.code;
      throw erreur;
    }
    return donnees;
  };
  return {
    appel,
    async connecter(telephone) {
      const r = await appel('POST', '/auth/connexion', {
        corps: { identifiant: telephone, motDePasse: MOT_DE_PASSE },
      });
      const jeton = r.jetonAcces;
      return {
        get: (c) => appel('GET', c, { jeton }),
        post: (c, corps, options) => appel('POST', c, { corps, jeton, ...options }),
        put: (c, corps) => appel('PUT', c, { corps, jeton }),
        patch: (c, corps) => appel('PATCH', c, { corps, jeton }),
        delete: (c) => appel('DELETE', c, { jeton }),
      };
    },
  };
}

/**
 * Appel du premier cours de chaque matinée, du lundi au vendredi, entre deux dates.
 * Sans emploi du temps (année archivée), l'appel est fait à 7 h.
 */
async function appeler(api, classes, du, au, niveauEcole) {
  for (let jour = du; jour <= au; jour = plus(jour, 1)) {
    const jourSemaine = new Date(`${jour}T00:00:00Z`).getUTCDay();
    if (jourSemaine === 0 || jourSemaine === 6) continue;
    for (const classe of classes) {
      const premier = (classe.creneaux ?? [])
        .filter((c) => c.jour === jourSemaine)
        .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut))[0];
      if (classe.creneaux && !premier) continue;
      const presences = classe.eleves
        .map((el) => {
          const tirage = alea();
          if (tirage < 0.045 + (niveauEcole < 0 ? 0.03 : 0))
            return { eleveId: el.id, statut: 'ABSENT' };
          if (tirage < 0.075) {
            return { eleveId: el.id, statut: 'RETARD', minutesRetard: 5 + Math.floor(alea() * 25) };
          }
          return null;
        })
        .filter(Boolean);
      await api.put('/appels', {
        classeId: classe.id,
        date: jour,
        heureDebut: premier?.heureDebut ?? '07:00',
        ...(premier && { creneauId: premier.id, enseignementId: premier.enseignementId }),
        presences,
      });
    }
  }
}

export async function chargerDemo(prisma, { journal = console.log } = {}) {
  if (await prisma.ecole.findUnique({ where: { code: ECOLES[0].code } })) {
    journal('Données de démonstration déjà présentes : rien à faire.');
    return null;
  }
  const { hacherMotDePasse } = await import('../src/utils/motDePasse.js');
  const { genererIdentifiantEleve } = await import('../src/utils/identifiantEleve.js');
  const { creerApp } = await import('../src/app.js');
  const { normaliserNumero } = await import('../src/utils/numeroDocument.js');
  const hache = await hacherMotDePasse(MOT_DE_PASSE);

  // Application en mémoire, limites de débit levées pour le chargement
  const app = creerApp({
    auth: { limiteConnexion: 100000 },
    public: { limiteDuplicata: 100000, limiteVerification: 100000, limiteActivation: 100000 },
  });
  const serveur = app.listen(0);
  await new Promise((ok) => serveur.once('listening', ok));
  const api = clientApi(`http://127.0.0.1:${serveur.address().port}/api`);

  const compte = (role, telephone, nom, prenoms, ecoleId = null) =>
    prisma.utilisateur.upsert({
      where: { telephone },
      update: {},
      create: {
        role,
        ecoleId,
        nom,
        prenoms,
        telephone,
        motDePasseHash: hache,
        doitChangerMotDePasse: false,
      },
    });

  try {
    const superAdmin = await compte(
      'SUPER_ADMIN',
      COMPTES.superAdmin,
      'ADMINISTRATEUR',
      'Plateforme',
    );
    await compte('MINISTERE', COMPTES.ministere, 'DEGBE', 'Pascal');
    const parent = await compte('PARENT', COMPTES.parent, 'HOUNKPATIN', 'Rachelle');

    const resume = [];
    const elevesAnnuels = []; // { ecole, eleve, niveau } pour l'année en cours
    for (const [rang, spec] of ECOLES.entries()) {
      journal(`• ${spec.nom} (${spec.commune})`);
      const commune = await prisma.commune.findFirst({ where: { nom: spec.commune } });
      const ecole = await prisma.ecole.create({
        data: {
          code: spec.code,
          nom: spec.nom,
          sigle: spec.sigle,
          statut: spec.statut,
          type: spec.type,
          ordres: ['GENERAL'],
          communeId: commune.id,
          nomChefEtablissement: spec.chef,
          telephone: spec.telephone,
          statutVerification: 'VERIFIEE',
          verifieeLe: new Date(),
          verifieeParId: superAdmin.id,
        },
      });
      const [nomChef, ...prenomsChef] = spec.chef.split(' ').slice(1).reverse();
      await compte(
        'ADMIN_ECOLE',
        spec.comptes.admin,
        nomChef,
        prenomsChef.reverse().join(' '),
        ecole.id,
      );
      await compte(
        'SECRETARIAT',
        spec.comptes.secretariat,
        choisir(NOMS),
        choisir(PRENOMS_F),
        ecole.id,
      );
      const profPrincipal = await compte(
        'ENSEIGNANT',
        spec.comptes.prof,
        choisir(NOMS),
        choisir(PRENOMS_M),
        ecole.id,
      );
      const direction = await api.connecter(spec.comptes.admin);
      const secretariat = await api.connecter(spec.comptes.secretariat);

      // Un enseignant par matière (le compte de démonstration enseigne les mathématiques)
      const enseignants = new Map([['MATH', profPrincipal.id]]);
      const enseignantDe = async (code) => {
        if (!enseignants.has(code)) {
          const telephone = `+22901${String(40000000 + rang * 1000 + enseignants.size).padStart(8, '0')}`;
          const p = await compte(
            'ENSEIGNANT',
            telephone,
            choisir(NOMS),
            choisir(PRENOMS_M),
            ecole.id,
          );
          enseignants.set(code, p.id);
        }
        return enseignants.get(code);
      };

      /** Crée les classes d'une année, retire les matières facultatives, affecte les enseignants. */
      const creerClasses = async (annee, niveaux) => {
        const classes = [];
        for (const [niveau, serie] of niveaux) {
          const serieId = serie
            ? (await prisma.serie.findUnique({ where: { code: serie } }))?.id
            : undefined;
          const { classe } = await direction.post('/classes', {
            anneeScolaireId: annee.id,
            niveau,
            ...(serieId && { serieId }),
          });
          const enseignements = [];
          for (const e of classe.enseignements) {
            if (e.estFacultative || e.groupeOption) {
              await direction.delete(`/enseignements/${e.id}`).catch(() => {});
              continue;
            }
            await direction.patch(`/enseignements/${e.id}`, {
              enseignantId: await enseignantDe(e.matiere.code),
            });
            enseignements.push(e);
          }
          classes.push({ ...classe, niveau, enseignements });
        }
        return classes;
      };

      /** Fiches élèves (comme un import) et inscription dans la classe. */
      const nouvelEleve = async (niveau) => {
        const fille = alea() < 0.5;
        const age = 11 + NIVEAUX.indexOf(niveau);
        return prisma.eleve.create({
          data: {
            ecoleId: ecole.id,
            identifiant: genererIdentifiantEleve(),
            matricule: `${spec.sigle}-${String(Math.floor(alea() * 1e5)).padStart(5, '0')}`,
            nom: choisir(NOMS),
            prenoms: `${choisir(fille ? PRENOMS_F : PRENOMS_M)} ${choisir(fille ? PRENOMS_F : PRENOMS_M)}`,
            sexe: fille ? 'F' : 'M',
            dateNaissance: new Date(
              Date.UTC(2025 - age, Math.floor(alea() * 12), 1 + Math.floor(alea() * 28)),
            ),
            lieuNaissance: spec.commune,
            telephoneContactParent: `+22901${String(Math.floor(alea() * 1e8)).padStart(8, '0')}`,
          },
        });
      };
      const inscrire = (eleve, classe, annee) =>
        prisma.inscription.create({
          data: {
            ecoleId: ecole.id,
            eleveId: eleve.id,
            classeId: classe.id,
            anneeScolaireId: annee.id,
          },
        });

      /** Évaluations et notes d'une classe pour une période (niveau propre à chaque élève). */
      const noter = async (classe, periode, aptitudes, dates) => {
        const types = ['INTERROGATION', 'DEVOIR', 'COMPOSITION'];
        for (const e of classe.enseignements) {
          const effetMatiere = gauss() * 0.8;
          for (const [i, date] of dates.entries()) {
            const { evaluation } = await direction.post('/evaluations', {
              enseignementId: e.id,
              periodeId: periode.id,
              type: types[Math.min(i, types.length - 1)],
              date,
            });
            await direction.put(`/evaluations/${evaluation.id}/notes`, {
              notes: classe.eleves.map((el) => ({
                eleveId: el.id,
                valeur: quart(
                  10.4 + spec.niveau + aptitudes.get(el.id) + effetMatiere + gauss() * 2.2,
                ),
              })),
            });
          }
        }
      };

      // --- Année 2025-2026 : trois trimestres, clôture, bulletins et relevés archivés ------
      const { annee: passee } = await direction.post('/annees', { ...ANCIENNE, estCourante: true });
      const classesPassees = await creerClasses(passee, spec.classes);
      const aptitudes = new Map();
      for (const classe of classesPassees) {
        classe.eleves = [];
        for (let i = 0; i < ELEVES_PAR_CLASSE; i++) {
          const eleve = await nouvelEleve(classe.niveau);
          await inscrire(eleve, classe, passee);
          aptitudes.set(eleve.id, gauss() * 2.6);
          classe.eleves.push(eleve);
        }
      }
      for (const periode of passee.periodes) {
        const debut = jourIso(new Date(periode.dateDebut));
        const fin = jourIso(new Date(periode.dateFin));
        for (const classe of classesPassees) {
          await noter(classe, periode, aptitudes, [
            plus(debut, 20),
            plus(debut, 45),
            plus(fin, -12),
          ]);
        }
        await direction.post(`/periodes/${periode.id}/cloture`, {}).catch((e) =>
          e.code === 'CLOTURE_INCOMPLETE'
            ? direction.post(`/periodes/${periode.id}/cloture`, {
                forcer: true,
                motif: 'Clôture de l’année archivée',
              })
            : Promise.reject(e),
        );
        for (const classe of classesPassees) {
          await secretariat.post('/releves/generation', {
            classeId: classe.id,
            periodeId: periode.id,
          });
        }
      }
      for (const classe of classesPassees) {
        await secretariat.post('/releves/generation', { classeId: classe.id });
      }

      // Appels de mars 2026 (taux d'absence de l'année archivée)
      await appeler(direction, classesPassees, '2026-03-02', '2026-03-27', spec.niveau);

      // --- Année 2026-2027 en cours : passage en classe supérieure, nouveaux 6e ------------
      const { annee: courante } = await direction.post('/annees', {
        ...COURANTE,
        estCourante: true,
      });
      const niveauxCourants = spec.classes.map(([niveau, serie]) => [niveau, serie]);
      const classesCourantes = await creerClasses(courante, niveauxCourants);
      for (const [i, classe] of classesCourantes.entries()) {
        // Les élèves de la classe de niveau inférieur montent ; le reste : nouveaux élèves
        const source = classesPassees.find(
          (c, j) =>
            NIVEAUX.indexOf(c.niveau) === NIVEAUX.indexOf(classe.niveau) - 1 &&
            !c.promue &&
            j !== i,
        );
        if (source) source.promue = true;
        classe.eleves = [];
        for (const eleve of source?.eleves ?? []) {
          await inscrire(eleve, classe, courante);
          classe.eleves.push(eleve);
        }
        while (classe.eleves.length < ELEVES_PAR_CLASSE) {
          const eleve = await nouvelEleve(classe.niveau);
          await inscrire(eleve, classe, courante);
          aptitudes.set(eleve.id, gauss() * 2.6);
          classe.eleves.push(eleve);
        }
        for (const eleve of classe.eleves) elevesAnnuels.push({ ecole, eleve, classe });
      }
      const t1 = courante.periodes[0];
      for (const classe of classesCourantes) {
        await noter(classe, t1, aptitudes, ['2026-10-02', '2026-10-09']);
      }

      // Emploi du temps de chaque classe (conflits d'enseignants ignorés : créneau sauté)
      const plan = [
        [1, '07:00', '09:00'],
        [1, '09:00', '11:00'],
        [1, '11:00', '12:00'],
        [1, '15:00', '17:00'],
        [2, '07:00', '09:00'],
        [2, '09:00', '11:00'],
        [2, '11:00', '12:00'],
        [2, '15:00', '17:00'],
        [3, '07:00', '09:00'],
        [3, '09:00', '11:00'],
        [3, '11:00', '12:00'],
        [4, '07:00', '09:00'],
        [4, '09:00', '11:00'],
        [4, '15:00', '17:00'],
        [5, '07:00', '09:00'],
        [5, '09:00', '11:00'],
        [5, '11:00', '12:00'],
        [5, '15:00', '17:00'],
      ];
      for (const [k, classe] of classesCourantes.entries()) {
        classe.creneaux = [];
        for (const [j, [jour, heureDebut, heureFin]] of plan.entries()) {
          const e = classe.enseignements[(j + k * 3) % classe.enseignements.length];
          const r = await direction
            .post('/creneaux', {
              enseignementId: e.id,
              jour,
              heureDebut,
              heureFin,
              salle: `Salle ${k + 1}`,
            })
            .catch(() => null);
          if (r) classe.creneaux.push(r.creneau);
        }
      }

      // Appels des quatre dernières semaines (premier cours de chaque matinée)
      await appeler(direction, classesCourantes, '2026-09-21', '2026-10-15', spec.niveau);

      // Cours et devoirs publiés par l'enseignant de mathématiques
      const prof = await api.connecter(spec.comptes.prof);
      const pdf = Buffer.from(
        '%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n',
      );
      for (const classe of classesCourantes) {
        const maths = classe.enseignements.find((e) => e.matiere.code === 'MATH');
        if (!maths) continue;
        const formulaire = (champs, nomFichier) => {
          const f = new FormData();
          for (const [k, v] of Object.entries(champs)) f.append(k, v);
          if (nomFichier)
            f.append('fichier', new Blob([pdf], { type: 'application/pdf' }), nomFichier);
          return f;
        };
        await prof.post(
          '/cours',
          formulaire(
            {
              enseignementId: maths.id,
              titre: 'Fiche de cours : nombres décimaux',
              type: 'DOCUMENT',
              description: 'À relire avant le prochain devoir.',
            },
            'decimaux.pdf',
          ),
        );
        await prof.post(
          '/devoirs',
          formulaire({
            enseignementId: maths.id,
            titre: 'Exercices 4 à 7, page 52',
            consignes: 'Rédiger les solutions sur le cahier d’exercices.',
            pourLe: '2026-10-20',
          }),
        );
      }

      // Duplicatas : anciens élèves de 2025-2026 (deux délivrés, un en attente)
      const derniere = classesPassees.at(-1);
      for (const [k, ancien] of derniere.eleves.slice(0, 3).entries()) {
        const { numeroSuivi } = await api.appel('POST', '/public/duplicata', {
          corps: {
            ecoleId: ecole.id,
            typeDocument: 'RELEVE_ANNUEL',
            libelleAnnee: ANCIENNE.libelle,
            classeDeclaree: derniere.nom,
            nomEleve: ancien.nom,
            prenomsEleve: ancien.prenoms,
            dateNaissance: jourIso(ancien.dateNaissance),
            nomDemandeur: `${ancien.prenoms.split(' ')[0]} ${ancien.nom}`,
            telephone: ancien.telephoneContactParent,
            motif: 'Inscription à l’université',
          },
        });
        if (k === 2) continue; // reste en attente : à traiter pendant la démonstration
        const demande = await prisma.demandeDuplicata.findFirst({
          where: { ecoleId: ecole.id, numeroSuivi: normaliserNumero(numeroSuivi) },
        });
        const releve = await prisma.releveArchive.findFirst({
          where: { eleveId: ancien.id, type: 'RELEVE_ANNUEL' },
        });
        await secretariat.post(`/duplicatas/${demande.id}/prise-en-charge`);
        await secretariat.post(`/duplicatas/${demande.id}/delivrance`, { releveId: releve.id });
        // Démonstration : la demande a été déposée quelques heures avant sa délivrance
        const heures = [5, 30, 18][rang] + k * 7;
        await prisma.demandeDuplicata.update({
          where: { id: demande.id },
          data: {
            demandeLe: new Date(Date.now() - heures * 3600e3),
            priseEnChargeLe: new Date(Date.now() - (heures - 1) * 3600e3),
          },
        });
      }
      resume.push({
        ecole: spec.nom,
        commune: spec.commune,
        comptes: spec.comptes,
        eleves: classesCourantes.reduce((s, c) => s + c.eleves.length, 0),
      });
    }

    // --- Comptes élève et parent de démonstration ---------------------------------------
    // L'élève : une 6e du CEG Les Cocotiers ; le parent suit aussi un enfant à Parakou
    const sixieme = elevesAnnuels.find((x) => x.classe.niveau === 'SIXIEME');
    const parakou = elevesAnnuels.find((x) => x.ecole.code === ECOLES[1].code);
    const eleveCompte = await prisma.utilisateur.create({
      data: {
        role: 'ELEVE',
        ecoleId: sixieme.ecole.id,
        nom: 'HOUNKPATIN',
        prenoms: 'Sèna Marie-Ange',
        motDePasseHash: hache,
        doitChangerMotDePasse: false,
      },
    });
    await prisma.eleve.update({
      where: { id: sixieme.eleve.id },
      data: {
        utilisateurId: eleveCompte.id,
        nom: 'HOUNKPATIN',
        prenoms: 'Sèna Marie-Ange',
        sexe: 'F',
      },
    });
    for (const [x, lien] of [
      [sixieme, 'MERE'],
      [parakou, 'MERE'],
    ]) {
      await prisma.eleve.update({
        where: { id: x.eleve.id },
        data: { telephoneContactParent: COMPTES.parent },
      });
      await prisma.lienParentEleve.create({
        data: { ecoleId: x.ecole.id, parentId: parent.id, eleveId: x.eleve.id, lien },
      });
    }
    await prisma.eleve.update({
      where: { id: parakou.eleve.id },
      data: { nom: 'HOUNKPATIN', prenoms: 'Koffi Romuald', sexe: 'M' },
    });

    // EduCourses : profils et quelques leçons travaillées par l'élève
    const eleve = await api.connecter(sixieme.eleve.identifiant).catch(() => null);
    if (eleve) {
      const { profils } = await eleve.get('/educourses/profils');
      const lecons = await prisma.ecLecon.findMany({
        where: { redigeeLe: { not: null }, chapitre: { programme: { niveau: 'SIXIEME' } } },
        orderBy: [
          { chapitre: { programme: { ordre: 'asc' } } },
          { chapitre: { ordre: 'asc' } },
          { ordre: 'asc' },
        ],
        take: 7,
      });
      for (const [i, l] of lecons.entries()) {
        const reponses = l.quiz.map((q, j) =>
          (i + j) % 4 === 0 ? (q.bonne + 1) % q.choix.length : q.bonne,
        );
        await eleve.post(`/educourses/lecons/${l.id}/quiz`, { profilId: profils[0].id, reponses });
        if (i < 5)
          await eleve.put(`/educourses/lecons/${l.id}/terminee`, {
            profilId: profils[0].id,
            terminee: true,
          });
      }
    }
    const parentApi = await api.connecter(COMPTES.parent);
    await parentApi.post('/educourses/profils', { eleveId: sixieme.eleve.id });

    // Appel du jour : le parent reçoit un SMS pour chacun de ses enfants
    for (const [x, presence, rang] of [
      [sixieme, { statut: 'ABSENT' }, 0],
      [parakou, { statut: 'RETARD', minutesRetard: 15 }, 1],
    ]) {
      const direction = await api.connecter(ECOLES[rang].comptes.admin);
      const premier = x.classe.creneaux
        .filter((c) => c.jour === 5)
        .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut))[0];
      await direction.put('/appels', {
        classeId: x.classe.id,
        date: '2026-10-16',
        heureDebut: premier?.heureDebut ?? '07:00',
        ...(premier && { creneauId: premier.id, enseignementId: premier.enseignementId }),
        presences: [{ eleveId: x.eleve.id, ...presence }],
      });
    }

    return { resume, identifiantEleve: sixieme.eleve.identifiant };
  } finally {
    serveur.close();
  }
}

// Lancement direct
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--confirmer')) {
    console.error('Production : relancez avec « -- --confirmer » pour charger la démonstration.');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const debut = Date.now();
  try {
    const resultat = await chargerDemo(prisma);
    if (resultat) {
      console.log(`\n✔ Démonstration chargée en ${Math.round((Date.now() - debut) / 1000)} s`);
      console.log(`  Mot de passe de tous les comptes : ${MOT_DE_PASSE}`);
      console.log(
        `  Super-admin ${COMPTES.superAdmin} · Ministère ${COMPTES.ministere} · Parent ${COMPTES.parent}`,
      );
      console.log(`  Élève (identifiant) : ${resultat.identifiantEleve}`);
      for (const r of resultat.resume) {
        console.log(
          `  ${r.ecole} (${r.commune}) : ${r.eleves} élèves — direction ${r.comptes.admin}, secrétariat ${r.comptes.secretariat}, enseignant ${r.comptes.prof}`,
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }
  process.exit(0);
}
