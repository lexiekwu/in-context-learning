-- Add multi-language support fields to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "targetLanguage" TEXT NOT NULL DEFAULT 'zh';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "languageVariant" TEXT;

-- Backfill languageVariant from characterSet for existing users
UPDATE "User" SET "languageVariant" = UPPER("characterSet"::TEXT) WHERE "languageVariant" IS NULL AND "characterSet" IS NOT NULL;

-- Drop characterSet column (data preserved in languageVariant)
ALTER TABLE "User" DROP COLUMN IF EXISTS "characterSet";

-- Drop the CharacterSet enum type
DROP TYPE IF EXISTS "CharacterSet";

-- Flashcard: add language column
ALTER TABLE "Flashcard" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'zh';

-- Flashcard: rename pinyin -> reading and make nullable
ALTER TABLE "Flashcard" RENAME COLUMN "pinyin" TO "reading";
ALTER TABLE "Flashcard" ALTER COLUMN "reading" DROP NOT NULL;

-- Update unique constraint: (userId, word) -> (userId, word, language)
ALTER TABLE "Flashcard" DROP CONSTRAINT IF EXISTS "Flashcard_userId_word_key";
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_userId_word_language_key" UNIQUE ("userId", "word", "language");

-- Update index: (userId, due) -> (userId, language, due)
DROP INDEX IF EXISTS "Flashcard_userId_due_idx";
CREATE INDEX "Flashcard_userId_language_due_idx" ON "Flashcard"("userId", "language", "due");

-- ReviewLog: rename pinyin fields -> reading fields and make nullable
ALTER TABLE "ReviewLog" RENAME COLUMN "userPinyin" TO "userReading";
ALTER TABLE "ReviewLog" ALTER COLUMN "userReading" DROP NOT NULL;
ALTER TABLE "ReviewLog" RENAME COLUMN "pinyinCorrect" TO "readingCorrect";
ALTER TABLE "ReviewLog" ALTER COLUMN "readingCorrect" DROP NOT NULL;
