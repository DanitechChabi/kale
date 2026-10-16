-- Emplois du temps, cours en ligne et devoirs.
-- NB : « prisma migrate diff » propose de supprimer l'index programmes_matieres_unique
-- (NULLS NOT DISTINCT, inconnu de Prisma) : cette ligne a été retirée volontairement.

-- CreateEnum
CREATE TYPE "TypeCours" AS ENUM ('DOCUMENT', 'VIDEO', 'LIEN');

-- CreateTable
CREATE TABLE "cours" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "enseignement_id" UUID NOT NULL,
    "auteur_id" UUID,
    "titre" VARCHAR(150) NOT NULL,
    "description" VARCHAR(2000),
    "type" "TypeCours" NOT NULL,
    "url" VARCHAR(500),
    "nom_fichier" VARCHAR(255),
    "chemin_fichier" VARCHAR(500),
    "type_mime" VARCHAR(100),
    "taille_octets" INTEGER,
    "empreinte_sha256" CHAR(64),
    "publie_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoirs" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "enseignement_id" UUID NOT NULL,
    "auteur_id" UUID,
    "titre" VARCHAR(150) NOT NULL,
    "consignes" VARCHAR(4000) NOT NULL,
    "pour_le" DATE NOT NULL,
    "nom_fichier" VARCHAR(255),
    "chemin_fichier" VARCHAR(500),
    "type_mime" VARCHAR(100),
    "taille_octets" INTEGER,
    "empreinte_sha256" CHAR(64),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "devoirs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoirs_faits" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "devoir_id" UUID NOT NULL,
    "eleve_id" UUID NOT NULL,
    "fait_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoirs_faits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cours_ecole_id_idx" ON "cours"("ecole_id");

-- CreateIndex
CREATE INDEX "cours_enseignement_id_publie_le_idx" ON "cours"("enseignement_id", "publie_le");

-- CreateIndex
CREATE INDEX "devoirs_ecole_id_idx" ON "devoirs"("ecole_id");

-- CreateIndex
CREATE INDEX "devoirs_enseignement_id_pour_le_idx" ON "devoirs"("enseignement_id", "pour_le");

-- CreateIndex
CREATE INDEX "devoirs_faits_ecole_id_idx" ON "devoirs_faits"("ecole_id");

-- CreateIndex
CREATE UNIQUE INDEX "devoirs_faits_devoir_id_eleve_id_key" ON "devoirs_faits"("devoir_id", "eleve_id");

-- AddForeignKey
ALTER TABLE "cours" ADD CONSTRAINT "cours_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cours" ADD CONSTRAINT "cours_enseignement_id_fkey" FOREIGN KEY ("enseignement_id") REFERENCES "enseignements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cours" ADD CONSTRAINT "cours_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoirs" ADD CONSTRAINT "devoirs_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoirs" ADD CONSTRAINT "devoirs_enseignement_id_fkey" FOREIGN KEY ("enseignement_id") REFERENCES "enseignements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoirs" ADD CONSTRAINT "devoirs_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoirs_faits" ADD CONSTRAINT "devoirs_faits_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoirs_faits" ADD CONSTRAINT "devoirs_faits_devoir_id_fkey" FOREIGN KEY ("devoir_id") REFERENCES "devoirs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoirs_faits" ADD CONSTRAINT "devoirs_faits_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------- Règles d'intégrité ------------------------------------------------

-- Un cours est soit un document déposé, soit un lien sécurisé (https)
ALTER TABLE "cours" ADD CONSTRAINT "cours_contenu_selon_type" CHECK (
  ("type" = 'DOCUMENT' AND "chemin_fichier" IS NOT NULL AND "url" IS NULL)
  OR ("type" <> 'DOCUMENT' AND "url" IS NOT NULL AND "chemin_fichier" IS NULL)
);
ALTER TABLE "cours" ADD CONSTRAINT "cours_url_https" CHECK ("url" IS NULL OR "url" ~ '^https://');
ALTER TABLE "cours" ADD CONSTRAINT "cours_empreinte_hex"
  CHECK ("empreinte_sha256" IS NULL OR "empreinte_sha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "devoirs" ADD CONSTRAINT "devoirs_empreinte_hex"
  CHECK ("empreinte_sha256" IS NULL OR "empreinte_sha256" ~ '^[0-9a-f]{64}$');

-- Une classe n'a jamais deux cours en même temps (créneaux valides aux mêmes dates)
CREATE FUNCTION verifier_creneau_libre() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "creneaux_emploi_du_temps" c
    WHERE c."classe_id" = NEW."classe_id"
      AND c."id" <> NEW."id"
      AND c."jour" = NEW."jour"
      AND c."heure_debut" < NEW."heure_fin"
      AND NEW."heure_debut" < c."heure_fin"
      AND c."valide_du" <= COALESCE(NEW."valide_au", 'infinity'::date)
      AND NEW."valide_du" <= COALESCE(c."valide_au", 'infinity'::date)
  ) THEN
    RAISE EXCEPTION 'La classe a déjà un cours sur ce créneau'
      USING ERRCODE = 'exclusion_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER creneaux_sans_chevauchement
  BEFORE INSERT OR UPDATE ON "creneaux_emploi_du_temps"
  FOR EACH ROW EXECUTE FUNCTION verifier_creneau_libre();
