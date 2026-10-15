-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'MINISTERE', 'ADMIN_ECOLE', 'SECRETARIAT', 'ENSEIGNANT', 'ELEVE', 'PARENT');

-- CreateEnum
CREATE TYPE "StatutEcole" AS ENUM ('PUBLIC', 'PRIVE_LAIC', 'PRIVE_CONFESSIONNEL');

-- CreateEnum
CREATE TYPE "TypeEtablissement" AS ENUM ('CEG', 'LYCEE', 'LYCEE_TECHNIQUE', 'COMPLEXE_SCOLAIRE');

-- CreateEnum
CREATE TYPE "OrdreEnseignement" AS ENUM ('GENERAL', 'TECHNIQUE');

-- CreateEnum
CREATE TYPE "StatutVerification" AS ENUM ('EN_ATTENTE', 'EN_EXAMEN', 'VERIFIEE', 'REJETEE', 'SUSPENDUE');

-- CreateEnum
CREATE TYPE "TypeDocumentEcole" AS ENUM ('AUTORISATION_CREATION_OUVERTURE', 'AUTORISATION_DIRIGER', 'ACTE_NOMINATION_CHEF', 'PIECE_IDENTITE_RESPONSABLE', 'LETTRE_MANDAT', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutDocument" AS ENUM ('EN_ATTENTE', 'ACCEPTE', 'REFUSE');

-- CreateEnum
CREATE TYPE "StatutPresence" AS ENUM ('PRESENT', 'ABSENT', 'RETARD');

-- CreateEnum
CREATE TYPE "TypePeriode" AS ENUM ('TRIMESTRE', 'SEMESTRE');

-- CreateEnum
CREATE TYPE "Niveau" AS ENUM ('SIXIEME', 'CINQUIEME', 'QUATRIEME', 'TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE');

-- CreateEnum
CREATE TYPE "Sexe" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "StatutInscription" AS ENUM ('INSCRIT', 'TRANSFERE', 'ABANDON', 'EXCLU');

-- CreateEnum
CREATE TYPE "LienParente" AS ENUM ('PERE', 'MERE', 'TUTEUR', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeEvaluation" AS ENUM ('INTERROGATION', 'DEVOIR', 'COMPOSITION');

-- CreateEnum
CREATE TYPE "TypeDocument" AS ENUM ('BULLETIN_PERIODE', 'RELEVE_ANNUEL');

-- CreateEnum
CREATE TYPE "StatutDemande" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'REJETEE', 'DELIVREE');

-- CreateEnum
CREATE TYPE "ActionAudit" AS ENUM ('CREATION', 'MODIFICATION', 'SUPPRESSION');

-- CreateTable
CREATE TABLE "departements" (
    "id" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "nom" VARCHAR(80) NOT NULL,

    CONSTRAINT "departements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communes" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(80) NOT NULL,
    "departement_id" UUID NOT NULL,

    CONSTRAINT "communes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series" (
    "id" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "libelle" VARCHAR(100) NOT NULL,
    "ordre" "OrdreEnseignement" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matieres_reference" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "nom_court" VARCHAR(20) NOT NULL,
    "ordre_affichage" SMALLINT NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "matieres_reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programmes_matieres" (
    "id" UUID NOT NULL,
    "niveau" "Niveau" NOT NULL,
    "serie_id" UUID,
    "matiere_reference_id" UUID NOT NULL,
    "coefficient" SMALLINT NOT NULL,
    "heures_hebdo" DECIMAL(3,1),
    "groupe_option" VARCHAR(30),
    "est_facultative" BOOLEAN NOT NULL DEFAULT false,
    "est_verifie" BOOLEAN NOT NULL DEFAULT false,
    "source" VARCHAR(255),

    CONSTRAINT "programmes_matieres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecoles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "nom" VARCHAR(200) NOT NULL,
    "sigle" VARCHAR(30),
    "statut" "StatutEcole" NOT NULL,
    "type" "TypeEtablissement" NOT NULL,
    "ordres" "OrdreEnseignement"[],
    "nom_chef_etablissement" VARCHAR(200),
    "commune_id" UUID NOT NULL,
    "adresse" VARCHAR(255),
    "telephone" VARCHAR(30),
    "email" VARCHAR(255),
    "type_periode" "TypePeriode" NOT NULL DEFAULT 'TRIMESTRE',
    "statut_verification" "StatutVerification" NOT NULL DEFAULT 'EN_ATTENTE',
    "verifiee_le" TIMESTAMPTZ(3),
    "verifiee_par_id" UUID,
    "motif_decision" VARCHAR(500),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ecoles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents_ecoles" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "type" "TypeDocumentEcole" NOT NULL,
    "reference_acte" VARCHAR(100),
    "date_acte" DATE,
    "nom_fichier" VARCHAR(255) NOT NULL,
    "chemin_fichier" VARCHAR(500) NOT NULL,
    "type_mime" VARCHAR(100) NOT NULL,
    "taille_octets" INTEGER NOT NULL,
    "empreinte_sha256" CHAR(64) NOT NULL,
    "statut" "StatutDocument" NOT NULL DEFAULT 'EN_ATTENTE',
    "commentaire" VARCHAR(500),
    "depose_par_id" UUID,
    "depose_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "examine_par_id" UUID,
    "examine_le" TIMESTAMPTZ(3),

    CONSTRAINT "documents_ecoles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" UUID NOT NULL,
    "ecole_id" UUID,
    "role" "Role" NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "prenoms" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255),
    "telephone" VARCHAR(30),
    "mot_de_passe_hash" VARCHAR(255) NOT NULL,
    "doit_changer_mot_de_passe" BOOLEAN NOT NULL DEFAULT true,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "derniere_connexion_le" TIMESTAMPTZ(3),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jetons_rafraichissement" (
    "id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "empreinte" CHAR(64) NOT NULL,
    "expire_le" TIMESTAMPTZ(3) NOT NULL,
    "revoque_le" TIMESTAMPTZ(3),
    "remplace_par_id" UUID,
    "agent_utilisateur" VARCHAR(255),
    "adresse_ip" VARCHAR(45),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jetons_rafraichissement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annees_scolaires" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "libelle" VARCHAR(9) NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "est_courante" BOOLEAN NOT NULL DEFAULT false,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annees_scolaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodes" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "annee_scolaire_id" UUID NOT NULL,
    "type" "TypePeriode" NOT NULL,
    "numero" SMALLINT NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "est_cloturee" BOOLEAN NOT NULL DEFAULT false,
    "cloturee_le" TIMESTAMPTZ(3),
    "cloturee_par_id" UUID,

    CONSTRAINT "periodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "annee_scolaire_id" UUID NOT NULL,
    "niveau" "Niveau" NOT NULL,
    "serie_id" UUID,
    "nom" VARCHAR(50) NOT NULL,
    "professeur_principal_id" UUID,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matieres" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "matiere_reference_id" UUID,
    "code" VARCHAR(20) NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "matieres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enseignements" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "classe_id" UUID NOT NULL,
    "matiere_id" UUID NOT NULL,
    "coefficient" SMALLINT NOT NULL,
    "heures_hebdo" DECIMAL(3,1),
    "groupe_option" VARCHAR(30),
    "est_facultative" BOOLEAN NOT NULL DEFAULT false,
    "enseignant_id" UUID,

    CONSTRAINT "enseignements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eleves" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "matricule" VARCHAR(30) NOT NULL,
    "npi" VARCHAR(20),
    "nom" VARCHAR(100) NOT NULL,
    "prenoms" VARCHAR(150) NOT NULL,
    "sexe" "Sexe" NOT NULL,
    "date_naissance" DATE NOT NULL,
    "lieu_naissance" VARCHAR(100),
    "utilisateur_id" UUID,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "eleves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liens_parent_eleve" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "parent_id" UUID NOT NULL,
    "eleve_id" UUID NOT NULL,
    "lien" "LienParente" NOT NULL,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liens_parent_eleve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscriptions" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "eleve_id" UUID NOT NULL,
    "classe_id" UUID NOT NULL,
    "annee_scolaire_id" UUID NOT NULL,
    "statut" "StatutInscription" NOT NULL DEFAULT 'INSCRIT',
    "redoublant" BOOLEAN NOT NULL DEFAULT false,
    "date_inscription" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "choix_options" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "inscription_id" UUID NOT NULL,
    "enseignement_id" UUID NOT NULL,

    CONSTRAINT "choix_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creneaux_emploi_du_temps" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "classe_id" UUID NOT NULL,
    "enseignement_id" UUID NOT NULL,
    "jour" SMALLINT NOT NULL,
    "heure_debut" TIME(0) NOT NULL,
    "heure_fin" TIME(0) NOT NULL,
    "salle" VARCHAR(50),
    "valide_du" DATE NOT NULL,
    "valide_au" DATE,

    CONSTRAINT "creneaux_emploi_du_temps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appels" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "classe_id" UUID NOT NULL,
    "creneau_id" UUID,
    "enseignement_id" UUID,
    "date" DATE NOT NULL,
    "heure_debut" TIME(0) NOT NULL,
    "fait_par_id" UUID NOT NULL,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presences" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "appel_id" UUID NOT NULL,
    "eleve_id" UUID NOT NULL,
    "statut" "StatutPresence" NOT NULL,
    "minutes_retard" SMALLINT,
    "justifiee" BOOLEAN NOT NULL DEFAULT false,
    "motif" VARCHAR(255),
    "justifiee_par_id" UUID,
    "justifiee_le" TIMESTAMPTZ(3),

    CONSTRAINT "presences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "enseignement_id" UUID NOT NULL,
    "periode_id" UUID NOT NULL,
    "type" "TypeEvaluation" NOT NULL,
    "libelle" VARCHAR(100) NOT NULL,
    "date" DATE NOT NULL,
    "bareme" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "cree_par_id" UUID NOT NULL,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "evaluation_id" UUID NOT NULL,
    "eleve_id" UUID NOT NULL,
    "valeur" DECIMAL(5,2),
    "absent" BOOLEAN NOT NULL DEFAULT false,
    "saisie_par_id" UUID NOT NULL,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "releves_archives" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "numero" VARCHAR(30) NOT NULL,
    "type" "TypeDocument" NOT NULL,
    "eleve_id" UUID NOT NULL,
    "annee_scolaire_id" UUID NOT NULL,
    "periode_id" UUID,
    "chemin_fichier" VARCHAR(500) NOT NULL,
    "empreinte_sha256" CHAR(64) NOT NULL,
    "taille_octets" INTEGER NOT NULL,
    "donnees" JSONB NOT NULL,
    "remplace_releve_id" UUID,
    "motif_correction" VARCHAR(500),
    "genere_par_id" UUID NOT NULL,
    "genere_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "releves_archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demandes_duplicata" (
    "id" UUID NOT NULL,
    "ecole_id" UUID NOT NULL,
    "numero_suivi" VARCHAR(30) NOT NULL,
    "eleve_id" UUID,
    "demandeur_id" UUID,
    "nom_demandeur" VARCHAR(250) NOT NULL,
    "telephone" VARCHAR(30) NOT NULL,
    "email" VARCHAR(255),
    "type_document" "TypeDocument" NOT NULL,
    "annee_scolaire_id" UUID,
    "libelle_annee" VARCHAR(9) NOT NULL,
    "classe_declaree" VARCHAR(50),
    "motif" VARCHAR(500),
    "statut" "StatutDemande" NOT NULL DEFAULT 'EN_ATTENTE',
    "motif_rejet" VARCHAR(500),
    "traite_par_id" UUID,
    "releve_id" UUID,
    "demande_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prise_en_charge_le" TIMESTAMPTZ(3),
    "cloture_le" TIMESTAMPTZ(3),

    CONSTRAINT "demandes_duplicata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_audit" (
    "id" UUID NOT NULL,
    "ecole_id" UUID,
    "utilisateur_id" UUID,
    "action" "ActionAudit" NOT NULL,
    "entite" VARCHAR(50) NOT NULL,
    "entite_id" UUID NOT NULL,
    "ancienne_valeur" JSONB,
    "nouvelle_valeur" JSONB,
    "adresse_ip" VARCHAR(45),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departements_code_key" ON "departements"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departements_nom_key" ON "departements"("nom");

-- CreateIndex
CREATE INDEX "communes_departement_id_idx" ON "communes"("departement_id");

-- CreateIndex
CREATE UNIQUE INDEX "communes_departement_id_nom_key" ON "communes"("departement_id", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "series_code_key" ON "series"("code");

-- CreateIndex
CREATE UNIQUE INDEX "matieres_reference_code_key" ON "matieres_reference"("code");

-- CreateIndex
CREATE INDEX "programmes_matieres_niveau_serie_id_idx" ON "programmes_matieres"("niveau", "serie_id");

-- CreateIndex
CREATE UNIQUE INDEX "ecoles_code_key" ON "ecoles"("code");

-- CreateIndex
CREATE INDEX "ecoles_commune_id_idx" ON "ecoles"("commune_id");

-- CreateIndex
CREATE INDEX "ecoles_statut_verification_idx" ON "ecoles"("statut_verification");

-- CreateIndex
CREATE INDEX "documents_ecoles_ecole_id_idx" ON "documents_ecoles"("ecole_id");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_telephone_key" ON "utilisateurs"("telephone");

-- CreateIndex
CREATE INDEX "utilisateurs_ecole_id_idx" ON "utilisateurs"("ecole_id");

-- CreateIndex
CREATE INDEX "utilisateurs_role_idx" ON "utilisateurs"("role");

-- CreateIndex
CREATE UNIQUE INDEX "jetons_rafraichissement_empreinte_key" ON "jetons_rafraichissement"("empreinte");

-- CreateIndex
CREATE INDEX "jetons_rafraichissement_utilisateur_id_idx" ON "jetons_rafraichissement"("utilisateur_id");

-- CreateIndex
CREATE INDEX "annees_scolaires_ecole_id_idx" ON "annees_scolaires"("ecole_id");

-- CreateIndex
CREATE UNIQUE INDEX "annees_scolaires_ecole_id_libelle_key" ON "annees_scolaires"("ecole_id", "libelle");

-- CreateIndex
CREATE INDEX "periodes_ecole_id_idx" ON "periodes"("ecole_id");

-- CreateIndex
CREATE UNIQUE INDEX "periodes_annee_scolaire_id_numero_key" ON "periodes"("annee_scolaire_id", "numero");

-- CreateIndex
CREATE INDEX "classes_ecole_id_idx" ON "classes"("ecole_id");

-- CreateIndex
CREATE UNIQUE INDEX "classes_annee_scolaire_id_nom_key" ON "classes"("annee_scolaire_id", "nom");

-- CreateIndex
CREATE INDEX "matieres_ecole_id_idx" ON "matieres"("ecole_id");

-- CreateIndex
CREATE UNIQUE INDEX "matieres_ecole_id_code_key" ON "matieres"("ecole_id", "code");

-- CreateIndex
CREATE INDEX "enseignements_ecole_id_idx" ON "enseignements"("ecole_id");

-- CreateIndex
CREATE INDEX "enseignements_enseignant_id_idx" ON "enseignements"("enseignant_id");

-- CreateIndex
CREATE UNIQUE INDEX "enseignements_classe_id_matiere_id_key" ON "enseignements"("classe_id", "matiere_id");

-- CreateIndex
CREATE UNIQUE INDEX "eleves_utilisateur_id_key" ON "eleves"("utilisateur_id");

-- CreateIndex
CREATE INDEX "eleves_npi_idx" ON "eleves"("npi");

-- CreateIndex
CREATE INDEX "eleves_ecole_id_nom_prenoms_idx" ON "eleves"("ecole_id", "nom", "prenoms");

-- CreateIndex
CREATE UNIQUE INDEX "eleves_ecole_id_matricule_key" ON "eleves"("ecole_id", "matricule");

-- CreateIndex
CREATE UNIQUE INDEX "eleves_ecole_id_npi_key" ON "eleves"("ecole_id", "npi");

-- CreateIndex
CREATE INDEX "liens_parent_eleve_ecole_id_idx" ON "liens_parent_eleve"("ecole_id");

-- CreateIndex
CREATE INDEX "liens_parent_eleve_eleve_id_idx" ON "liens_parent_eleve"("eleve_id");

-- CreateIndex
CREATE UNIQUE INDEX "liens_parent_eleve_parent_id_eleve_id_key" ON "liens_parent_eleve"("parent_id", "eleve_id");

-- CreateIndex
CREATE INDEX "inscriptions_ecole_id_idx" ON "inscriptions"("ecole_id");

-- CreateIndex
CREATE INDEX "inscriptions_classe_id_idx" ON "inscriptions"("classe_id");

-- CreateIndex
CREATE UNIQUE INDEX "inscriptions_eleve_id_annee_scolaire_id_key" ON "inscriptions"("eleve_id", "annee_scolaire_id");

-- CreateIndex
CREATE INDEX "choix_options_ecole_id_idx" ON "choix_options"("ecole_id");

-- CreateIndex
CREATE UNIQUE INDEX "choix_options_inscription_id_enseignement_id_key" ON "choix_options"("inscription_id", "enseignement_id");

-- CreateIndex
CREATE INDEX "creneaux_emploi_du_temps_ecole_id_idx" ON "creneaux_emploi_du_temps"("ecole_id");

-- CreateIndex
CREATE INDEX "creneaux_emploi_du_temps_classe_id_jour_idx" ON "creneaux_emploi_du_temps"("classe_id", "jour");

-- CreateIndex
CREATE INDEX "appels_ecole_id_date_idx" ON "appels"("ecole_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "appels_classe_id_date_heure_debut_key" ON "appels"("classe_id", "date", "heure_debut");

-- CreateIndex
CREATE INDEX "presences_ecole_id_idx" ON "presences"("ecole_id");

-- CreateIndex
CREATE INDEX "presences_eleve_id_statut_idx" ON "presences"("eleve_id", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "presences_appel_id_eleve_id_key" ON "presences"("appel_id", "eleve_id");

-- CreateIndex
CREATE INDEX "evaluations_ecole_id_idx" ON "evaluations"("ecole_id");

-- CreateIndex
CREATE INDEX "evaluations_enseignement_id_periode_id_idx" ON "evaluations"("enseignement_id", "periode_id");

-- CreateIndex
CREATE INDEX "notes_ecole_id_idx" ON "notes"("ecole_id");

-- CreateIndex
CREATE INDEX "notes_eleve_id_idx" ON "notes"("eleve_id");

-- CreateIndex
CREATE UNIQUE INDEX "notes_evaluation_id_eleve_id_key" ON "notes"("evaluation_id", "eleve_id");

-- CreateIndex
CREATE UNIQUE INDEX "releves_archives_numero_key" ON "releves_archives"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "releves_archives_empreinte_sha256_key" ON "releves_archives"("empreinte_sha256");

-- CreateIndex
CREATE UNIQUE INDEX "releves_archives_remplace_releve_id_key" ON "releves_archives"("remplace_releve_id");

-- CreateIndex
CREATE INDEX "releves_archives_ecole_id_idx" ON "releves_archives"("ecole_id");

-- CreateIndex
CREATE INDEX "releves_archives_eleve_id_idx" ON "releves_archives"("eleve_id");

-- CreateIndex
CREATE UNIQUE INDEX "demandes_duplicata_numero_suivi_key" ON "demandes_duplicata"("numero_suivi");

-- CreateIndex
CREATE INDEX "demandes_duplicata_ecole_id_statut_idx" ON "demandes_duplicata"("ecole_id", "statut");

-- CreateIndex
CREATE INDEX "demandes_duplicata_demandeur_id_idx" ON "demandes_duplicata"("demandeur_id");

-- CreateIndex
CREATE INDEX "journal_audit_ecole_id_cree_le_idx" ON "journal_audit"("ecole_id", "cree_le");

-- CreateIndex
CREATE INDEX "journal_audit_entite_entite_id_idx" ON "journal_audit"("entite", "entite_id");

-- AddForeignKey
ALTER TABLE "communes" ADD CONSTRAINT "communes_departement_id_fkey" FOREIGN KEY ("departement_id") REFERENCES "departements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programmes_matieres" ADD CONSTRAINT "programmes_matieres_serie_id_fkey" FOREIGN KEY ("serie_id") REFERENCES "series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programmes_matieres" ADD CONSTRAINT "programmes_matieres_matiere_reference_id_fkey" FOREIGN KEY ("matiere_reference_id") REFERENCES "matieres_reference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecoles" ADD CONSTRAINT "ecoles_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecoles" ADD CONSTRAINT "ecoles_verifiee_par_id_fkey" FOREIGN KEY ("verifiee_par_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_ecoles" ADD CONSTRAINT "documents_ecoles_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_ecoles" ADD CONSTRAINT "documents_ecoles_depose_par_id_fkey" FOREIGN KEY ("depose_par_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_ecoles" ADD CONSTRAINT "documents_ecoles_examine_par_id_fkey" FOREIGN KEY ("examine_par_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jetons_rafraichissement" ADD CONSTRAINT "jetons_rafraichissement_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annees_scolaires" ADD CONSTRAINT "annees_scolaires_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodes" ADD CONSTRAINT "periodes_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodes" ADD CONSTRAINT "periodes_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "annees_scolaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodes" ADD CONSTRAINT "periodes_cloturee_par_id_fkey" FOREIGN KEY ("cloturee_par_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "annees_scolaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_serie_id_fkey" FOREIGN KEY ("serie_id") REFERENCES "series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_professeur_principal_id_fkey" FOREIGN KEY ("professeur_principal_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matieres" ADD CONSTRAINT "matieres_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matieres" ADD CONSTRAINT "matieres_matiere_reference_id_fkey" FOREIGN KEY ("matiere_reference_id") REFERENCES "matieres_reference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enseignements" ADD CONSTRAINT "enseignements_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enseignements" ADD CONSTRAINT "enseignements_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enseignements" ADD CONSTRAINT "enseignements_matiere_id_fkey" FOREIGN KEY ("matiere_id") REFERENCES "matieres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enseignements" ADD CONSTRAINT "enseignements_enseignant_id_fkey" FOREIGN KEY ("enseignant_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eleves" ADD CONSTRAINT "eleves_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eleves" ADD CONSTRAINT "eleves_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liens_parent_eleve" ADD CONSTRAINT "liens_parent_eleve_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liens_parent_eleve" ADD CONSTRAINT "liens_parent_eleve_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liens_parent_eleve" ADD CONSTRAINT "liens_parent_eleve_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "annees_scolaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choix_options" ADD CONSTRAINT "choix_options_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choix_options" ADD CONSTRAINT "choix_options_inscription_id_fkey" FOREIGN KEY ("inscription_id") REFERENCES "inscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choix_options" ADD CONSTRAINT "choix_options_enseignement_id_fkey" FOREIGN KEY ("enseignement_id") REFERENCES "enseignements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creneaux_emploi_du_temps" ADD CONSTRAINT "creneaux_emploi_du_temps_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creneaux_emploi_du_temps" ADD CONSTRAINT "creneaux_emploi_du_temps_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creneaux_emploi_du_temps" ADD CONSTRAINT "creneaux_emploi_du_temps_enseignement_id_fkey" FOREIGN KEY ("enseignement_id") REFERENCES "enseignements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appels" ADD CONSTRAINT "appels_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appels" ADD CONSTRAINT "appels_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appels" ADD CONSTRAINT "appels_creneau_id_fkey" FOREIGN KEY ("creneau_id") REFERENCES "creneaux_emploi_du_temps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appels" ADD CONSTRAINT "appels_enseignement_id_fkey" FOREIGN KEY ("enseignement_id") REFERENCES "enseignements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appels" ADD CONSTRAINT "appels_fait_par_id_fkey" FOREIGN KEY ("fait_par_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presences" ADD CONSTRAINT "presences_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presences" ADD CONSTRAINT "presences_appel_id_fkey" FOREIGN KEY ("appel_id") REFERENCES "appels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presences" ADD CONSTRAINT "presences_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presences" ADD CONSTRAINT "presences_justifiee_par_id_fkey" FOREIGN KEY ("justifiee_par_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_enseignement_id_fkey" FOREIGN KEY ("enseignement_id") REFERENCES "enseignements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "periodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_cree_par_id_fkey" FOREIGN KEY ("cree_par_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_saisie_par_id_fkey" FOREIGN KEY ("saisie_par_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releves_archives" ADD CONSTRAINT "releves_archives_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releves_archives" ADD CONSTRAINT "releves_archives_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releves_archives" ADD CONSTRAINT "releves_archives_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "annees_scolaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releves_archives" ADD CONSTRAINT "releves_archives_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "periodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releves_archives" ADD CONSTRAINT "releves_archives_genere_par_id_fkey" FOREIGN KEY ("genere_par_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releves_archives" ADD CONSTRAINT "releves_archives_remplace_releve_id_fkey" FOREIGN KEY ("remplace_releve_id") REFERENCES "releves_archives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_duplicata" ADD CONSTRAINT "demandes_duplicata_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_duplicata" ADD CONSTRAINT "demandes_duplicata_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_duplicata" ADD CONSTRAINT "demandes_duplicata_demandeur_id_fkey" FOREIGN KEY ("demandeur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_duplicata" ADD CONSTRAINT "demandes_duplicata_traite_par_id_fkey" FOREIGN KEY ("traite_par_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_duplicata" ADD CONSTRAINT "demandes_duplicata_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "annees_scolaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_duplicata" ADD CONSTRAINT "demandes_duplicata_releve_id_fkey" FOREIGN KEY ("releve_id") REFERENCES "releves_archives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- Règles métier garanties par la base (en plus des contrôles applicatifs)
-- =============================================================================

-- ---------- Contraintes de cohérence -----------------------------------------

-- Un compte d'établissement a une école ; ministère, super-admin et parent n'en ont pas
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_ecole_selon_role" CHECK (
  ("role" IN ('ADMIN_ECOLE', 'SECRETARIAT', 'ENSEIGNANT', 'ELEVE') AND "ecole_id" IS NOT NULL)
  OR ("role" IN ('SUPER_ADMIN', 'MINISTERE', 'PARENT') AND "ecole_id" IS NULL)
);
-- Au moins un identifiant de connexion
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_identifiant_requis"
  CHECK ("email" IS NOT NULL OR "telephone" IS NOT NULL);

ALTER TABLE "ecoles" ADD CONSTRAINT "ecoles_ordres_non_vide"
  CHECK (cardinality("ordres") > 0);
ALTER TABLE "ecoles" ADD CONSTRAINT "ecoles_motif_si_rejet"
  CHECK ("statut_verification" NOT IN ('REJETEE', 'SUSPENDUE') OR "motif_decision" IS NOT NULL);

ALTER TABLE "annees_scolaires" ADD CONSTRAINT "annees_scolaires_dates"
  CHECK ("date_fin" > "date_debut");
-- Une seule année courante par établissement
CREATE UNIQUE INDEX "annees_scolaires_une_courante" ON "annees_scolaires" ("ecole_id")
  WHERE "est_courante";

ALTER TABLE "periodes" ADD CONSTRAINT "periodes_numero"
  CHECK (("type" = 'TRIMESTRE' AND "numero" BETWEEN 1 AND 3) OR ("type" = 'SEMESTRE' AND "numero" BETWEEN 1 AND 2));
ALTER TABLE "periodes" ADD CONSTRAINT "periodes_dates" CHECK ("date_fin" > "date_debut");

-- Série obligatoire au second cycle, interdite au premier
ALTER TABLE "classes" ADD CONSTRAINT "classes_serie_selon_niveau" CHECK (
  ("niveau" IN ('SECONDE', 'PREMIERE', 'TERMINALE')) = ("serie_id" IS NOT NULL)
);
ALTER TABLE "programmes_matieres" ADD CONSTRAINT "programmes_serie_selon_niveau" CHECK (
  ("niveau" IN ('SECONDE', 'PREMIERE', 'TERMINALE')) = ("serie_id" IS NOT NULL)
);
-- Une matière une seule fois par (niveau, série), série vide comprise
CREATE UNIQUE INDEX "programmes_matieres_unique" ON "programmes_matieres"
  ("niveau", "serie_id", "matiere_reference_id") NULLS NOT DISTINCT;

ALTER TABLE "programmes_matieres" ADD CONSTRAINT "programmes_coefficient_positif" CHECK ("coefficient" > 0);
ALTER TABLE "enseignements" ADD CONSTRAINT "enseignements_coefficient_positif" CHECK ("coefficient" > 0);

ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_bareme_positif" CHECK ("bareme" > 0);
-- Une note est soit une valeur positive, soit une absence
ALTER TABLE "notes" ADD CONSTRAINT "notes_valeur_ou_absent" CHECK (
  ("absent" AND "valeur" IS NULL) OR (NOT "absent" AND "valeur" IS NOT NULL AND "valeur" >= 0)
);

ALTER TABLE "creneaux_emploi_du_temps" ADD CONSTRAINT "creneaux_jour" CHECK ("jour" BETWEEN 1 AND 6);
ALTER TABLE "creneaux_emploi_du_temps" ADD CONSTRAINT "creneaux_heures" CHECK ("heure_fin" > "heure_debut");
ALTER TABLE "creneaux_emploi_du_temps" ADD CONSTRAINT "creneaux_validite"
  CHECK ("valide_au" IS NULL OR "valide_au" >= "valide_du");

ALTER TABLE "presences" ADD CONSTRAINT "presences_retard" CHECK (
  ("statut" = 'RETARD') = ("minutes_retard" IS NOT NULL) AND ("minutes_retard" IS NULL OR "minutes_retard" > 0)
);

ALTER TABLE "releves_archives" ADD CONSTRAINT "releves_empreinte_hex"
  CHECK ("empreinte_sha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "releves_archives" ADD CONSTRAINT "releves_periode_selon_type"
  CHECK (("type" = 'BULLETIN_PERIODE') = ("periode_id" IS NOT NULL));
ALTER TABLE "releves_archives" ADD CONSTRAINT "releves_motif_si_correction"
  CHECK ("remplace_releve_id" IS NULL OR "motif_correction" IS NOT NULL);
ALTER TABLE "documents_ecoles" ADD CONSTRAINT "documents_empreinte_hex"
  CHECK ("empreinte_sha256" ~ '^[0-9a-f]{64}$');

ALTER TABLE "demandes_duplicata" ADD CONSTRAINT "demandes_motif_si_rejet"
  CHECK ("statut" <> 'REJETEE' OR "motif_rejet" IS NOT NULL);
ALTER TABLE "demandes_duplicata" ADD CONSTRAINT "demandes_releve_si_delivree"
  CHECK ("statut" <> 'DELIVREE' OR "releve_id" IS NOT NULL);

-- ---------- Tables en ajout seul ---------------------------------------------

CREATE FUNCTION interdire_modification() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% : les enregistrements de cette table ne peuvent être ni modifiés ni supprimés', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

-- Un relevé archivé n'est jamais modifié ni supprimé
CREATE TRIGGER releves_archives_immuables
  BEFORE UPDATE OR DELETE ON "releves_archives"
  FOR EACH ROW EXECUTE FUNCTION interdire_modification();

-- Le journal d'audit est en ajout seul
CREATE TRIGGER journal_audit_immuable
  BEFORE UPDATE OR DELETE ON "journal_audit"
  FOR EACH ROW EXECUTE FUNCTION interdire_modification();

-- ---------- Périodes clôturées ------------------------------------------------

-- Une clôture est définitive
CREATE FUNCTION verifier_cloture_definitive() RETURNS trigger AS $$
BEGIN
  IF OLD."est_cloturee" AND NOT NEW."est_cloturee" THEN
    RAISE EXCEPTION 'La période % est clôturée : elle ne peut pas être rouverte', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER periodes_cloture_definitive
  BEFORE UPDATE ON "periodes"
  FOR EACH ROW EXECUTE FUNCTION verifier_cloture_definitive();

-- Aucune évaluation ne peut être créée, modifiée ou supprimée dans une période clôturée
CREATE FUNCTION verifier_periode_ouverte_evaluation() RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND EXISTS (
    SELECT 1 FROM "periodes" WHERE "id" = OLD."periode_id" AND "est_cloturee"
  ) THEN
    RAISE EXCEPTION 'Période clôturée : évaluation non modifiable'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND EXISTS (
    SELECT 1 FROM "periodes" WHERE "id" = NEW."periode_id" AND "est_cloturee"
  ) THEN
    RAISE EXCEPTION 'Période clôturée : impossible d''y ajouter une évaluation'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evaluations_periode_ouverte
  BEFORE INSERT OR UPDATE OR DELETE ON "evaluations"
  FOR EACH ROW EXECUTE FUNCTION verifier_periode_ouverte_evaluation();

-- Notes : période ouverte obligatoire, valeur dans le barème
CREATE FUNCTION verifier_note() RETURNS trigger AS $$
DECLARE
  cloturee boolean;
  bareme_max numeric;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT p."est_cloturee" INTO cloturee
      FROM "evaluations" e JOIN "periodes" p ON p."id" = e."periode_id"
      WHERE e."id" = OLD."evaluation_id";
    IF cloturee THEN
      RAISE EXCEPTION 'Période clôturée : la note ne peut plus être modifiée'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT p."est_cloturee", e."bareme" INTO cloturee, bareme_max
      FROM "evaluations" e JOIN "periodes" p ON p."id" = e."periode_id"
      WHERE e."id" = NEW."evaluation_id";
    IF cloturee THEN
      RAISE EXCEPTION 'Période clôturée : impossible de saisir une note'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW."valeur" IS NOT NULL AND NEW."valeur" > bareme_max THEN
      RAISE EXCEPTION 'Note % supérieure au barème (%)', NEW."valeur", bareme_max
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_verification
  BEFORE INSERT OR UPDATE OR DELETE ON "notes"
  FOR EACH ROW EXECUTE FUNCTION verifier_note();
