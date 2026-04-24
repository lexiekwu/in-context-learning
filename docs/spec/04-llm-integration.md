# 04 — LLM Integration

This document specifies every LLM interaction in the app: prompts, schemas, cost model, error handling, caching, and security. A developer should be able to copy these prompts and schemas directly into the codebase.

---

## 1. LLM Call Specifications

The app makes exactly three types of LLM calls. Each is defined with its trigger, inputs, outputs, full prompt template, and configuration.

---

### Call 1: Sentence Generation

**Trigger:** A card is selected for review and no cached sentence exists for this card in the current session/day.

**Input:**

| Field | Type | Example |
|-------|------|---------|
| `targetWord` | string | `好` |
| `pinyin` | string | `hao3` |
| `meaning` | string | `good; well; to be fond of` |
| `userLevel` | `"beginner" \| "intermediate" \| "advanced"` | `"beginner"` |
| `characterSet` | `"traditional" \| "simplified"` | `"traditional"` |

`userLevel` is derived from the user's total flashcard count: beginner (<300 cards), intermediate (300–1500), advanced (>1500). `characterSet` is the user's preference from their profile. Both are computed server-side; the client does not send them.

**Output (JSON):**

```json
{
  "sentence": "你今天好嗎？",
  "sentenceWithHighlight": "你今天<mark>好</mark>嗎？",
  "translation": "Are you doing well today?",
  "wordBreakdown": [
    { "word": "你", "pinyin": "ni3", "meaning": "you" },
    { "word": "今天", "pinyin": "jin1tian1", "meaning": "today" },
    { "word": "好", "pinyin": "hao3", "meaning": "good/well" },
    { "word": "嗎", "pinyin": "ma0", "meaning": "(question particle)" }
  ]
}
```

**Configuration:**

| Setting | Value |
|---------|-------|
| Model | `gemini-2.5-flash` (Gemini API model ID) |
| Temperature | 0.7 |
| Max tokens | 500 |
| Streaming | No |
| Response format | Native JSON via `responseMimeType: "application/json"` |

**Full Prompt:**

**System message:**

```
You are a Mandarin Chinese language tutor that generates natural example sentences for vocabulary study.

Rules you MUST follow:
1. Use ONLY {{characterSet}} Chinese characters. If "traditional", use 繁體字 exclusively. If "simplified", use 简体字 exclusively. Never mix character sets.
2. Write pinyin in numbered tone format: ni3hao3, NOT nǐhǎo.
3. The neutral tone is tone 0 (e.g., 嗎 = ma0, 的 = de0).
4. Generate exactly ONE sentence that uses the target word naturally.
5. The sentence should sound like something a native speaker would actually say — conversational and natural, not textbook-stilted.
6. Other words in the sentence should be at or below the learner's level. Do NOT introduce obscure vocabulary.
7. Wrap the target word in <mark> tags in the sentenceWithHighlight field.
8. The wordBreakdown must segment the sentence into individual words (not characters, unless the word IS a single character). Every word in the sentence must appear in the breakdown, in order.
9. The translation should be natural English, not word-for-word.

Level guidelines:
- beginner: Use simple sentence structures (SVO). Max 6-8 words. Common daily vocabulary only.
- intermediate: Allow compound sentences, common idioms, richer vocabulary. Max 10-14 words.
- advanced: Natural complexity, idiomatic expressions, literary or formal register allowed. Max 18+ words.

Respond with valid JSON only. No markdown, no code fences, no extra text.
```

**User message template:**

```
Generate a sentence for a {{userLevel}}-level learner using this word. Use {{characterSet}} Chinese characters.

Word: {{targetWord}}
Pinyin: {{pinyin}}
Meaning: {{meaning}}

Respond with JSON in this exact format:
{
  "sentence": "<full sentence in traditional Chinese>",
  "sentenceWithHighlight": "<same sentence with target word wrapped in <mark> tags>",
  "translation": "<natural English translation>",
  "wordBreakdown": [
    { "word": "<Chinese word>", "pinyin": "<numbered pinyin>", "meaning": "<English meaning>" }
  ]
}
```

---

### Call 2: Translation Checking

**Trigger:** User submits their English translation of the generated sentence.

**Input:**

