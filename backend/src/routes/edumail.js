// EduMail : /api/edumail (docs/edumail.md). Chaque bloc a ses propres contrôles d'accès.
//   /moi/*                         élève connecté
//   /parent/enfants/:eleveId/*     parent relié (lien contrôlé par accesEnfant)
//   /ecole/*                       direction et secrétariat de l'établissement (client isolé)
//   /national                      SUPER_ADMIN et MINISTERE (agrégats)
//   /avantages                     tout compte connecté
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config/env.js';
import { avantages } from '../contexts/edumail/avantages.js';
import {
  actionCompte,
  consentir,
  decider,
  definirDelegation,
  demander,
  detailDossier,
  enregistrerAttestation,
  listerSignalements,
  preuveConsentement,
  reinitialiserParEleve,
  reinitialiserParEtablissement,
  relancerCreation,
  retirerConsentementEtablissement,
  retirerConsentementParent,
  reverifier,
  signaler,
  statistiquesNationales,
  tableauEtablissement,
  terminerReexamen,
  traiterSignalement,
  validerAttestation,
  vueEleve,
  vueParent,
} from '../contexts/edumail/serviceEduMail.js';
import {
  authentifier,
  exigerEcoleVerifiee,
  exigerMotDePasseDefinitif,
  exigerRole,
} from '../middlewares/authentification.js';
import { limiterEduMail } from '../middlewares/limites.js';
import { recevoirFichierUnique } from '../middlewares/televersement.js';
import { valider } from '../middlewares/valider.js';
import { auteur, envoyerDocument, schemaId } from './aide.js';

const texte = (max) => z.string().trim().min(1, 'Champ obligatoire').max(max);
const motif = z.object({ motif: texte(500) });
// Un mot de passe temporaire ne doit rester dans aucun cache
const sansCache = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

