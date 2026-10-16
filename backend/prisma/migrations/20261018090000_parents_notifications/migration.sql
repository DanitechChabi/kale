-- Espace parent : notifications SMS (file d'envoi) et réglages de l'établissement.
-- NB : « prisma migrate diff » propose de supprimer l'index programmes_matieres_unique
-- (NULLS NOT DISTINCT, inconnu de Prisma) : cette ligne a été retirée volontairement.

-- CreateEnum
CREATE TYPE "TypeNotification" AS ENUM ('ABSENCE', 'BULLETIN');

-- CreateEnum
CREATE TYPE "StatutNotification" AS ENUM ('EN_ATTENTE', 'ENVOI', 'ENVOYEE', 'ECHEC');

-- AlterTable
ALTER TABLE "ecoles" ADD COLUMN     "sms_absences" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sms_bulletins" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "eleve_id" UUID NOT NULL,
    "utilisateur_id" UUID,
    "telephone" VARCHAR(30) NOT NULL,
    "type" "TypeNotification" NOT NULL,
    "message" VARCHAR(480) NOT NULL,
    "statut" "StatutNotification" NOT NULL DEFAULT 'EN_ATTENTE',
    "cle_unicite" VARCHAR(200) NOT NULL,
    "fournisseur" VARCHAR(30),
    "id_externe" VARCHAR(100),
    "tentatives" SMALLINT NOT NULL DEFAULT 0,
    "derniere_erreur" VARCHAR(300),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envoyee_le" TIMESTAMPTZ(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_cle_unicite_key" ON "notifications"("cle_unicite");

-- CreateIndex
CREATE INDEX "notifications_ecole_id_cree_le_idx" ON "notifications"("ecole_id", "cree_le");

-- CreateIndex
CREATE INDEX "notifications_statut_idx" ON "notifications"("statut");

-- CreateIndex
CREATE INDEX "notifications_telephone_idx" ON "notifications"("telephone");

-- CreateIndex
CREATE INDEX "notifications_utilisateur_id_idx" ON "notifications"("utilisateur_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Règles d'intégrité ------------------------------------------------

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_telephone_format"
  CHECK ("telephone" ~ '^\+[0-9]{8,15}$');
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_date_envoi"
  CHECK ("statut" <> 'ENVOYEE' OR "envoyee_le" IS NOT NULL);

-- Un message envoyé fait foi : ni son contenu, ni son destinataire, ni son statut ne changent
CREATE FUNCTION proteger_notification_envoyee() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."statut" = 'ENVOYEE' THEN
      RAISE EXCEPTION 'Notification envoyée : suppression interdite'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."statut" = 'ENVOYEE' AND (
    NEW."statut" <> OLD."statut" OR NEW."message" <> OLD."message" OR NEW."telephone" <> OLD."telephone"
  ) THEN
    RAISE EXCEPTION 'Notification envoyée : modification interdite'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notifications_envoyees_protegees
  BEFORE UPDATE OR DELETE ON "notifications"
  FOR EACH ROW EXECUTE FUNCTION proteger_notification_envoyee();
