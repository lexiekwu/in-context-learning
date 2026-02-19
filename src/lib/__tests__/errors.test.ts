import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AppError,
  ErrorCode,
  errorResponse,
  validationError,
  unauthorizedError,
  notFoundError,
  duplicateError,
  subscriptionRequiredError,
  rateLimitedError,
  llmError,
  llmTimeoutError,
} from "@/lib/errors";

// ---------------------------------------------------------------------------
// AppError
// ---------------------------------------------------------------------------

describe("AppError", () => {
  it("stores code, message, and details", () => {
    const err = new AppError(ErrorCode.VALIDATION_ERROR, "bad input", {
      field: "pinyin",
    });
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("bad input");
    expect(err.details).toEqual({ field: "pinyin" });
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe("AppError");
  });

  it("defaults details to null", () => {
    const err = new AppError(ErrorCode.NOT_FOUND, "gone");
    expect(err.details).toBeNull();
  });

  it("is an instance of Error", () => {
    const err = new AppError(ErrorCode.INTERNAL_ERROR, "oops");
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// errorResponse
// ---------------------------------------------------------------------------

describe("errorResponse", () => {
  it("returns correct status and body for AppError", async () => {
    const err = new AppError(ErrorCode.NOT_FOUND, "Card not found", null);
    const res = errorResponse(err);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Card not found");
    expect(body.error.details).toBeNull();
  });

  it("returns 500 for unknown errors and does not leak details", async () => {
    // Suppress the console.error that errorResponse logs
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const err = new Error("secret database connection string");
    const res = errorResponse(err);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("An unexpected error occurred.");
    expect(body.error.details).toBeNull();
    // The original error message must NOT appear in the response
    expect(JSON.stringify(body)).not.toContain("secret database");

    spy.mockRestore();
  });

  it("returns 500 for non-Error thrown values", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = errorResponse("string error");

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");

    spy.mockRestore();
  });

  it("maps each error code to the correct HTTP status", async () => {
    const codeToStatus: Record<string, number> = {
      VALIDATION_ERROR: 400,
      UNAUTHORIZED: 401,
      SUBSCRIPTION_REQUIRED: 403,
      NOT_FOUND: 404,
      DUPLICATE: 409,
      RATE_LIMITED: 429,
      INTERNAL_ERROR: 500,
      LLM_ERROR: 502,
      LLM_TIMEOUT: 504,
    };

    for (const [code, expectedStatus] of Object.entries(codeToStatus)) {
      const err = new AppError(code as ErrorCode, "test");
      const res = errorResponse(err);
      expect(res.status).toBe(expectedStatus);
    }
  });
});

// ---------------------------------------------------------------------------
// Convenience constructors
// ---------------------------------------------------------------------------

describe("validationError", () => {
  it("creates a VALIDATION_ERROR with details", () => {
    const err = validationError("Invalid pinyin", { field: "pinyin" });
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Invalid pinyin");
    expect(err.details).toEqual({ field: "pinyin" });
  });

  it("defaults details to null when omitted", () => {
    const err = validationError("Missing field");
    expect(err.details).toBeNull();
  });
});

describe("unauthorizedError", () => {
  it("returns 401 with UNAUTHORIZED code", () => {
    const err = unauthorizedError();
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Authentication required.");
  });

  it("accepts a custom message", () => {
    const err = unauthorizedError("Session expired.");
    expect(err.message).toBe("Session expired.");
  });
});

describe("notFoundError", () => {
  it("returns 404 with NOT_FOUND code", () => {
    const err = notFoundError("Flashcard");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Flashcard not found.");
  });

  it("includes ID in message when provided", () => {
    const err = notFoundError("Flashcard", "abc-123");
    expect(err.message).toBe("Flashcard with ID abc-123 not found.");
  });
});

describe("duplicateError", () => {
  it("returns 409 with DUPLICATE code", () => {
    const err = duplicateError("Card already exists");
    expect(err.code).toBe("DUPLICATE");
    expect(err.statusCode).toBe(409);
  });
});

describe("subscriptionRequiredError", () => {
  it("returns 403 with SUBSCRIPTION_REQUIRED code", () => {
    const err = subscriptionRequiredError();
    expect(err.code).toBe("SUBSCRIPTION_REQUIRED");
    expect(err.statusCode).toBe(403);
  });
});

describe("rateLimitedError", () => {
  it("returns 429 with retryAfter in details", () => {
    const err = rateLimitedError(30);
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.statusCode).toBe(429);
    expect(err.details).toEqual({ retryAfter: 30 });
  });

  it("sets retryAfter to null when not provided", () => {
    const err = rateLimitedError();
    expect(err.details).toEqual({ retryAfter: null });
  });
});

describe("llmError", () => {
  it("returns 502 with LLM_ERROR code", () => {
    const err = llmError();
    expect(err.code).toBe("LLM_ERROR");
    expect(err.statusCode).toBe(502);
  });
});

describe("llmTimeoutError", () => {
  it("returns 504 with LLM_TIMEOUT code", () => {
    const err = llmTimeoutError();
    expect(err.code).toBe("LLM_TIMEOUT");
    expect(err.statusCode).toBe(504);
    expect(err.message).toBe("LLM request timed out.");
  });
});
