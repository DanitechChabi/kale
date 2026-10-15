-- Relevés archivés, duplicatas en ligne et stockage durable des fichiers en base.
-- NB : « prisma migrate diff » propose de supprimer l'index programmes_matieres_unique
-- (NULLS NOT DISTINCT, inconnu de Prisma) : cette ligne a été retirée volontairement.
-- Il ne connaît pas non plus releves_original_unique (index partiel) : même consigne.

-- AlterTable
ALTER TABLE "demandes_duplicata" ADD COLUMN     "date_naissance" DATE NOT NULL,
ADD COLUMN     "matricule_declare" VARCHAR(30),
ADD COLUMN     "nom_eleve" VARCHAR(100) NOT NULL,
ADD COLUMN     "numero_periode" SMALLINT,
ADD COLUMN     "prenoms_eleve" VARCHAR(150) NOT NULL;

-- CreateTable
CREATE TABLE "fichiers_stockes" (
    "cle" VARCHAR(500) NOT NULL,
    "contenu" BYTEA NOT NULL,
    "type_mime" VARCHAR(100) NOT NULL,
    "taille_octets" INTEGER NOT NULL,
    "empreinte_sha256" CHAR(64) NOT NULL,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fichiers_stockes_pkey" PRIMARY KEY ("cle")
);

-- ---------- Règles d'intégrité ------------------------------------------------

ALTER TABLE "demandes_duplicata" ADD CONSTRAINT "demandes_numero_periode"
  CHECK ("numero_periode" IS NULL OR "numero_periode" BETWEEN 1 AND 3);

-- Numéro public : B (bulletin) ou R (relevé annuel), année sur 2 chiffres,
-- 8 caractères aléatoires Crockford et un caractère de contrôle
ALTER TABLE "releves_archives" ADD CONSTRAINT "releves_numero_format"
  CHECK ("numero" ~ '^[BR][0-9]{2}[0-9A-HJKMNP-TV-Z]{9}$');
ALTER TABLE "releves_archives" ADD CONSTRAINT "releves_numero_selon_type"
  CHECK (left("numero", 1) = CASE "type" WHEN 'BULLETIN_PERIODE' THEN 'B' ELSE 'R' END);

-- Un seul document d'origine par élève et par période (ou par année) ; les
-- corrections s'enchaînent ensuite une à une (remplace_releve_id est unique) :
-- il existe donc toujours exactement un document en vigueur.
CREATE UNIQUE INDEX "releves_original_unique"
  ON "releves_archives" ("eleve_id", "type", "annee_scolaire_id", "periode_id") NULLS NOT DISTINCT
  WHERE "remplace_releve_id" IS NULL;

-- Une correction remplace un document du même élève, du même établissement et de la même période
CREATE FUNCTION verifier_correction_releve() RETURNS trigger AS $$
BEGIN
  IF NEW."remplace_releve_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "releves_archives" r
    WHERE r."id" = NEW."remplace_releve_id"
      AND r."ecole_id" = NEW."ecole_id"
      AND r."eleve_id" = NEW."eleve_id"
      AND r."type" = NEW."type"
      AND r."annee_scolaire_id" = NEW."annee_scolaire_id"
      AND r."periode_id" IS NOT DISTINCT FROM NEW."periode_id"
  ) THEN
    RAISE EXCEPTION 'Une correction doit remplacer un document du même élève et de la même période'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER releves_correction_coherente
  BEFORE INSERT ON "releves_archives"
  FOR EACH ROW EXECUTE FUNCTION verifier_correction_releve();

-- Fichiers stockés : jamais réécrits ; ceux des relevés archivés jamais supprimés
ALTER TABLE "fichiers_stockes" ADD CONSTRAINT "fichiers_empreinte_hex"
  CHECK ("empreinte_sha256" ~ '^[0-9a-f]{64}$');

CREATE FUNCTION proteger_fichier_stocke() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR OLD."cle" LIKE 'releves/%' THEN
    RAISE EXCEPTION 'Fichier stocké % : modification ou suppression interdite', OLD."cle"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fichiers_stockes_proteges
  BEFORE UPDATE OR DELETE ON "fichiers_stockes"
  FOR EACH ROW EXECUTE FUNCTION proteger_fichier_stocke();
