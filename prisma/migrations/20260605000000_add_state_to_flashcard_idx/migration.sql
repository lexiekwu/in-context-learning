-- DropIndex
DROP INDEX IF EXISTS "Flashcard_userId_language_due_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Flashcard_userId_language_state_due_idx" ON "Flashcard"("userId", "language", "state", "due");
