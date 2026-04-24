#!/usr/bin/env tsx
/**
 * Live smoke test of the Gemini migration.
 *
 * Usage:
 *   GEMINI_API_KEY=<key> npx tsx scripts/gemini-smoke-test.ts
 *
 * Exercises the three LLM call sites (sentence generation, translation check,
 * AI card creation) via the same `callLLM` wrapper the real routes use. This
 * is the fastest way to verify the first-party Gemini wiring works without
 * spinning up a Next.js server + auth + DB.
 */

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey.startsWith("your")) {
  console.error("GEMINI_API_KEY not set. Get one at https://aistudio.google.com/apikey");
  process.exit(1);
}

const gemini = new GoogleGenAI({
  apiKey,
  httpOptions: { timeout: 10_000 },
});

async function callLLM<T>(opts: {
  systemMessage: string;
  userMessage: string;
  schema: z.ZodSchema<T>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const start = Date.now();
  const response = await gemini.models.generateContent({
    model: opts.model ?? "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: opts.userMessage }] }],
    config: {
      systemInstruction: opts.systemMessage,
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? 1000,
      responseMimeType: "application/json",
    },
  });
  const durationMs = Date.now() - start;
  console.log(`  → ${durationMs}ms | prompt=${response.usageMetadata?.promptTokenCount} completion=${response.usageMetadata?.candidatesTokenCount}`);

  const text = response.text;
  if (!text) throw new Error("Empty response");
  // Mirror stripCodeFences() in src/lib/llm/call.ts
  let cleaned = text.trim().replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace >= 0 && lastBrace < cleaned.length - 1) cleaned = cleaned.slice(0, lastBrace + 1);
  try {
    const parsed = JSON.parse(cleaned);
    return opts.schema.parse(parsed);
  } catch (err) {
    console.error("  RAW RESPONSE:", JSON.stringify(text));
    throw err;
  }
}

async function main() {
  // 1. Sentence generation
  console.log("1. Sentence generation (gemini-2.5-flash)");
  const sentenceSchema = z.object({
    sentence: z.string(),
    sentenceWithHighlight: z.string(),
    translation: z.string(),
    wordBreakdown: z.array(
      z.object({ word: z.string(), pinyin: z.string(), meaning: z.string() }),
    ),
  });
  const sentence = await callLLM({
    systemMessage:
      "You are a Mandarin Chinese tutor. Generate one natural traditional-Chinese sentence using the target word. Use numbered tones in pinyin (ni3hao3). Wrap the target word in <mark> tags in sentenceWithHighlight. Respond with JSON only.",
    userMessage:
      'Target word: 喜歡 (xi3huan1) meaning "to like". Generate JSON: { "sentence": ..., "sentenceWithHighlight": ..., "translation": ..., "wordBreakdown": [{ "word", "pinyin", "meaning" }] }',
    schema: sentenceSchema,
    maxTokens: 2000,
  });
  console.log("  ✓", JSON.stringify(sentence, null, 2).slice(0, 300));

  // 2. Translation check
  console.log("\n2. Translation check (gemini-2.5-flash, temp=0.1)");
  const checkSchema = z.object({ correct: z.boolean() });
  const check = await callLLM({
    systemMessage:
      'Grade if the target word meaning is reflected in the student\'s translation. Be lenient on grammar. Respond with JSON: {"correct": true} or {"correct": false}.',
    userMessage:
      'Chinese sentence: 我喜歡你\nReference translation: I like you\nStudent\'s translation: I love you\nTarget word: 喜歡\nTarget meaning: to like\nIs the target word reflected?',
    schema: checkSchema,
    temperature: 0.1,
  });
  console.log("  ✓", check);

  // 3. AI card creation
  console.log("\n3. AI card creation (gemini-2.5-flash, temp=0.5)");
  const cardSchema = z.object({
    word: z.string(),
    pinyin: z.string().optional(),
    meaning: z.string(),
    exampleSentence: z.string().optional(),
    exampleTranslation: z.string().optional(),
  });
  const card = await callLLM({
    systemMessage:
      "You create Chinese flashcards. Given an English input, produce the traditional Chinese word, numbered-tone pinyin, a brief meaning, and an example sentence. Respond with JSON only.",
    userMessage:
      'Input: "happy". Produce JSON: { "word", "pinyin", "meaning", "exampleSentence", "exampleTranslation" }',
    schema: cardSchema,
    temperature: 0.5,
    maxTokens: 300,
  });
  console.log("  ✓", card);

  console.log("\nAll three flows succeeded.");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
