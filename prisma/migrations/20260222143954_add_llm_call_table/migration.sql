-- AlterTable
ALTER TABLE "User" ALTER COLUMN "trialEndsAt" SET DEFAULT now() + interval '7 days';

-- CreateTable
CREATE TABLE "LlmCall" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "model" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LlmCall_calledAt_idx" ON "LlmCall"("calledAt");

-- CreateIndex
CREATE INDEX "LlmCall_purpose_idx" ON "LlmCall"("purpose");
