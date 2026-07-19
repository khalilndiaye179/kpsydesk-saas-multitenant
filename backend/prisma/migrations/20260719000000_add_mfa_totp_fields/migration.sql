-- AlterTable
ALTER TABLE "User" ADD COLUMN "mfaSecret" TEXT,
ADD COLUMN "mfaBackupCodes" TEXT[];
