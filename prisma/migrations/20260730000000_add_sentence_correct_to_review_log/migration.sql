-- AlterTable
ALTER TABLE "ReviewLog" ADD COLUMN IF NOT EXISTS "sentenceCorrect" BOOLEAN NOT NULL DEFAULT false;