| Field | Type | Example |
|-------|------|---------|
| `chineseSentence` | string | `你今天好嗎？` |
| `correctTranslation` | string | `Are you doing well today?` |
| `userTranslation` | string | `Are you good today?` |
| `targetWord` | string | `好` |
| `targetMeaning` | string | `good; well; to be fond of` |

**Output (JSON):**

```json
{
  "correct": true,
  "explanation": "Your translation captures the meaning well. '好' here is used to ask about someone's well-being, and your translation reflects that.",
  "targetWordUsedCorrectly": true,
  "suggestedTranslation": "Are you doing well today?"
}
```

**Configuration:**

| Setting | Value |
|---------|-------|
| Model | `gemini-2.5-flash` (Gemini API model ID) |
| Temperature | 0.3 |
| Max tokens | 300 |
| Streaming | No |
| Response format | Native JSON via `responseMimeType: "application/json"` |

**Full Prompt:**

**System message:**

```
You are a Mandarin Chinese language tutor grading a student's English translation of a Chinese sentence.

Grading rules:
1. Be LENIENT on style, word choice, and phrasing. Accept reasonable synonyms and paraphrasing.
2. Be STRICT on meaning. The translation must convey the same core meaning as the original sentence.
3. Be ESPECIALLY strict about the target word. The student must demonstrate they understood what the target word means in this context.
4. If the student's translation is in Chinese or any language other than English, mark it incorrect and note the issue in the explanation.
5. Minor grammatical errors in the English are acceptable if the meaning is clear.
6. If the translation is partially correct (gets the gist but misses the target word's nuance), mark it incorrect but give an encouraging explanation.

Set "correct" to true only if:
- The overall sentence meaning is preserved (doesn't need to be word-for-word)
- The target word's meaning is correctly reflected in the translation

Always provide a "suggestedTranslation" — this should be the most natural, accurate English rendering of the Chinese sentence.

Respond with valid JSON only. No markdown, no code fences, no extra text.
```

**User message template:**

```
Grade this translation:

Chinese sentence: {{chineseSentence}}
Reference translation: {{correctTranslation}}
Student's translation: {{userTranslation}}

Target word: {{targetWord}}
Target word meaning: {{targetMeaning}}

Respond with JSON in this exact format:
{
  "correct": <true or false>,
  "explanation": "<brief, encouraging explanation of why the translation is correct or incorrect>",
  "targetWordUsedCorrectly": <true or false>,
  "suggestedTranslation": "<your best natural English translation>"
}
```

---

### Call 3: AI Card Creation

**Trigger:** User inputs a word or phrase (Chinese or English) to create a new flashcard.

**Input:**

| Field | Type | Example |
|-------|------|---------|
| `input` | string | `學習` or `to study` |
| `inputLanguage` | `"chinese" \| "english" \| "unknown"` | `"chinese"` |
| `contextSentence` | string \| null | `null` |
| `characterSet` | `"traditional" \| "simplified"` | `"traditional"` |

`inputLanguage` is auto-detected: if the string contains any CJK characters, it is `"chinese"`; if all ASCII, it is `"english"`; otherwise `"unknown"`. `characterSet` is the user's preference from their profile.

**Output (JSON):**

```json
{
  "word": "學習",
  "pinyin": "xue2xi2",
  "meaning": "to study; to learn",
  "exampleSentence": "我每天都在學習中文。",
  "exampleTranslation": "I study Chinese every day."
}
```

**Configuration:**

| Setting | Value |
|---------|-------|
| Model | `gemini-2.5-flash` (Gemini API model ID) |
| Temperature | 0.5 |
| Max tokens | 300 |
| Streaming | No |
| Response format | Native JSON via `responseMimeType: "application/json"` |

**Full Prompt:**

**System message:**

```
You are a Mandarin Chinese dictionary and flashcard assistant.

Rules you MUST follow:
1. Use ONLY {{characterSet}} Chinese characters. If "traditional", use 繁體字 exclusively. If "simplified", use 简体字 exclusively. Never mix character sets.
2. Write pinyin in numbered tone format: xue2xi2, NOT xuéxí. The neutral tone is tone 0.
3. If the user provides English, find the single most common/useful Chinese equivalent. Prefer the word a native Mandarin speaker would most naturally use.
4. If the user provides Chinese in a different character set than requested, convert to the requested set.
5. The "meaning" field should list the primary meanings separated by semicolons, starting with the most common usage. Keep it concise (max 3-4 meanings).
6. The example sentence should be simple and natural — something a textbook or native speaker would use.
7. The example sentence MUST use the target word.
8. If the user provides a context sentence, use it to disambiguate which meaning/word is intended.

Respond with valid JSON only. No markdown, no code fences, no extra text.
```

