import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing callLLM
// ---------------------------------------------------------------------------

const mockGenerateContent = vi.fn();

vi.mock("@/lib/llm/client", () => ({
  gemini: {
    models: {
      generateContent: (...args: unknown[]) => mockGenerateContent(...args),
    },
  },
  DEFAULT_MODEL: "gemini-2.5-flash",
}));

// Mock env to avoid needing real env vars
vi.mock("@/lib/env", () => ({
  env: {
    GEMINI_API_KEY: "test-api-key",
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { callLLM } from "@/lib/llm/call";
import { AppError, ErrorCode } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Test schema
// ---------------------------------------------------------------------------

const TestSchema = z.object({
  sentence: z.string(),
  translation: z.string(),
});

type TestResponse = z.infer<typeof TestSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSuccessResponse(content: string) {
  mockGenerateContent.mockResolvedValue({
    text: content,
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 20,
    },
  });
}

function defaultOptions(overrides: Record<string, unknown> = {}) {
  return {
    systemMessage: "You are a helpful assistant.",
    userMessage: "Generate a sentence.",
    schema: TestSchema,
    maxRetries: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("callLLM", () => {
  it("returns parsed and validated data on success", async () => {
    const validJson = JSON.stringify({
      sentence: "你好世界",
      translation: "Hello world",
    });
    mockSuccessResponse(validJson);

    const result = await callLLM<TestResponse>(defaultOptions());

    expect(result).toEqual({
      sentence: "你好世界",
      translation: "Hello world",
    });
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("strips code fences from LLM response before parsing", async () => {
    const wrappedJson = '```json\n{"sentence": "你好", "translation": "Hello"}\n```';
    mockSuccessResponse(wrappedJson);

    const result = await callLLM<TestResponse>(defaultOptions());

    expect(result).toEqual({
      sentence: "你好",
      translation: "Hello",
    });
  });

  it("retries on failure up to maxRetries", async () => {
    // First call fails, second succeeds
    mockGenerateContent
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        text: JSON.stringify({
          sentence: "retry success",
          translation: "worked",
        }),
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 10 },
      });

    const result = await callLLM<TestResponse>(
      defaultOptions({ maxRetries: 1 })
    );

    expect(result).toEqual({
      sentence: "retry success",
      translation: "worked",
    });
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it("throws LLM_TIMEOUT on AbortError after all retries exhausted", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    mockGenerateContent.mockRejectedValue(abortError);

    await expect(
      callLLM<TestResponse>(defaultOptions({ maxRetries: 1 }))
    ).rejects.toThrow(AppError);

    try {
      await callLLM<TestResponse>(defaultOptions({ maxRetries: 0 }));
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.LLM_TIMEOUT);
    }
  });

  it("throws LLM_ERROR on malformed JSON", async () => {
    mockSuccessResponse("this is not json at all");

    await expect(
      callLLM<TestResponse>(defaultOptions({ maxRetries: 0 }))
    ).rejects.toThrow(AppError);

    try {
      await callLLM<TestResponse>(defaultOptions({ maxRetries: 0 }));
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.LLM_ERROR);
      expect((error as AppError).message).toContain("Malformed JSON");
    }
  });

  it("throws RATE_LIMITED on 429 error after all retries", async () => {
    const rateLimitError = { status: 429, message: "Too many requests" };
    mockGenerateContent.mockRejectedValue(rateLimitError);

    await expect(
      callLLM<TestResponse>(defaultOptions({ maxRetries: 0 }))
    ).rejects.toThrow(AppError);

    try {
      await callLLM<TestResponse>(defaultOptions({ maxRetries: 0 }));
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.RATE_LIMITED);
    }
  });

  it("throws LLM_ERROR on schema validation failure", async () => {
    // Valid JSON but doesn't match TestSchema (missing required fields)
    mockSuccessResponse(JSON.stringify({ wrong: "shape" }));

    await expect(
      callLLM<TestResponse>(defaultOptions({ maxRetries: 0 }))
    ).rejects.toThrow(AppError);

    try {
      await callLLM<TestResponse>(defaultOptions({ maxRetries: 0 }));
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.LLM_ERROR);
      expect((error as AppError).message).toContain("schema validation");
    }
  });

  it("throws LLM_ERROR on empty response content", async () => {
    mockGenerateContent.mockResolvedValue({
      text: undefined,
      usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0 },
    });

    await expect(
      callLLM<TestResponse>(defaultOptions({ maxRetries: 0 }))
    ).rejects.toThrow(AppError);

    try {
      await callLLM<TestResponse>(defaultOptions({ maxRetries: 0 }));
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.LLM_ERROR);
      expect((error as AppError).message).toContain("Empty response");
    }
  });

  it("throws LLM_ERROR on 401 auth error (no retry)", async () => {
    const authError = { status: 401, message: "Unauthorized" };
    mockGenerateContent.mockRejectedValue(authError);

    try {
      await callLLM<TestResponse>(defaultOptions({ maxRetries: 3 }));
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.LLM_ERROR);
      expect((error as AppError).message).toContain("authentication");
    }

    // Should only be called once — no retries for auth errors
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("passes model, temperature, and maxTokens to the API", async () => {
    mockSuccessResponse(
      JSON.stringify({ sentence: "test", translation: "test" })
    );

    await callLLM<TestResponse>(
      defaultOptions({
        model: "gemini-2.5-pro",
        temperature: 0.3,
        maxTokens: 300,
      })
    );

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-2.5-pro",
        contents: [{ role: "user", parts: [{ text: "Generate a sentence." }] }],
        config: expect.objectContaining({
          systemInstruction: "You are a helpful assistant.",
          temperature: 0.3,
          maxOutputTokens: 300,
          responseMimeType: "application/json",
        }),
      })
    );
  });
});
