// API publique, sans compte : /api/public
// - vérification des documents archivés (universités, employeurs, administrations) ;
// - demande de duplicata en ligne et suivi par le demandeur.
// Ouverte à toutes les origines (CORS « * », sans cookie) et limitée par adresse IP.
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config/env.js';
import {
  deposerDemande,
  rechercherEtablissements,
  suivreDemande,
  telechargerDuplicata,
} from '../contexts/duplicata/serviceDuplicata.js';
import {
  consulterDocument,
  verifierEmpreinte,
} from '../contexts/releves/serviceVerificationPublique.js';
import { ErreurApi } from '../middlewares/erreurs.js';
import {
  limiterActivation,
  limiterDuplicata,
  limiterSuivi,
  limiterVerification,
} from '../middlewares/limites.js';
import { activerCompteParent } from '../contexts/suivi/activationParent.js';
import { schemaMotDePasse } from '../utils/motDePasse.js';
import { valider } from '../middlewares/valider.js';
import { schemaEmail, schemaTelephone } from '../utils/identifiants.js';
import { envoyerPdfArchive } from './aide.js';

const texte = (max) => z.string().trim().min(1, 'Champ obligatoire').max(max);
const schemaNumero = z.object({ numero: z.string().max(40) });

export const schemaDemandeDuplicata = z
  .object({
    ecoleId: z.uuid('Choisissez un établissement'),
    typeDocument: z.enum(['BULLETIN_PERIODE', 'RELEVE_ANNUEL']),
    libelleAnnee: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{4}$/, 'Format attendu : 2019-2020')
      .refine((v) => Number(v.slice(5)) === Number(v.slice(0, 4)) + 1, 'Années non consécutives'),
    numeroPeriode: z.coerce.number().int().min(1).max(3).optional(),
    classeDeclaree: texte(50).optional(),
    nomEleve: texte(100),
    prenomsEleve: texte(150),
    dateNaissance: z.coerce
      .date('Date invalide')
      .refine((d) => d < new Date() && d.getUTCFullYear() > 1930, 'Date de naissance invalide'),
    matriculeDeclare: texte(30).optional(),
    nomDemandeur: texte(250),
    telephone: schemaTelephone,
    email: schemaEmail.optional(),
    motif: texte(500).optional(),
  })
  .refine((d) => d.typeDocument !== 'BULLETIN_PERIODE' || d.numeroPeriode, {
    message: 'Précisez le trimestre ou le semestre',
    path: ['numeroPeriode'],
  });

export function creerRouteurPublic({
  limiteVerification = config.LIMITE_VERIFICATION,
  limiteDuplicata = config.LIMITE_DUPLICATA,
  limiteActivation = config.LIMITE_ACTIVATION,
} = {}) {
  const routeur = Router();
  const verification = limiterVerification(limiteVerification);

  // --- Vérification des documents (v1) ---------------------------------------------

  routeur.get('/v1/documents', (req, res) => {
    res.json({
      service: 'Vérification des bulletins et relevés archivés EduRelevé',
      version: 1,
      points: [
        {
          methode: 'GET',
          chemin: '/api/public/v1/documents/{numero}',
          description:
            'Fiche du document : statut (EN_VIGUEUR ou REMPLACE), élève, établissement, moyennes, empreinte SHA-256 du PDF archivé.',
        },
        {
          methode: 'POST',
          chemin: '/api/public/v1/documents/{numero}/verification',
          corps: { empreinteSha256: 'empreinte SHA-256 (hexadécimal) du fichier PDF reçu' },
          description: 'Indique si le fichier reçu est identique à l’original archivé.',
        },
      ],
      limite: `${limiteVerification} requêtes par minute et par adresse IP`,
    });
  });

  routeur.get(
    '/v1/documents/:numero',
    verification,
    valider({ params: schemaNumero }),
    async (req, res) => {
      const fiche = await consulterDocument(req.valide.params.numero);
      if (!fiche.trouve) {
        throw new ErreurApi(
          404,
          fiche.formatInvalide ? 'NUMERO_INVALIDE' : 'INTROUVABLE',
          fiche.formatInvalide
            ? 'Numéro mal formé (caractère de contrôle incorrect)'
            : 'Aucun document archivé ne porte ce numéro',
        );
      }
      res.set('Cache-Control', 'no-cache').json({ document: fiche });
    },
  );

  routeur.post(
    '/v1/documents/:numero/verification',
    verification,
    valider({
      params: schemaNumero,
      body: z.object({
        empreinteSha256: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Empreinte SHA-256 attendue'),
      }),
    }),
    async (req, res) => {
      res.json(await verifierEmpreinte(req.valide.params.numero, req.valide.body.empreinteSha256));
    },
  );

  // --- Duplicata ---------------------------------------------------------------------

  routeur.get(
    '/etablissements',
    verification,
    valider({ query: z.object({ q: z.string().trim().max(100).optional() }) }),
    async (req, res) => {
      res.json(await rechercherEtablissements(req.valide.query.q));
    },
  );

  routeur.post(
    '/duplicata',
    limiterDuplicata(limiteDuplicata),
    valider({ body: schemaDemandeDuplicata }),
    async (req, res) => {
      res.status(201).json(await deposerDemande(req.valide.body));
    },
  );

  routeur.post(
    '/duplicata/suivi',
    limiterSuivi(Math.max(20, limiteVerification / 3)),
    valider({ body: z.object({ numeroSuivi: z.string().max(40), telephone: schemaTelephone }) }),
    async (req, res) => {
      res
        .set('Cache-Control', 'no-store')
        .json(await suivreDemande(req.valide.body.numeroSuivi, req.valide.body.telephone));
    },
  );

  routeur.get(
    '/duplicata/telechargement/:jeton',
    verification,
    valider({ params: z.object({ jeton: z.string().max(1000) }) }),
    async (req, res) => {
      envoyerPdfArchive(res, await telechargerDuplicata(req.valide.params.jeton), {
        telechargement: true,
      });
    },
  );

  // --- Activation d'un compte parent ------------------------------------------------

  routeur.post(
    '/parents/activation',
    limiterActivation(limiteActivation),
    valider({
      body: z.object({
        identifiantEleve: z.string().trim().min(10).max(20),
        dateNaissance: z.coerce.date('Date invalide'),
        telephone: schemaTelephone,
        nom: texte(100),
        prenoms: texte(150),
        lien: z.enum(['PERE', 'MERE', 'TUTEUR', 'AUTRE']),
        motDePasse: schemaMotDePasse,
      }),
    }),
    async (req, res) => {
      res.status(201).json(await activerCompteParent(req.valide.body, { adresseIp: req.ip }));
    },
  );

  return routeur;
}
