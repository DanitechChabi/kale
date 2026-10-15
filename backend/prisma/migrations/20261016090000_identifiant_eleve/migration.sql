-- Identifiant EduRelevé de l'élève et contact du parent ou tuteur.
-- NB : « prisma migrate diff » propose de supprimer l'index programmes_matieres_unique
-- (NULLS NOT DISTINCT, inconnu de Prisma) : cette ligne a été retirée volontairement.

ALTER TABLE "eleves" ADD COLUMN "identifiant" VARCHAR(10) NOT NULL,
ADD COLUMN "nom_contact_parent" VARCHAR(200),
ADD COLUMN "telephone_contact_parent" VARCHAR(30);

CREATE UNIQUE INDEX "eleves_identifiant_key" ON "eleves"("identifiant");

-- Format : 10 caractères de l'alphabet Crockford (sans I, L, O, U)
ALTER TABLE "eleves" ADD CONSTRAINT "eleves_identifiant_format"
  CHECK ("identifiant" ~ '^[0-9A-HJKMNP-TV-Z]{10}$');

-- Un élève peut n'avoir ni e-mail ni téléphone : il se connecte avec son identifiant EduRelevé
ALTER TABLE "utilisateurs" DROP CONSTRAINT "utilisateurs_identifiant_requis";
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_identifiant_requis"
  CHECK ("email" IS NOT NULL OR "telephone" IS NOT NULL OR "role" = 'ELEVE');
