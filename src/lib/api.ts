/**
 * Typed fetch wrappers for all quiz API endpoints.
 *
 * Each function handles JSON serialization, error handling, and returns
 * properly typed responses matching the shapes in src/types/index.ts.
 */

import type {
  StartSessionResponse,
  NextCardResponse,
  GenerateSentenceResponse,
  CheckTranslationResponse,
  CheckPinyinResponse,
  SubmitResultInput,
  SubmitResultResponse,
  TodayStatsResponse,
  FlashcardListResponse,
  FlashcardResponse,
  CreateFlashcardInput,
  UpdateFlashcardInput,
  AiCardSuggestionResponse,
  FlashcardExportResponse,
  CardState,
} from "@/types";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore parse failure
    }
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

/** POST /api/quiz/start — Initialize a new quiz session */
export function startSession(): Promise<StartSessionResponse> {
  return fetchJson<StartSessionResponse>("/api/quiz/start", {
    method: "POST",
  });
}

/** GET /api/quiz/next-card — Fetch the next due card for a session */
export function getNextCard(
  sessionId: string,
): Promise<NextCardResponse> {
  return fetchJson<NextCardResponse>(
    `/api/quiz/next-card?sessionId=${encodeURIComponent(sessionId)}`,
  );
}

/** POST /api/quiz/generate-sentence — Generate an LLM sentence for a card */
export function generateSentence(
  flashcardId: string,
): Promise<GenerateSentenceResponse> {
  return fetchJson<GenerateSentenceResponse>(
    "/api/quiz/generate-sentence",
    {
      method: "POST",
      body: JSON.stringify({ flashcardId }),
    },
  );
}

/** POST /api/quiz/check-translation — Have LLM grade a translation */
export function checkTranslation(
  flashcardId: string,
  sentence: string,
  userTranslation: string,
): Promise<CheckTranslationResponse> {
  return fetchJson<CheckTranslationResponse>(
    "/api/quiz/check-translation",
    {
      method: "POST",
      body: JSON.stringify({ flashcardId, sentence, userTranslation }),
    },
  );
}

/** POST /api/quiz/check-pinyin — Server-side pinyin string comparison */
export function checkPinyin(
  flashcardId: string,
  userPinyin: string,
): Promise<CheckPinyinResponse> {
  return fetchJson<CheckPinyinResponse>("/api/quiz/check-pinyin", {
    method: "POST",
    body: JSON.stringify({ flashcardId, userPinyin }),
  });
}

/** POST /api/quiz/submit-result — Submit final card result with FSRS rating */
export function submitResult(
  input: SubmitResultInput,
): Promise<SubmitResultResponse> {
  return fetchJson<SubmitResultResponse>("/api/quiz/submit-result", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /api/quiz/today-stats — Get today's review statistics */
export function getTodayStats(): Promise<TodayStatsResponse> {
  return fetchJson<TodayStatsResponse>("/api/quiz/today-stats");
}

// ---------------------------------------------------------------------------
// Flashcard CRUD
// ---------------------------------------------------------------------------

export interface GetFlashcardsParams {
  cursor?: string;
  limit?: number;
  state?: CardState[];
  search?: string;
  sort?: "due_asc" | "created_desc" | "word_asc";
}

/** GET /api/flashcards — List flashcards with pagination, filtering, sorting */
export function getFlashcards(
  params: GetFlashcardsParams = {},
): Promise<FlashcardListResponse> {
  const searchParams = new URLSearchParams();
  if (params.cursor) searchParams.set("cursor", params.cursor);
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.state?.length) {
    for (const s of params.state) searchParams.append("state", s);
  }
  if (params.search) searchParams.set("search", params.search);
  if (params.sort) searchParams.set("sort", params.sort);
  const qs = searchParams.toString();
  return fetchJson<FlashcardListResponse>(
    `/api/flashcards${qs ? `?${qs}` : ""}`,
  );
}

/** POST /api/flashcards — Create a new flashcard */
export function createFlashcard(
  data: CreateFlashcardInput,
): Promise<{ flashcard: FlashcardResponse }> {
  return fetchJson("/api/flashcards", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** PUT /api/flashcards/:id — Update an existing flashcard */
export function updateFlashcard(
  id: string,
  data: UpdateFlashcardInput,
): Promise<{ flashcard: FlashcardResponse }> {
  return fetchJson(`/api/flashcards/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** DELETE /api/flashcards/:id — Delete a flashcard */
export async function deleteFlashcard(id: string): Promise<void> {
  const res = await fetch(`/api/flashcards/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message);
  }
}

/** POST /api/flashcards/quick-save — Save a word from quiz tooltip */
export function quickSave(
  data: Partial<CreateFlashcardInput> & { word: string },
): Promise<{ flashcard: FlashcardResponse }> {
  return fetchJson("/api/flashcards/quick-save", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** POST /api/flashcards/ai-create — AI-assisted card creation */
export function aiCreateCard(
  input: { word: string },
): Promise<AiCardSuggestionResponse> {
  return fetchJson("/api/flashcards/ai-create", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /api/flashcards/export — Export all flashcards as JSON */
export function exportFlashcards(): Promise<FlashcardExportResponse> {
  return fetchJson("/api/flashcards/export");
}

export { ApiError };