export function creerRouteurEduMail({ limite = config.LIMITE_EDUMAIL } = {}) {
  const routeur = Router();
  const connecte = [authentifier, exigerMotDePasseDefinitif];
  const limiter = limiterEduMail(limite);

  routeur.get('/avantages', connecte, (_req, res) => res.json(avantages()));

  // --- Élève --------------------------------------------------------------------------
  const eleve = [...connecte, exigerRole('ELEVE'), exigerEcoleVerifiee];
  routeur.get('/moi', eleve, async (req, res) => res.json(await vueEleve(req.db, auteur(req))));
  routeur.post('/moi/demande', eleve, limiter, async (req, res) => {
    const r = await demander(req.db, auteur(req));
    res.status(r.deja ? 200 : 201).json(r);
  });
  routeur.post(
    '/moi/signalements',
    eleve,
    limiter,
    valider({
      body: z.object({
        categorie: z.enum(['IDENTITE', 'INSCRIPTION', 'AUTRE']),
        message: texte(1000),
      }),
    }),
    async (req, res) => res.status(201).json(await signaler(req.db, auteur(req), req.valide.body)),
  );
  routeur.post(
    '/moi/reinitialisation',
    eleve,
    limiter,
    sansCache,
    valider({ body: z.object({ motDePasse: z.string().min(1).max(200) }) }),
    async (req, res) =>
      res.json(await reinitialiserParEleve(req.db, auteur(req), req.valide.body.motDePasse)),
  );

  // --- Parent ---------------------------------------------------------------------------
  const parent = [...connecte, exigerRole('PARENT')];
  const enfant = valider({ params: z.object({ eleveId: z.uuid() }) });
  routeur.get('/parent/enfants/:eleveId', parent, enfant, async (req, res) =>
    res.json(await vueParent(req.utilisateur.id, req.valide.params.eleveId)),
  );
  routeur.put('/parent/enfants/:eleveId/consentement', parent, limiter, enfant, async (req, res) =>
    res.json(await consentir(auteur(req), req.valide.params.eleveId)),
  );
  routeur.delete(
    '/parent/enfants/:eleveId/consentement',
    parent,
    limiter,
    valider({
      params: z.object({ eleveId: z.uuid() }),
      body: z.object({ motif: z.string().trim().max(500).optional() }).optional(),
    }),
    async (req, res) =>
      res.json(
        await retirerConsentementParent(
          auteur(req),
          req.valide.params.eleveId,
          req.valide.body?.motif || undefined,
        ),
      ),
  );

  // --- Établissement ----------------------------------------------------------------------
  const ecole = [...connecte, exigerRole('ADMIN_ECOLE', 'SECRETARIAT'), exigerEcoleVerifiee];
  const dossier = valider({ params: schemaId });
  routeur.get(
    '/ecole',
    ecole,
    valider({
      query: z.object({
        statut: z
          .enum([
            'A_VERIFIER',
            'EN_ATTENTE_CONSENTEMENT',
            'EN_ATTENTE_DECISION',
            'APPROUVE',
            'EN_COURS',
            'ERREUR',
            'ACTIF',
            'SUSPENDU',
            'REFUSE',
            'CLOTURE',
          ])
          .optional(),
        reexaminer: z.stringbool().optional(),
      }),
    }),
    async (req, res) =>
      res.json(await tableauEtablissement(req.db, req.utilisateur, req.valide.query)),
  );
  routeur.put(
    '/ecole/delegation',
    ecole,
    valider({ body: z.object({ secretariat: z.boolean() }) }),
    async (req, res) => res.json(await definirDelegation(auteur(req), req.valide.body.secretariat)),
  );
  routeur.get(
    '/ecole/signalements',
    ecole,
    valider({ query: z.object({ statut: z.enum(['OUVERT', 'TRAITE', 'REJETE']).optional() }) }),
    async (req, res) => res.json(await listerSignalements(req.db, req.valide.query)),
  );
  routeur.patch(
    '/ecole/signalements/:id',
    ecole,
    valider({
      params: schemaId,
      body: z.object({ statut: z.enum(['TRAITE', 'REJETE']), reponse: texte(1000) }),
    }),
    async (req, res) =>
      res.json(
        await traiterSignalement(req.db, auteur(req), req.valide.params.id, req.valide.body),
      ),
  );
  routeur.get('/ecole/dossiers/:id', ecole, dossier, async (req, res) =>
    res.json(await detailDossier(req.db, req.utilisateur, req.valide.params.id)),
  );
  routeur.post(
    '/ecole/dossiers/:id/decision',
    ecole,
    valider({
      params: schemaId,
      body: z.object({ decision: z.enum(['APPROUVER', 'REFUSER']), motif: texte(500).optional() }),
    }),
    async (req, res) =>
      res.json(await decider(req.db, auteur(req), req.valide.params.id, req.valide.body)),
  );
  routeur.post('/ecole/dossiers/:id/creation', ecole, dossier, async (req, res) =>
    res.json(await relancerCreation(req.db, auteur(req), req.valide.params.id)),
  );
  routeur.post('/ecole/dossiers/:id/verification', ecole, dossier, async (req, res) =>
    res.json(await reverifier(req.db, auteur(req), req.valide.params.id)),
  );
  routeur.post(
    '/ecole/dossiers/:id/action',
    ecole,
    valider({
      params: schemaId,
      body: motif.extend({ action: z.enum(['SUSPENDRE', 'REACTIVER', 'CLOTURER']) }),
    }),
    async (req, res) =>
      res.json(await actionCompte(req.db, auteur(req), req.valide.params.id, req.valide.body)),
  );
  routeur.post(
    '/ecole/dossiers/:id/reexamen',
    ecole,
    valider({ params: schemaId, body: z.object({ note: texte(500) }) }),
    async (req, res) =>
      res.json(
        await terminerReexamen(req.db, auteur(req), req.valide.params.id, req.valide.body.note),
      ),
  );
  routeur.post(
    '/ecole/dossiers/:id/reinitialisation',
    ecole,
    limiter,
    dossier,
    sansCache,
    async (req, res) =>
      res.json(await reinitialiserParEtablissement(req.db, auteur(req), req.valide.params.id)),
  );
  routeur.post(
    '/ecole/dossiers/:id/consentements',
    ecole,
    recevoirFichierUnique(),
    valider({
      params: schemaId,
      body: z.object({
        representantNom: texte(200),
        representantLien: z.enum(['PERE', 'MERE', 'TUTEUR', 'AUTRE']),
        signeLe: z.iso
          .date('Date invalide (AAAA-MM-JJ)')
          .refine((d) => new Date(d) <= new Date(), 'Date future'),
      }),
    }),
    async (req, res) =>
      res
        .status(201)
        .json(
          await enregistrerAttestation(
            req.db,
            auteur(req),
            req.valide.params.id,
            req.valide.body,
            req.file,
          ),
        ),
  );
  const consentement = z.object({ id: z.uuid(), consentementId: z.uuid() });
  routeur.post(
    '/ecole/dossiers/:id/consentements/:consentementId/validation',
    ecole,
    valider({ params: consentement }),
    async (req, res) =>
      res.json(
        await validerAttestation(
          req.db,
          auteur(req),
          req.valide.params.id,
          req.valide.params.consentementId,
        ),
      ),
  );
  routeur.post(
    '/ecole/dossiers/:id/consentements/:consentementId/retrait',
    ecole,
    valider({ params: consentement, body: motif }),
    async (req, res) =>
      res.json(
        await retirerConsentementEtablissement(
          req.db,
          auteur(req),
          req.valide.params.id,
          req.valide.params.consentementId,
          req.valide.body.motif,
        ),
      ),
  );
  routeur.get(
    '/ecole/dossiers/:id/consentements/:consentementId/preuve',
    ecole,
    valider({ params: consentement }),
    async (req, res) =>
      envoyerDocument(
        res,
        await preuveConsentement(req.db, req.valide.params.id, req.valide.params.consentementId),
      ),
  );

  // --- Comptes nationaux -------------------------------------------------------------------
  routeur.get('/national', ...connecte, exigerRole('SUPER_ADMIN', 'MINISTERE'), async (req, res) =>
    res.json(await statistiquesNationales(req.utilisateur)),
  );

  return routeur;
}
