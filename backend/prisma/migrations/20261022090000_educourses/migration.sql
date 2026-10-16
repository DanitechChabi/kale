-- EduCourses : programmes nationaux, leçons, profils d'apprenants, progression, abonnements.
-- NB : « prisma migrate diff » propose de supprimer l'index programmes_matieres_unique
-- (NULLS NOT DISTINCT, inconnu de Prisma) : cette ligne a été retirée volontairement.

-- CreateEnum
CREATE TYPE "ConfianceProgramme" AS ENUM ('OFFICIEL', 'RECOUPE', 'RECONSTITUE');

-- CreateEnum
CREATE TYPE "StatutAbonnement" AS ENUM ('EN_ATTENTE', 'ACTIF', 'ECHEC');

-- CreateTable
CREATE TABLE "ec_programmes" (
    "id" UUID NOT NULL,
    "cle" VARCHAR(120) NOT NULL,
    "niveau" "Niveau" NOT NULL,
    "series" VARCHAR(5)[],
    "matiere_code" VARCHAR(40) NOT NULL,
    "nom_matiere" VARCHAR(150) NOT NULL,
    "confiance" "ConfianceProgramme" NOT NULL,
    "sources" JSONB NOT NULL,
    "est_verifie" BOOLEAN NOT NULL DEFAULT false,
    "ordre" SMALLINT NOT NULL DEFAULT 0,
    "maj_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ec_programmes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ec_chapitres" (
    "id" UUID NOT NULL,
    "programme_id" UUID NOT NULL,
    "ordre" SMALLINT NOT NULL,
    "titre" VARCHAR(250) NOT NULL,

    CONSTRAINT "ec_chapitres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ec_lecons" (
    "id" UUID NOT NULL,
    "chapitre_id" UUID NOT NULL,
    "ordre" SMALLINT NOT NULL,
    "titre" VARCHAR(250) NOT NULL,
    "objectifs" VARCHAR(300)[],
    "duree" SMALLINT,
    "contenu_html" TEXT,
    "exercices" JSONB,
    "quiz" JSONB,
    "empreinte" CHAR(64),
    "redigee_le" TIMESTAMPTZ(3),

    CONSTRAINT "ec_lecons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ec_profils" (
    "id" UUID NOT NULL,
    "titulaire_id" UUID NOT NULL,
    "eleve_id" UUID,
    "prenom" VARCHAR(100) NOT NULL,
    "niveau" "Niveau" NOT NULL,
    "serie" VARCHAR(5),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ec_profils_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ec_progressions" (
    "id" UUID NOT NULL,
    "profil_id" UUID NOT NULL,
    "lecon_id" UUID NOT NULL,
    "terminee_le" TIMESTAMPTZ(3),
    "meilleur_score" SMALLINT,
    "dernier_score" SMALLINT,
    "tentatives" SMALLINT NOT NULL DEFAULT 0,
    "maj_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ec_progressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ec_abonnements" (
    "id" UUID NOT NULL,
    "titulaire_id" UUID NOT NULL,
    "statut" "StatutAbonnement" NOT NULL DEFAULT 'EN_ATTENTE',
    "debut" TIMESTAMPTZ(3),
    "fin" TIMESTAMPTZ(3),
    "montant_fcfa" INTEGER NOT NULL,
    "fournisseur" VARCHAR(30) NOT NULL,
    "reference" VARCHAR(100) NOT NULL,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ec_abonnements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ec_programmes_cle_key" ON "ec_programmes"("cle");

-- CreateIndex
CREATE INDEX "ec_programmes_niveau_idx" ON "ec_programmes"("niveau");

-- CreateIndex
CREATE UNIQUE INDEX "ec_chapitres_programme_id_ordre_key" ON "ec_chapitres"("programme_id", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "ec_lecons_chapitre_id_ordre_key" ON "ec_lecons"("chapitre_id", "ordre");

-- CreateIndex
CREATE INDEX "ec_profils_titulaire_id_idx" ON "ec_profils"("titulaire_id");

-- CreateIndex
CREATE UNIQUE INDEX "ec_profils_titulaire_id_eleve_id_key" ON "ec_profils"("titulaire_id", "eleve_id");

-- CreateIndex
CREATE UNIQUE INDEX "ec_progressions_profil_id_lecon_id_key" ON "ec_progressions"("profil_id", "lecon_id");

-- CreateIndex
CREATE UNIQUE INDEX "ec_abonnements_reference_key" ON "ec_abonnements"("reference");

-- CreateIndex
CREATE INDEX "ec_abonnements_titulaire_id_idx" ON "ec_abonnements"("titulaire_id");

-- AddForeignKey
ALTER TABLE "ec_chapitres" ADD CONSTRAINT "ec_chapitres_programme_id_fkey" FOREIGN KEY ("programme_id") REFERENCES "ec_programmes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ec_lecons" ADD CONSTRAINT "ec_lecons_chapitre_id_fkey" FOREIGN KEY ("chapitre_id") REFERENCES "ec_chapitres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ec_profils" ADD CONSTRAINT "ec_profils_titulaire_id_fkey" FOREIGN KEY ("titulaire_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ec_progressions" ADD CONSTRAINT "ec_progressions_profil_id_fkey" FOREIGN KEY ("profil_id") REFERENCES "ec_profils"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ec_progressions" ADD CONSTRAINT "ec_progressions_lecon_id_fkey" FOREIGN KEY ("lecon_id") REFERENCES "ec_lecons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ec_abonnements" ADD CONSTRAINT "ec_abonnements_titulaire_id_fkey" FOREIGN KEY ("titulaire_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------- Règles d'intégrité ------------------------------------------------
ALTER TABLE "ec_progressions" ADD CONSTRAINT "ec_progressions_scores"
  CHECK (("meilleur_score" IS NULL OR "meilleur_score" BETWEEN 0 AND 100)
     AND ("dernier_score" IS NULL OR "dernier_score" BETWEEN 0 AND 100));
ALTER TABLE "ec_abonnements" ADD CONSTRAINT "ec_abonnements_montant" CHECK ("montant_fcfa" > 0);
ALTER TABLE "ec_abonnements" ADD CONSTRAINT "ec_abonnements_periode"
  CHECK ("statut" <> 'ACTIF' OR ("debut" IS NOT NULL AND "fin" > "debut"));
-- Une série n'existe qu'au second cycle
ALTER TABLE "ec_profils" ADD CONSTRAINT "ec_profils_serie"
  CHECK ("serie" IS NULL OR "niveau" IN ('SECONDE', 'PREMIERE', 'TERMINALE'));
