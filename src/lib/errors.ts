import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Error codes — matches the spec in 02-data-model.md
// ---------------------------------------------------------------------------

export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  SUBSCRIPTION_REQUIRED: "SUBSCRIPTION_REQUIRED",
  NOT_FOUND: "NOT_FOUND",
  DUPLICATE: "DUPLICATE",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  LLM_ERROR: "LLM_ERROR",
  LLM_TIMEOUT: "LLM_TIMEOUT",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const httpStatusForCode: Record<ErrorCode, number> = {
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

// ---------------------------------------------------------------------------
// Error response shape
// ---------------------------------------------------------------------------

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details: unknown | null;
  };
}

// ---------------------------------------------------------------------------
// AppError — throwable error with structured API metadata
// ---------------------------------------------------------------------------

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details: unknown | null;

  constructor(
    code: ErrorCode,
    message: string,
    details: unknown | null = null
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = httpStatusForCode[code];
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a `NextResponse` from an `AppError` or raw error.
 *
 * Usage inside a route handler's catch block:
 * ```ts
 * catch (err) {
 *   return errorResponse(err);
 * }
 * ```
 */
export function errorResponse(error: unknown): NextResponse<ApiError> {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.statusCode }
    );
  }

  // Unexpected / unhandled errors
  logger.error({ err: error }, "Unhandled error");
  return NextResponse.json(
    {
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: "An unexpected error occurred.",
        details: null,
      },
    },
    { status: 500 }
  );
}

/**
 * Convenience constructors for common errors.
 */
export function validationError(message: string, details?: unknown) {
  return new AppError(ErrorCode.VALIDATION_ERROR, message, details ?? null);
}

export function unauthorizedError(message = "Authentication required.") {
  return new AppError(ErrorCode.UNAUTHORIZED, message);
}

export function notFoundError(resource: string, id?: string) {
  const msg = id
    ? `${resource} with ID ${id} not found.`
    : `${resource} not found.`;
  return new AppError(ErrorCode.NOT_FOUND, msg);
}

export function duplicateError(message: string) {
  return new AppError(ErrorCode.DUPLICATE, message);
}

export function subscriptionRequiredError() {
  return new AppError(
    ErrorCode.SUBSCRIPTION_REQUIRED,
    "An active subscription is required to access this feature."
  );
}

export function rateLimitedError(retryAfterSeconds?: number) {
  return new AppError(ErrorCode.RATE_LIMITED, "Too many requests.", {
    retryAfter: retryAfterSeconds ?? null,
  });
}

export function llmError(message = "LLM service error.") {
  return new AppError(ErrorCode.LLM_ERROR, message);
}

export function llmTimeoutError() {
  return new AppError(ErrorCode.LLM_TIMEOUT, "LLM request timed out.");
}