**User message template:**

```
Create a flashcard for:

Input: {{input}}
Input language: {{inputLanguage}}
Character set: {{characterSet}}
{{#if contextSentence}}Context: {{contextSentence}}{{/if}}

Respond with JSON in this exact format:
{
  "word": "<the word in {{characterSet}} Chinese>",
  "pinyin": "<numbered pinyin>",
  "meaning": "<English meanings separated by semicolons>",
  "exampleSentence": "<example sentence in traditional Chinese using the word>",
  "exampleTranslation": "<English translation of example sentence>"
}
```

---

## 2. Model Recommendation & Cost Analysis

### API Provider: Google Gemini API (first-party)

All LLM calls go through the **Google Gemini API** (Generative Language API, a.k.a. Google AI Studio) using the official `@google/genai` SDK.

**Why the first-party Gemini API:**

- First-party access to Gemini models with no gateway/middleman layer.
- Native JSON output mode (`responseMimeType: "application/json"`) for reliable structured responses.
- Straightforward per-token pricing, no subscription plans or points.
- Official SDK with built-in abort-signal, retries, and typed errors.

**Gemini API setup:**

```typescript
import { GoogleGenAI } from "@google/genai";

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
```

Obtain an API key at [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey).

### Primary Model: Gemini 2.5 Flash

**Model ID:** `gemini-2.5-flash`

- Strong multilingual capabilities, particularly for Chinese language tasks.
- Handles traditional/simplified Chinese characters and pinyin formatting reliably.
- Fast inference — suitable for interactive use.

### Fallback Model: Gemini 2.5 Pro

**Model ID:** `gemini-2.5-pro`

If Gemini 2.5 Flash produces quality issues (particularly for translation checking, where nuance matters most), the translation checking call can be upgraded to Gemini 2.5 Pro. This is a per-call `model` parameter change, not a global switch.

### Structured JSON Output

The Gemini API supports native JSON mode. All calls set `responseMimeType: "application/json"` in the request config, so the model returns valid JSON directly. As a safety net:

1. **Code-fence stripping:** A helper strips any stray markdown fences before `JSON.parse()` (rarely hit, but cheap insurance).
2. **Zod validation:** Every response is parsed and validated against a Zod schema (see Section 5).
3. **Retry on failure:** If parsing or validation fails, retry once. This is rare with native JSON mode.

### Cost Model

**Gemini pricing (USD per 1M tokens, ≤200K context tier):**

| Model | Input | Output |
|-------|-------|--------|
| Gemini 2.5 Flash | $0.30 | $2.50 |
| Gemini 2.5 Pro | $1.25 | $10.00 |

**Per-card token estimates:**

| Call | Input tokens | Output tokens |
|------|-------------|---------------|
| Sentence generation | ~500 | ~200 |
| Translation checking | ~400 | ~100 |
| **Total per card** | **~900** | **~300** |

Card creation is excluded from per-card cost since it only happens when the user manually creates a card (estimated 2-5 times/day).

**Cost per card review (Gemini 2.5 Flash):** ~$0.0011 (900 input × $0.30/M + 300 output × $2.50/M).

At 100 cards/day per active user, that's ~$0.11/user/day or ~$3.30/user/month.

**Cost optimization levers:**
- **Same-day sentence caching:** Reuse sentences for re-reviewed cards (see Section 4). Saves ~50% of LLM calls for users who fail cards.
- **Model selection:** Switch non-critical calls (e.g., AI card creation) to cheaper models like `gemini-2.5-flash-lite`.
- **Context caching:** For heavy system prompts, Gemini supports explicit context caching with a 90% input-token discount — worth investigating at scale.
- **Batch API:** 50% discount for non-interactive jobs (not applicable to the quiz flow, but useful for back-office tasks).

---

## 3. Error Handling

Every LLM call is wrapped in a resilient handler that addresses these failure modes:

