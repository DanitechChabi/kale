-- Récapitulatif mensuel des notes envoyé aux parents par SMS.
-- NB : « prisma migrate diff » propose de supprimer l'index programmes_matieres_unique
-- (NULLS NOT DISTINCT, inconnu de Prisma) : cette ligne a été retirée volontairement.

-- AlterEnum
ALTER TYPE "TypeNotification" ADD VALUE 'RECAP_NOTES';

-- AlterTable
ALTER TABLE "ecoles" ADD COLUMN     "sms_recap_notes" BOOLEAN NOT NULL DEFAULT true;
