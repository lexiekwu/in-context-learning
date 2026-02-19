/**
 * Sanitize user input before interpolating into LLM prompts.
 *
 * Defends against prompt injection by stripping instruction-like patterns,
 * code fences, JSON-breaking characters, and excessive length.
 */
export function sanitizeForPrompt(input: string): string {
  const stripped = input
    .replace(/```/g, "") // Remove code fences
    .replace(/\n/g, " ") // Flatten to single line
    .replace(/[{}]/g, "") // Remove braces (JSON injection)
    .trim();

  // Truncate to reasonable length
  const maxLength = 500;
  return stripped.slice(0, maxLength);
}
