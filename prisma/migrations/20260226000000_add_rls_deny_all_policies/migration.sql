-- Add explicit deny-all RLS policies for defense-in-depth.
-- All app access goes through Prisma (postgres superuser, bypasses RLS).
-- These policies block any direct access via Supabase PostgREST (anon/authenticated roles)
-- and silence the Supabase Security Advisor "RLS Enabled No Policy" suggestions.

-- User table
CREATE POLICY "deny_all" ON "User" FOR ALL USING (false);

-- Flashcard table
CREATE POLICY "deny_all" ON "Flashcard" FOR ALL USING (false);

-- ReviewLog table
CREATE POLICY "deny_all" ON "ReviewLog" FOR ALL USING (false);

-- StudySession table
CREATE POLICY "deny_all" ON "StudySession" FOR ALL USING (false);

-- LlmCall table
CREATE POLICY "deny_all" ON "LlmCall" FOR ALL USING (false);

-- Prisma migrations table
CREATE POLICY "deny_all" ON "_prisma_migrations" FOR ALL USING (false);