| Failure | Detection | Recovery | User Experience |
|---------|-----------|----------|-----------------|
| **LLM timeout (>10s)** | Request timeout | Retry once. If retry fails, serve cached sentence (if available) or skip card. | Loading spinner after 3s shows "Taking longer than usual..." After 10s+retry fail: "Couldn't generate a sentence. Try again?" with retry button. |
| **Malformed JSON** | Zod schema validation fails | Retry once with identical prompt (transient issue). If second attempt fails, log and skip. | Transparent retry; user sees nothing unless both attempts fail. |
| **Wrong language returned** | Check that `sentence` field contains CJK characters; check `translation` field is ASCII/Latin | Retry once with an appended instruction: "IMPORTANT: The sentence MUST be in traditional Chinese characters." | Transparent retry. |
| **Rate limit (429)** | HTTP 429 status | Exponential backoff: 1s, 2s, 4s, max 3 retries. Queue subsequent requests. | "Lots of learners right now, please wait..." with auto-retry. |
| **API key invalid (401)** | HTTP 401 status | Log alert to admin (e.g., Sentry or PagerDuty). Disable LLM features gracefully. | "AI features temporarily unavailable. You can still review your cards." |
| **Network error** | `fetch` throws (no response) | Retry with backoff: 1s, 2s, 4s. | "Connection issue, retrying..." |
| **Content filter triggered** | API response `finish_reason: "content_filter"` or empty content | Log the input for review. Skip this card, advance to next. | "Couldn't generate content for this card. Moving to next one." |
| **Points exhausted** | HTTP 402 or account-level error | Log alert to admin. Disable LLM features gracefully until points are replenished. | "AI features temporarily unavailable. You can still review your cards." |

### Retry Implementation (pseudocode)

```typescript
import { GoogleGenAI } from "@google/genai";

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function callLLM<T>(
  config: LLMCallConfig,
  schema: z.ZodSchema<T>,
  maxRetries = 1
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await gemini.models.generateContent({
        model: config.model, // e.g. "gemini-2.5-flash"
        contents: [{ role: "user", parts: [{ text: config.userMessage }] }],
        config: {
          systemInstruction: config.systemMessage,
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens,
          responseMimeType: "application/json",
        },
      });

      const content = response.text;
      if (!content) throw new Error("Empty response from LLM");

      // Strip markdown code fences as a safety net — native JSON mode usually
      // prevents this, but a cheap fallback for occasional stray fences.
      const cleaned = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      return schema.parse(parsed); // Zod validation
    } catch (error) {
      if (attempt === maxRetries) throw error;
      if (isRateLimitError(error)) {
        await sleep(Math.pow(2, attempt) * 1000);
      }
      // Otherwise retry immediately
    }
  }
  throw new Error("LLM call failed after retries");
}
```

**Note on JSON parsing:** The Gemini API supports native JSON output via `responseMimeType: "application/json"`, so the model returns valid JSON directly. The code-fence-stripping step is kept as a cheap safety net for rare cases where stray fences slip through. Zod validation catches any remaining format issues.

---

## 4. Caching Strategy

### Same-Day Sentence Reuse

When a user gets a card wrong and it reappears later in the same session or same calendar day, the app reuses the previously generated sentence rather than calling the LLM again. This:

- Reduces cost (no duplicate generation).
- Improves learning (seeing the same sentence again reinforces the context).
- Eliminates confusion (a different sentence would feel like a new question).

**Implementation:** Store the generated sentence (full JSON response) in the `ReviewLog` table alongside the review entry. When a card comes up for review, first check if a `ReviewLog` entry exists for this card + user + today's date. If so, use the cached sentence.

```
ReviewLog {
  id
  userId
  cardId
  reviewedAt        // timestamp
  ...
  generatedSentence // JSON string — the full SentenceGenerationResponse
}
```

### No Cross-User Caching

Each sentence is generated uniquely per user per review. Shared caching across users is intentionally avoided because:

- Different users have different levels, so the same word should produce different-difficulty sentences.
- Shared sentences could be leaked or gamed (e.g., a user looks up the sentence externally).

### Word Breakdown Session Cache

The `wordBreakdown` array from sentence generation is cached in-memory (React state or context) for the duration of the quiz session. This powers the hover-to-save tooltip feature without re-parsing. It is discarded when the session ends.

