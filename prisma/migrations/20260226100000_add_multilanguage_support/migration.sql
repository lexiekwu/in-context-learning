-- Add multi-language support fields to User
ALTER TABLE "User" ADD COLUMN "targetLanguage" TEXT NOT NULL DEFAULT 'zh';
ALTER TABLE "User" ADD COLUMN "languageVariant" TEXT;

-- Make reading-related fields optional on ReviewLog
ALTER TABLE "ReviewLog" ALTER COLUMN "userPinyin" DROP NOT NULL;
ALTER TABLE "ReviewLog" ALTER COLUMN "pinyinCorrect" DROP NOT NULL;
