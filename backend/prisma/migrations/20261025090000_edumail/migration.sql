-- EduMail : comptes éducatifs des élèves (docs/edumail.md).
-- Prisma propose toujours de supprimer programmes_matieres_unique : ligne retirée.
-- Migration additive uniquement : aucune donnée existante n'est modifiée.

-- CreateEnum
CREATE TYPE "StatutEduMail" AS ENUM ('A_VERIFIER', 'EN_ATTENTE_CONSENTEMENT', 'EN_ATTENTE_DECISION', 'APPROUVE', 'EN_COURS', 'ERREUR', 'ACTIF', 'SUSPENDU', 'REFUSE', 'CLOTURE');

-- CreateEnum
CREATE TYPE "ModeConsentementEduMail" AS ENUM ('ESPACE_PARENT', 'ATTESTATION_ECRITE');

-- CreateEnum
CREATE TYPE "CategorieSignalementEduMail" AS ENUM ('IDENTITE', 'INSCRIPTION', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutSignalementEduMail" AS ENUM ('OUVERT', 'TRAITE', 'REJETE');

-- AlterTable
ALTER TABLE "ecoles" ADD COLUMN     "edumail_delegation_secretariat" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "edumail_identifiants" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "eleve_id" UUID NOT NULL,
    "partie_locale" VARCHAR(32) NOT NULL,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edumail_identifiants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edumail_comptes" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "eleve_id" UUID NOT NULL,
    "identifiant_id" UUID NOT NULL,
    "demandeur_id" UUID NOT NULL,
    "statut" "StatutEduMail" NOT NULL,
    "adresse" VARCHAR(255),
    "fournisseur" VARCHAR(30),
    "id_externe" VARCHAR(200),
    "simule" BOOLEAN NOT NULL DEFAULT false,
    "consentement_requis" BOOLEAN NOT NULL,
    "demande_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decision_par_id" UUID,
    "decision_le" TIMESTAMPTZ(3),
    "decision_par_delegation" BOOLEAN NOT NULL DEFAULT false,
    "motif_decision" VARCHAR(500),
    "active_le" TIMESTAMPTZ(3),
    "derniere_verification_le" TIMESTAMPTZ(3),
    "a_reexaminer" VARCHAR(40),
    "motif_suspension" VARCHAR(500),
    "motif_cloture" VARCHAR(500),
    "tentatives" SMALLINT NOT NULL DEFAULT 0,
    "derniere_erreur" VARCHAR(300),
    "verrou_le" TIMESTAMPTZ(3),
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "edumail_comptes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edumail_consentements" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "compte_id" UUID NOT NULL,
    "mode" "ModeConsentementEduMail" NOT NULL,
    "parent_id" UUID,
    "representant_nom" VARCHAR(200),
    "representant_lien" VARCHAR(30),
    "signe_le" DATE,
    "recueilli_par_id" UUID NOT NULL,
    "methode" VARCHAR(60) NOT NULL,
    "preuve_chemin" VARCHAR(500),
    "preuve_type" VARCHAR(50),
    "preuve_empreinte" CHAR(64),
    "valide_par_id" UUID,
    "valide_le" TIMESTAMPTZ(3),
    "retire_le" TIMESTAMPTZ(3),
    "retire_par_id" UUID,
    "motif_retrait" VARCHAR(500),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edumail_consentements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edumail_evenements" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "compte_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "statut_avant" "StatutEduMail",
    "statut_apres" "StatutEduMail",
    "auteur_id" UUID,
    "motif" VARCHAR(500),
    "details" JSONB,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edumail_evenements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edumail_signalements" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "eleve_id" UUID NOT NULL,
    "compte_id" UUID,
    "auteur_id" UUID NOT NULL,
    "categorie" "CategorieSignalementEduMail" NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "statut" "StatutSignalementEduMail" NOT NULL DEFAULT 'OUVERT',
    "reponse" VARCHAR(1000),
    "traite_par_id" UUID,
    "traite_le" TIMESTAMPTZ(3),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edumail_signalements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "edumail_identifiants_eleve_id_key" ON "edumail_identifiants"("eleve_id");

-- CreateIndex
CREATE UNIQUE INDEX "edumail_identifiants_partie_locale_key" ON "edumail_identifiants"("partie_locale");

-- CreateIndex
CREATE INDEX "edumail_identifiants_ecole_id_idx" ON "edumail_identifiants"("ecole_id");

-- CreateIndex
CREATE UNIQUE INDEX "edumail_comptes_adresse_key" ON "edumail_comptes"("adresse");

-- CreateIndex
CREATE INDEX "edumail_comptes_ecole_id_statut_idx" ON "edumail_comptes"("ecole_id", "statut");

-- CreateIndex
CREATE INDEX "edumail_comptes_eleve_id_idx" ON "edumail_comptes"("eleve_id");

-- CreateIndex
CREATE UNIQUE INDEX "edumail_comptes_fournisseur_id_externe_key" ON "edumail_comptes"("fournisseur", "id_externe");

-- CreateIndex
CREATE INDEX "edumail_consentements_ecole_id_idx" ON "edumail_consentements"("ecole_id");

-- CreateIndex
CREATE INDEX "edumail_consentements_compte_id_idx" ON "edumail_consentements"("compte_id");

-- CreateIndex
CREATE INDEX "edumail_evenements_ecole_id_cree_le_idx" ON "edumail_evenements"("ecole_id", "cree_le");

-- CreateIndex
CREATE INDEX "edumail_evenements_compte_id_cree_le_idx" ON "edumail_evenements"("compte_id", "cree_le");

-- CreateIndex
CREATE INDEX "edumail_signalements_ecole_id_statut_idx" ON "edumail_signalements"("ecole_id", "statut");

-- AddForeignKey
ALTER TABLE "edumail_identifiants" ADD CONSTRAINT "edumail_identifiants_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edumail_identifiants" ADD CONSTRAINT "edumail_identifiants_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edumail_comptes" ADD CONSTRAINT "edumail_comptes_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edumail_comptes" ADD CONSTRAINT "edumail_comptes_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edumail_comptes" ADD CONSTRAINT "edumail_comptes_identifiant_id_fkey" FOREIGN KEY ("identifiant_id") REFERENCES "edumail_identifiants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edumail_consentements" ADD CONSTRAINT "edumail_consentements_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edumail_consentements" ADD CONSTRAINT "edumail_consentements_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "edumail_comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edumail_evenements" ADD CONSTRAINT "edumail_evenements_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edumail_evenements" ADD CONSTRAINT "edumail_evenements_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "edumail_comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edumail_signalements" ADD CONSTRAINT "edumail_signalements_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edumail_signalements" ADD CONSTRAINT "edumail_signalements_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edumail_signalements" ADD CONSTRAINT "edumail_signalements_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "edumail_comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================================
-- Règles d'intégrité EduMail (dernière ligne de défense)
-- ============================================================================

-- Un seul dossier ouvert par élève (refusé ou clôturé : une nouvelle demande est possible)
CREATE UNIQUE INDEX "edumail_comptes_eleve_ouvert_unique"
  ON "edumail_comptes" ("eleve_id")
  WHERE "statut" NOT IN ('REFUSE', 'CLOTURE');

-- Un compte actif ou suspendu existe réellement chez un fournisseur
ALTER TABLE "edumail_comptes" ADD CONSTRAINT "edumail_compte_reel"
  CHECK ("statut" NOT IN ('ACTIF', 'SUSPENDU')
         OR ("adresse" IS NOT NULL AND "fournisseur" IS NOT NULL AND "id_externe" IS NOT NULL));
ALTER TABLE "edumail_comptes" ADD CONSTRAINT "edumail_adresse_minuscule"
  CHECK ("adresse" IS NULL OR "adresse" = lower("adresse"));
ALTER TABLE "edumail_comptes" ADD CONSTRAINT "edumail_refus_motive"
  CHECK ("statut" <> 'REFUSE' OR "motif_decision" IS NOT NULL);
ALTER TABLE "edumail_comptes" ADD CONSTRAINT "edumail_suspension_motivee"
  CHECK ("statut" <> 'SUSPENDU' OR "motif_suspension" IS NOT NULL);
ALTER TABLE "edumail_comptes" ADD CONSTRAINT "edumail_cloture_motivee"
  CHECK ("statut" <> 'CLOTURE' OR "motif_cloture" IS NOT NULL);
ALTER TABLE "edumail_identifiants" ADD CONSTRAINT "edumail_partie_locale_format"
  CHECK ("partie_locale" ~ '^[a-z0-9][a-z0-9.-]{2,31}$');

-- Une attestation écrite repose sur une preuve déposée et un signataire identifié
ALTER TABLE "edumail_consentements" ADD CONSTRAINT "edumail_consentement_justifie"
  CHECK (("mode" = 'ESPACE_PARENT' AND "parent_id" IS NOT NULL)
      OR ("mode" = 'ATTESTATION_ECRITE' AND "representant_nom" IS NOT NULL AND "signe_le" IS NOT NULL
          AND "preuve_chemin" IS NOT NULL AND "preuve_empreinte" IS NOT NULL));
-- La preuve est vérifiée par une autre personne que celle qui l'a saisie
ALTER TABLE "edumail_consentements" ADD CONSTRAINT "edumail_validation_independante"
  CHECK ("valide_par_id" IS NULL OR "valide_par_id" <> "recueilli_par_id");

-- Une partie locale n'est jamais réattribuée ni modifiée
CREATE TRIGGER edumail_identifiants_immuables
  BEFORE UPDATE OR DELETE ON "edumail_identifiants"
  FOR EACH ROW EXECUTE FUNCTION interdire_modification();

-- Historique en ajout seul
CREATE TRIGGER edumail_evenements_immuables
  BEFORE UPDATE OR DELETE ON "edumail_evenements"
  FOR EACH ROW EXECUTE FUNCTION interdire_modification();

-- Aucune suppression des dossiers ni des consentements (politique de conservation à valider)
CREATE FUNCTION interdire_suppression() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% : suppression interdite (politique de conservation non définie)', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER edumail_comptes_conserves
  BEFORE DELETE ON "edumail_comptes" FOR EACH ROW EXECUTE FUNCTION interdire_suppression();
CREATE TRIGGER edumail_consentements_conserves
  BEFORE DELETE ON "edumail_consentements" FOR EACH ROW EXECUTE FUNCTION interdire_suppression();

-- Adresse et identifiant fournisseur figés une fois attribués ; refus et clôture définitifs
CREATE FUNCTION proteger_compte_edumail() RETURNS trigger AS $$
BEGIN
  IF OLD."adresse" IS NOT NULL AND NEW."adresse" IS DISTINCT FROM OLD."adresse" THEN
    RAISE EXCEPTION 'edumail_comptes : une adresse attribuée ne peut pas être modifiée'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD."id_externe" IS NOT NULL AND NEW."id_externe" IS DISTINCT FROM OLD."id_externe" THEN
    RAISE EXCEPTION 'edumail_comptes : l''identifiant du fournisseur ne peut pas être modifié'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD."statut" IN ('CLOTURE', 'REFUSE') AND NEW."statut" IS DISTINCT FROM OLD."statut" THEN
    RAISE EXCEPTION 'edumail_comptes : un dossier clôturé ou refusé est définitif'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW."eleve_id" <> OLD."eleve_id" OR NEW."identifiant_id" <> OLD."identifiant_id"
     OR NEW."ecole_id" <> OLD."ecole_id" THEN
    RAISE EXCEPTION 'edumail_comptes : le titulaire d''un compte ne peut pas changer'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER edumail_comptes_proteges
  BEFORE UPDATE ON "edumail_comptes" FOR EACH ROW EXECUTE FUNCTION proteger_compte_edumail();

-- L'adresse est celle de l'identifiant du même élève
CREATE FUNCTION verifier_adresse_edumail() RETURNS trigger AS $$
DECLARE
  partie TEXT;
BEGIN
  SELECT "partie_locale" INTO partie FROM "edumail_identifiants"
    WHERE "id" = NEW."identifiant_id" AND "eleve_id" = NEW."eleve_id";
  IF partie IS NULL THEN
    RAISE EXCEPTION 'edumail_comptes : identifiant d''un autre élève'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW."adresse" IS NOT NULL AND split_part(NEW."adresse", '@', 1) <> partie THEN
    RAISE EXCEPTION 'edumail_comptes : l''adresse ne correspond pas à l''identifiant de l''élève'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER edumail_comptes_adresse
  BEFORE INSERT OR UPDATE ON "edumail_comptes" FOR EACH ROW EXECUTE FUNCTION verifier_adresse_edumail();
