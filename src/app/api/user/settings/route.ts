import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSupportedLanguageCodes } from "@/lib/languages";
import { getLanguageConfig } from "@/lib/languages/index";

const updateSettingsSchema = z.object({
  characterSet: z.enum(["TRADITIONAL", "SIMPLIFIED"]).optional(),
  targetLanguage: z.string().optional(),
  languageVariant: z.string().nullable().optional(),
}).refine(
  (data) => {
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
      targetLanguage: true,
      languageVariant: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Include language display info for client-side UI
  let langDisplay;
  try {
    const config = getLanguageConfig(user.targetLanguage);
    langDisplay = {
      name: config.name,
      isPhonetic: config.isPhonetic,
      exampleWord: config.exampleWord,
      exampleMeaning: config.exampleMeaning,
      readingSystemName: config.readingSystem?.name ?? null,
      readingPlaceholder: config.readingSystem?.placeholder ?? null,
      readingInstructions: config.readingSystem?.instructions ?? null,
    };
  } catch {
    langDisplay = {
      name: user.targetLanguage,
      isPhonetic: false,
      exampleWord: "",
      exampleMeaning: "",
      readingSystemName: null,
      readingPlaceholder: null,
      readingInstructions: null,
    };
  }

  return NextResponse.json({
    targetLanguage: user.targetLanguage,
    languageVariant: user.languageVariant,
    language: langDisplay,
  });
}

/**
 * PUT /api/user/settings
 * Updates the user's language and display preferences.
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

  const data: Record<string, unknown> = {};
  if (parsed.data.targetLanguage !== undefined) {
    data.targetLanguage = parsed.data.targetLanguage;
  }
  if (parsed.data.languageVariant !== undefined) {
    data.languageVariant = parsed.data.languageVariant;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No settings to update" },
      { status: 400 }
    );
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data,
    select: {
      targetLanguage: true,
      languageVariant: true,
    },
  });

  return NextResponse.json({
    targetLanguage: updated.targetLanguage,
    languageVariant: updated.languageVariant,
  });
}