### Cache Invalidation

Sentences are ephemeral. No long-term sentence cache is needed or desired. The only persistence is via `ReviewLog.generatedSentence` for same-day reuse. Old `ReviewLog` entries can have their `generatedSentence` field nulled out after 24 hours via a scheduled cleanup job (optional, for storage savings).

---

## 5. Response Validation (Zod Schemas)

All LLM responses are validated with Zod before use. If validation fails, the response is rejected and the retry logic kicks in.

```typescript
import { z } from "zod";

// ─── Shared ────────────────────────────────────────────────────────

const WordBreakdownItem = z.object({
  word: z.string().min(1, "Word must not be empty"),
  pinyin: z
    .string()
    .min(1)
    .regex(
      /^[a-z]+[0-5]?([a-z]+[0-5]?)*$/,
      "Pinyin must be in numbered format (e.g., ni3hao3)"
    ),
  meaning: z.string().min(1, "Meaning must not be empty"),
});

// ─── Call 1: Sentence Generation ───────────────────────────────────

const SentenceGenerationResponse = z.object({
  sentence: z
    .string()
    .min(2, "Sentence must contain at least 2 characters")
    .refine(
      (s) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(s),
      "Sentence must contain Chinese characters"
    ),
  sentenceWithHighlight: z
    .string()
    .refine(
      (s) => s.includes("<mark>") && s.includes("</mark>"),
      "Sentence must contain <mark> tags around the target word"
    ),
  translation: z
    .string()
    .min(2, "Translation must not be empty")
    .refine(
      (s) => /[a-zA-Z]/.test(s),
      "Translation must contain English text"
    ),
  wordBreakdown: z
    .array(WordBreakdownItem)
    .min(1, "Word breakdown must have at least one entry"),
});

type SentenceGenerationResponse = z.infer<typeof SentenceGenerationResponse>;

// ─── Call 2: Translation Checking ──────────────────────────────────

const TranslationCheckResponse = z.object({
  correct: z.boolean(),
  explanation: z
    .string()
    .min(5, "Explanation must be substantive")
    .max(500, "Explanation must not exceed 500 characters"),
  targetWordUsedCorrectly: z.boolean(),
  suggestedTranslation: z
    .string()
    .min(2, "Suggested translation must not be empty")
    .refine(
      (s) => /[a-zA-Z]/.test(s),
      "Suggested translation must contain English text"
    ),
});

type TranslationCheckResponse = z.infer<typeof TranslationCheckResponse>;

// ─── Call 3: AI Card Creation ──────────────────────────────────────

const AICardCreationResponse = z.object({
  word: z
    .string()
    .min(1, "Word must not be empty")
    .refine(
      (s) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(s),
      "Word must contain Chinese characters"
    ),
  pinyin: z
    .string()
    .min(1)
    .regex(
      /^[a-z]+[0-5]?([a-z]+[0-5]?)*$/,
      "Pinyin must be in numbered format (e.g., xue2xi2)"
    ),
  meaning: z
    .string()
    .min(1, "Meaning must not be empty")
    .max(200, "Meaning must not exceed 200 characters"),
  exampleSentence: z
    .string()
    .min(2)
    .refine(
      (s) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(s),
      "Example sentence must contain Chinese characters"
    ),
  exampleTranslation: z
    .string()
    .min(2)
    .refine(
      (s) => /[a-zA-Z]/.test(s),
      "Example translation must contain English text"
    ),
});

type AICardCreationResponse = z.infer<typeof AICardCreationResponse>;

export {
  SentenceGenerationResponse,
  TranslationCheckResponse,
  AICardCreationResponse,
  WordBreakdownItem,
};
```

### Validation Notes

- The pinyin regex `^[a-z]+[0-5]?([a-z]+[0-5]?)*$` matches single-syllable (`hao3`) and multi-syllable (`jin1tian1`) pinyin with optional tone numbers (neutral tone = 0, or omitted). It does not handle edge cases like `r0` (the retroflex suffix) or erhua — these can be added if needed.
- The CJK Unicode range `\u4e00-\u9fff\u3400-\u4dbf` covers CJK Unified Ideographs and Extension A, which includes all traditional characters in common use.
- Validation of traditional-vs-simplified is not done at the Zod level (it would require a dictionary). Instead, the system prompt handles this, and spot checks can be done via logging.

