import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSupportedLanguageCodes } from "@/lib/languages";

const updateSettingsSchema = z.object({
  characterSet: z.enum(["TRADITIONAL", "SIMPLIFIED"]).optional(),
  targetLanguage: z.string().optional(),
  languageVariant: z.string().nullable().optional(),
}).refine(
  (data) => {
    // Validate targetLanguage is a supported code if provided
    if (data.targetLanguage) {
      return getSupportedLanguageCodes().includes(data.targetLanguage);
    }
    return true;
  },
  { message: "Unsupported target language", path: ["targetLanguage"] }
);

/**
 * GET /api/user/settings
 * Returns the current user's settings.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const limited = await checkRateLimit("flashcard", userId);
  if (limited) return limited;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      characterSet: true,
      targetLanguage: true,
      languageVariant: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    characterSet: user.characterSet,
    targetLanguage: user.targetLanguage,
    languageVariant: user.languageVariant,
  });
}

/**
 * PUT /api/user/settings
 * Updates the user's settings (characterSet, targetLanguage, languageVariant).
 */
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await checkRateLimit("flashcard", session.user.id);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Build update data — only include fields that were provided
  const updateData: Record<string, unknown> = {};
  if (parsed.data.characterSet !== undefined) {
    updateData.characterSet = parsed.data.characterSet;
  }
  if (parsed.data.targetLanguage !== undefined) {
    updateData.targetLanguage = parsed.data.targetLanguage;
  }
  if (parsed.data.languageVariant !== undefined) {
    updateData.languageVariant = parsed.data.languageVariant;
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: updateData,
    select: {
      characterSet: true,
      targetLanguage: true,
      languageVariant: true,
    },
  });

  return NextResponse.json({
    characterSet: updated.characterSet,
    targetLanguage: updated.targetLanguage,
    languageVariant: updated.languageVariant,
  });
}
