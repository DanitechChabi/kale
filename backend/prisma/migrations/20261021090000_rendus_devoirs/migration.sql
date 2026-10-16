-- Copies de devoirs rendues par les élèves (photos ou PDF).
-- NB : « prisma migrate diff » propose de supprimer l'index programmes_matieres_unique
-- (NULLS NOT DISTINCT, inconnu de Prisma) : cette ligne a été retirée volontairement.

-- CreateTable
CREATE TABLE "rendus_devoirs" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "devoir_id" UUID NOT NULL,
    "eleve_id" UUID NOT NULL,
    "commentaire" VARCHAR(500),
    "rend_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vu_le" TIMESTAMPTZ(3),
    "appreciation" VARCHAR(500),

    CONSTRAINT "rendus_devoirs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rendus_fichiers" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "rendu_id" UUID NOT NULL,
    "ordre" SMALLINT NOT NULL,
    "nom_fichier" VARCHAR(255) NOT NULL,
    "chemin_fichier" VARCHAR(500) NOT NULL,
    "type_mime" VARCHAR(100) NOT NULL,
    "taille_octets" INTEGER NOT NULL,
    "empreinte_sha256" CHAR(64) NOT NULL,

    CONSTRAINT "rendus_fichiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rendus_devoirs_ecole_id_idx" ON "rendus_devoirs"("ecole_id");

-- CreateIndex
CREATE UNIQUE INDEX "rendus_devoirs_devoir_id_eleve_id_key" ON "rendus_devoirs"("devoir_id", "eleve_id");

-- CreateIndex
CREATE INDEX "rendus_fichiers_ecole_id_idx" ON "rendus_fichiers"("ecole_id");

-- CreateIndex
CREATE UNIQUE INDEX "rendus_fichiers_rendu_id_ordre_key" ON "rendus_fichiers"("rendu_id", "ordre");

-- AddForeignKey
ALTER TABLE "rendus_devoirs" ADD CONSTRAINT "rendus_devoirs_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendus_devoirs" ADD CONSTRAINT "rendus_devoirs_devoir_id_fkey" FOREIGN KEY ("devoir_id") REFERENCES "devoirs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendus_devoirs" ADD CONSTRAINT "rendus_devoirs_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendus_fichiers" ADD CONSTRAINT "rendus_fichiers_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendus_fichiers" ADD CONSTRAINT "rendus_fichiers_rendu_id_fkey" FOREIGN KEY ("rendu_id") REFERENCES "rendus_devoirs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Une copie compte de 1 à 5 pages ; les empreintes sont en hexadécimal
ALTER TABLE "rendus_fichiers" ADD CONSTRAINT "rendus_fichiers_ordre" CHECK ("ordre" BETWEEN 1 AND 5);
ALTER TABLE "rendus_fichiers" ADD CONSTRAINT "rendus_fichiers_empreinte_hex"
  CHECK ("empreinte_sha256" ~ '^[0-9a-f]{64}$');
