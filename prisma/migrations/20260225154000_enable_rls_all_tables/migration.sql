-- Enable Row Level Security on all public tables.
-- Since all app access goes through Prisma (using the postgres superuser role,
-- which bypasses RLS), this effectively blocks unauthorized access via
-- Supabase's PostgREST API (anon/authenticated roles) with deny-all by default.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Flashcard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LlmCall" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
