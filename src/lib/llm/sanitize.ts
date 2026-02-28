/**
 * Sanitize user input before interpolating into LLM prompts.
 *
 * Defends against prompt injection by stripping instruction-like patterns,
 * code fences, JSON-breaking characters, role manipulation, and excessive length.
 */
export function sanitizeForPrompt(input: string): string {
  const stripped = input
    .replace(/```/g, "") // Remove code fences
    .replace(/\n/g, " ") // Flatten to single line
    .replace(/[{}]/g, "") // Remove braces (JSON injection)
    .replace(/<\/?[a-zA-Z|_][^>]*>/g, "") // Strip XML/HTML-like tags
    .replace(/\b(SYSTEM|INST|Human|Assistant|ASSISTANT|USER|ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?))\b/gi, "") // Strip role/instruction injection
    .trim();

  // Truncate to reasonable length
  const maxLength = 500;
  return stripped.slice(0, maxLength);
}