---

## 6. Streaming vs. Non-Streaming

All calls use **non-streaming mode**. The Gemini API does support streaming, but since all responses are JSON that must be fully parsed and Zod-validated before use, streaming provides no UX benefit.

| Call | Mode | Rationale |
|------|------|-----------|
| **Sentence generation** | Non-streaming (with loading skeleton) | Response is JSON that must be fully parsed before rendering the sentence. Show a pulsing skeleton placeholder while fetching, then render at once. Prefetch the next card's sentence in the background. |
| **Translation checking** | Non-streaming | Must parse full JSON to determine `correct: true/false` before showing feedback. |
| **AI card creation** | Non-streaming | Entire card must be validated before presenting to user. |

### Latency Mitigation

1. **Loading skeleton:** Show a pulsing placeholder in the sentence area immediately when a card starts loading.
2. **Prefetching:** When the user is reviewing card N, prefetch card N+1's sentence in the background. This hides latency for all but the first card.
3. **Caching:** Reuse previously generated sentences for same-day re-reviews (see Section 4).
4. **Timeout:** 10s timeout on all LLM calls. One automatic retry on timeout.

```typescript
// Prefetching: queue the next card's sentence while user reviews current card
async function prefetchNextSentence(sessionId: string): Promise<void> {
  const nextCard = await getNextCard(sessionId); // peek without consuming
  if (nextCard) {
    const cached = await getCachedSentence(nextCard.id);
    if (!cached) {
      const response = await callLLM(
        buildSentenceConfig(nextCard),
        SentenceGenerationResponse
      );
      await cacheSentenceResponse(nextCard.id, response);
    }
  }
}
```

---

## 7. Security Considerations

### API Key Protection

- **All LLM calls are server-side only.** The Gemini API key is stored in an environment variable (`GEMINI_API_KEY`) and never sent to the client. Obtain the key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
- LLM endpoints are Next.js Route Handlers (e.g., `/api/quiz/generate-sentence`), not client-side `fetch` calls to Google directly.

### Prompt Injection Prevention

User input is included in prompts in three places: the target word (Call 1), the user's translation (Call 2), and the card creation input (Call 3). Each is sanitized:

```typescript
function sanitizeForPrompt(input: string): string {
  // Strip any instruction-like patterns
  const stripped = input
    .replace(/```/g, "")           // Remove code fences
    .replace(/\n/g, " ")           // Flatten to single line
    .replace(/[{}]/g, "")          // Remove braces (JSON injection)
    .trim();

  // Truncate to reasonable length
  const maxLength = 500;
  return stripped.slice(0, maxLength);
}
```

Additionally, the system prompt is positioned first with strong instructions, and user input is clearly delimited as data (not instructions) in the user message.

### Rate Limiting

LLM API routes are rate-limited per authenticated user:

| Endpoint | Limit |
|----------|-------|
| `/api/quiz/generate-sentence` | 60 requests/min |
| `/api/quiz/check-translation` | 60 requests/min |
| `/api/flashcards/ai-create` | 20 requests/min |
| `/api/flashcards/quick-save` (when triggering LLM) | 20 requests/min |

Unauthenticated requests to LLM endpoints are rejected with 401.

Implementation: Use an in-memory rate limiter (e.g., `@upstash/ratelimit` with Redis, or a simple token bucket in-memory for single-server deployments).

### Cost Monitoring & Logging

Every LLM call is logged with:

| Field | Purpose |
|-------|---------|
| `userId` | Per-user cost tracking |
| `callType` | `"sentence" \| "translation" \| "card"` |
| `model` | Model used |
| `inputTokens` | From API response `usage.prompt_tokens` |
| `outputTokens` | From API response `usage.completion_tokens` |
| `latencyMs` | Wall-clock time for the call |
| `success` | Whether Zod validation passed |
| `timestamp` | When the call was made |

This data feeds a monitoring dashboard (or simple SQL queries) to track:

- Daily/monthly LLM spend.
- Per-user cost outliers.
- Error rates by call type.
- Latency percentiles (p50, p95, p99).

Set up alerts for:

- Daily spend exceeding 2x the expected amount.
- Error rate exceeding 5% over a 15-minute window.
- Any 401 (API key) errors.
