/**
 * Pinyin normalization and verification utilities.
 *
 * Implements the rules from 01-quiz-flow.md Section 3:
 *   - Numbered tones only (e.g. ni3hao3)
 *   - Normalization: lowercase, strip whitespace/hyphens/apostrophes
 *   - Reject tone-marked Unicode input with a soft error
 */

// ---------------------------------------------------------------------------
// Tone-mark detection
// ---------------------------------------------------------------------------

/**
 * Unicode ranges for tone-marked pinyin vowels.
 *
 * Covers: a-macron, a-acute, a-caron, a-grave,
 *         e-macron, e-acute, e-caron, e-grave,
 *         i-macron, i-acute, i-caron, i-grave,
 *         o-macron, o-acute, o-caron, o-grave,
 *         u-macron, u-acute, u-caron, u-grave,
 *         u-diaeresis variants (u with umlaut + tone)
 */
const TONE_MARK_REGEX =
  /[\u0101\u00E1\u01CE\u00E0\u0113\u00E9\u011B\u00E8\u012B\u00ED\u01D0\u00EC\u014D\u00F3\u01D2\u00F2\u016B\u00FA\u01D4\u00F9\u01D6\u01D8\u01DA\u01DC\u00FC]/;

/**
 * Returns `true` if the input contains any Unicode tone-marked vowels.
 * When this returns `true`, the caller should show a soft error asking
 * the user to use numbered tones instead.
 */
export function hasToneMarks(input: string): boolean {
  return TONE_MARK_REGEX.test(input);
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a pinyin string for comparison:
 * 1. Trim leading/trailing whitespace
 * 2. Convert to lowercase
 * 3. Remove all internal spaces
 * 4. Remove all internal hyphens and apostrophes
 */
export function normalizePinyin(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s\-']/g, "");
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export interface PinyinCheckResult {
  /** Whether the pinyin was accepted (correct match). */
  correct: boolean;
  /** If rejected due to tone marks, this is `true`. Not an incorrect attempt. */
  hasToneMarks: boolean;
  /** The expected (normalized) pinyin for display. */
  expectedPinyin: string;
  /** User-facing message when tone marks are detected. */
  toneMarkMessage?: string;
}

/**
 * Verify a user's pinyin input against the stored correct pinyin.
 *
 * @param userInput      The raw string the user typed.
 * @param storedPinyin   The correct pinyin stored on the flashcard
 *                       (e.g. "xue2xi2"). May contain multiple accepted
 *                       readings separated by "/" (e.g. "le0/le").
 * @returns              A result object describing the outcome.
 */
export function verifyPinyin(
  userInput: string,
  storedPinyin: string
): PinyinCheckResult {
  const expectedNormalized = normalizePinyin(storedPinyin);

  // Step 1: Check for tone marks (soft rejection, not counted as incorrect)
  if (hasToneMarks(userInput)) {
    return {
      correct: false,
      hasToneMarks: true,
      expectedPinyin: storedPinyin,
      toneMarkMessage:
        "Please use numbered tones instead of tone marks. " +
        "For example, type ni3hao3 instead of nǐhǎo.",
    };
  }

  // Step 2: Normalize user input
  const normalizedInput = normalizePinyin(userInput);

  // Step 3: Check against all accepted readings (separated by "/")
  const acceptedReadings = storedPinyin.split("/").map(normalizePinyin);
  const isCorrect = acceptedReadings.some(
    (reading) => reading === normalizedInput
  );

  return {
    correct: isCorrect,
    hasToneMarks: false,
    expectedPinyin: expectedNormalized,
  };
}

// ---------------------------------------------------------------------------
// Validation for card creation
// ---------------------------------------------------------------------------

/**
 * Very loose check that a string looks like numbered pinyin.
 * Accepts letters and digits — used for validating flashcard creation input.
 *
 * This does NOT validate that tone numbers are correct or that syllables
 * are valid Mandarin syllables. It just ensures the format is roughly right.
 */
export function isNumberedPinyinFormat(input: string): boolean {
  const normalized = normalizePinyin(input);
  if (normalized.length === 0) return false;

  // Must contain at least one letter and at least one digit
  const hasLetter = /[a-z]/.test(normalized);
  const hasDigit = /[0-5]/.test(normalized);

  // Must only contain lowercase letters and digits 0-5
  const validChars = /^[a-z0-5]+$/.test(normalized);

  return hasLetter && hasDigit && validChars;
}
