// Gestion scolaire : années, périodes, classes, matières, élèves, inscriptions.
// Lecture : responsable, secrétariat, enseignants.
// Élèves et inscriptions : responsable et secrétariat.
// Structure (années, classes, matières) : responsable.
import { Router } from 'express';
import { z } from 'zod';
import {
  creerAnnee,
  definirAnneeCourante,
  listerAnnees,
  modifierPeriode,
} from '../contexts/scolarite/serviceAnnees.js';
import {
  ajouterEnseignement,
  creerClasse,
  creerMatiere,
  listerClasses,
  listerMatieres,
  lireClasse,
  modifierClasse,
  modifierEnseignement,
  modifierMatiere,
  retirerEnseignement,
  supprimerClasse,
} from '../contexts/scolarite/serviceClasses.js';
import {
  creerEleve,
  inscrire,
  listerEleves,
  lireEleve,
  modifierEleve,
  modifierInscription,
  supprimerEleve,
} from '../contexts/scolarite/serviceEleves.js';
import { NIVEAUX } from '../contexts/scolarite/libelles.js';
import {
  authentifier,
  exigerEcoleVerifiee,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import { valider } from '../middlewares/valider.js';
import { schemaTelephone } from '../utils/identifiants.js';
import { schemaId } from './aide.js';

export const routeurScolarite = Router();
routeurScolarite.use(
  ['/annees', '/periodes', '/classes', '/matieres', '/enseignements', '/eleves', '/inscriptions'],
  authentifier,
  exigerMotDePasseDefinitif,
  exigerRole('ADMIN_ECOLE', 'SECRETARIAT', 'ENSEIGNANT'),
  exigerEcoleVerifiee,
);

const lecture = exigerRole('ADMIN_ECOLE', 'SECRETARIAT', 'ENSEIGNANT');
const gestionEleves = exigerRole('ADMIN_ECOLE', 'SECRETARIAT');
const gestionStructure = exigerRole('ADMIN_ECOLE');

const date = z.coerce.date({ error: 'Date invalide' });
const texte = (min, max) => z.string().trim().min(min).max(max);
const vide = (schema) => z.preprocess((v) => (v === '' ? null : v), schema.nullish());

// --- Années et périodes -------------------------------------------------------

routeurScolarite.get('/annees', lecture, async (req, res) => {
  res.json({ annees: await listerAnnees(req.db) });
});

const schemaAnnee = z
  .object({
    libelle: z.string().regex(/^\d{4}-\d{4}$/, 'Format attendu : 2025-2026'),
    dateDebut: date,
    dateFin: date,
    estCourante: z.boolean().default(true),
  })
  .refine((a) => Number(a.libelle.slice(5)) === Number(a.libelle.slice(0, 4)) + 1, {
    message: 'Les deux années doivent se suivre',
    path: ['libelle'],
  });

routeurScolarite.post(
  '/annees',
  gestionStructure,
  valider({ body: schemaAnnee }),
  async (req, res) => {
    res
      .status(201)
      .json({ annee: await creerAnnee(req.db, req.utilisateur.ecoleId, req.valide.body) });
  },
);

routeurScolarite.post(
  '/annees/:id/courante',
  gestionStructure,
  valider({ params: schemaId }),
  async (req, res) => {
    res.json({ annee: await definirAnneeCourante(req.db, req.valide.params.id) });
  },
);

routeurScolarite.patch(
  '/periodes/:id',
  gestionStructure,
  valider({ params: schemaId, body: z.object({ dateDebut: date, dateFin: date }) }),
  async (req, res) => {
    res.json({ periode: await modifierPeriode(req.db, req.valide.params.id, req.valide.body) });
  },
);

// --- Classes ------------------------------------------------------------------

routeurScolarite.get(
  '/classes',
  lecture,
  valider({ query: z.object({ anneeScolaireId: z.uuid().optional() }) }),
  async (req, res) => {
    res.json({ classes: await listerClasses(req.db, req.valide.query) });
  },
);

const schemaClasse = z.object({
  anneeScolaireId: z.uuid().optional(),
  niveau: z.enum(NIVEAUX),
  serieId: vide(z.uuid()),
  nom: vide(texte(1, 50)),
  professeurPrincipalId: vide(z.uuid()),
});

routeurScolarite.post(
  '/classes',
  gestionStructure,
  valider({ body: schemaClasse }),
  async (req, res) => {
    res
      .status(201)
      .json({ classe: await creerClasse(req.db, req.utilisateur.ecoleId, req.valide.body) });
  },
);

routeurScolarite.get('/classes/:id', lecture, valider({ params: schemaId }), async (req, res) => {
  res.json({ classe: await lireClasse(req.db, req.valide.params.id) });
});

routeurScolarite.patch(
  '/classes/:id',
  gestionStructure,
  valider({
    params: schemaId,
    body: z.object({ nom: texte(1, 50).optional(), professeurPrincipalId: vide(z.uuid()) }),
  }),
  async (req, res) => {
    res.json({ classe: await modifierClasse(req.db, req.valide.params.id, req.valide.body) });
  },
);

routeurScolarite.delete(
  '/classes/:id',
  gestionStructure,
  valider({ params: schemaId }),
  async (req, res) => {
    await supprimerClasse(req.db, req.valide.params.id);
    res.status(204).end();
  },
);

// --- Matières et enseignements -----------------------------------------------

routeurScolarite.get('/matieres', lecture, async (req, res) => {
  res.json({ matieres: await listerMatieres(req.db) });
});

routeurScolarite.post(
  '/matieres',
  gestionStructure,
  valider({
    body: z.object({
      code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9-]{1,20}$/, 'Lettres, chiffres et « - » uniquement'),
      nom: texte(2, 100),
    }),
  }),
  async (req, res) => {
    res.status(201).json({ matiere: await creerMatiere(req.db, req.valide.body) });
  },
);

routeurScolarite.patch(
  '/matieres/:id',
  gestionStructure,
  valider({
    params: schemaId,
    body: z.object({ nom: texte(2, 100).optional(), actif: z.boolean().optional() }),
  }),
  async (req, res) => {
    res.json({ matiere: await modifierMatiere(req.db, req.valide.params.id, req.valide.body) });
  },
);

const champsEnseignement = {
  coefficient: z.coerce.number().int().min(1).max(20),
  enseignantId: vide(z.uuid()),
  estFacultative: z.boolean(),
  groupeOption: vide(texte(1, 30)),
  heuresHebdo: vide(z.coerce.number().min(0.5).max(40)),
};

routeurScolarite.post(
  '/classes/:id/enseignements',
  gestionStructure,
  valider({
    params: schemaId,
    body: z.object({
      matiereId: z.uuid(),
      ...champsEnseignement,
      estFacultative: champsEnseignement.estFacultative.default(false),
    }),
  }),
  async (req, res) => {
    res.status(201).json({
      enseignement: await ajouterEnseignement(req.db, req.valide.params.id, req.valide.body),
    });
  },
);

routeurScolarite.patch(
  '/enseignements/:id',
  gestionStructure,
  valider({ params: schemaId, body: z.object(champsEnseignement).partial() }),
  async (req, res) => {
    res.json({
      enseignement: await modifierEnseignement(req.db, req.valide.params.id, req.valide.body),
    });
  },
);

routeurScolarite.delete(
  '/enseignements/:id',
  gestionStructure,
  valider({ params: schemaId }),
  async (req, res) => {
    await retirerEnseignement(req.db, req.valide.params.id);
    res.status(204).end();
  },
);

// --- Élèves -------------------------------------------------------------------

routeurScolarite.get(
  '/eleves',
  lecture,
  valider({
    query: z.object({
      recherche: z.string().trim().max(100).optional(),
      classeId: z.uuid().optional(),
      sansClasse: z.stringbool().optional(),
      page: z.coerce.number().int().min(1).default(1),
      parPage: z.coerce.number().int().min(1).max(200).default(50),
    }),
  }),
  async (req, res) => {
    res.json(await listerEleves(req.db, req.valide.query));
  },
);

const champsEleve = {
  nom: texte(2, 100).transform((v) => v.toUpperCase()),
  prenoms: texte(2, 150),
  sexe: z.enum(['M', 'F']),
  dateNaissance: date,
  lieuNaissance: vide(texte(1, 100)),
  npi: vide(
    z
      .string()
      .trim()
      .regex(/^\d{6,20}$/, 'Le NPI ne contient que des chiffres'),
  ),
  matricule: vide(texte(1, 30)),
  nomContactParent: vide(texte(2, 200)),
  telephoneContactParent: vide(schemaTelephone),
};

routeurScolarite.post(
  '/eleves',
  gestionEleves,
  valider({ body: z.object({ ...champsEleve, classeId: vide(z.uuid()) }) }),
  async (req, res) => {
    res.status(201).json({ eleve: await creerEleve(req.db, req.valide.body) });
  },
);

routeurScolarite.get('/eleves/:id', lecture, valider({ params: schemaId }), async (req, res) => {
  res.json({ eleve: await lireEleve(req.db, req.valide.params.id) });
});

routeurScolarite.patch(
  '/eleves/:id',
  gestionEleves,
  valider({ params: schemaId, body: z.object(champsEleve).partial() }),
  async (req, res) => {
    res.json({ eleve: await modifierEleve(req.db, req.valide.params.id, req.valide.body) });
  },
);

routeurScolarite.delete(
  '/eleves/:id',
  gestionEleves,
  valider({ params: schemaId }),
  async (req, res) => {
    await supprimerEleve(req.db, req.valide.params.id);
    res.status(204).end();
  },
);

// --- Inscriptions -------------------------------------------------------------

routeurScolarite.post(
  '/inscriptions',
  gestionEleves,
  valider({
    body: z.object({ eleveId: z.uuid(), classeId: z.uuid(), redoublant: z.boolean().optional() }),
  }),
  async (req, res) => {
    res.status(201).json({ inscription: await inscrire(req.db, req.valide.body) });
  },
);

routeurScolarite.patch(
  '/inscriptions/:id',
  gestionEleves,
  valider({
    params: schemaId,
    body: z.object({
      classeId: z.uuid().optional(),
      statut: z.enum(['INSCRIT', 'TRANSFERE', 'ABANDON', 'EXCLU']).optional(),
      redoublant: z.boolean().optional(),
    }),
  }),
  async (req, res) => {
    res.json({
      inscription: await modifierInscription(req.db, req.valide.params.id, req.valide.body),
    });
  },
);
