/**
 * LLM prompt templates for all three call types.
 *
 * System messages define the LLM's persona and rules.
 * User message builders interpolate runtime data into the templates.
 *
 * All prompt functions accept a `language` parameter (ISO 639-1 code)
 * that defaults to 'zh' (Chinese) for backwards compatibility.
 */

import {
  getLanguageConfig,
  DEFAULT_LANGUAGE,
  type LanguageConfig,
} from "./languages";

// ---------------------------------------------------------------------------
// Call 1: Sentence Generation
// ---------------------------------------------------------------------------

/**
 * Build the system message for sentence generation.
 *
 * @param languageOrCharacterSet - ISO 639-1 language code OR legacy character set string ("traditional"/"simplified")
 * @param variant - Character set variant (only for languages with variants, e.g. "traditional"/"simplified" for Chinese)
 */
export function sentenceGenerationSystemMessage(
  languageOrCharacterSet: string,
  variant?: string,
): string {
  // Backwards compatibility: if called with "traditional" or "simplified",
  // treat as Chinese with that variant
  let lang: LanguageConfig;
  let resolvedVariant: string | undefined;
  if (
    languageOrCharacterSet === "traditional" ||
    languageOrCharacterSet === "simplified"
  ) {
    lang = getLanguageConfig("zh");
    resolvedVariant = languageOrCharacterSet;
  } else {
    lang = getLanguageConfig(languageOrCharacterSet);
    resolvedVariant = variant;
  }

  const lines: string[] = [];
  lines.push(
    `You are a ${lang.name} language tutor that generates natural example sentences for vocabulary study.`,
  );
  lines.push("");
  lines.push("Rules you MUST follow:");

  let ruleNum = 1;

  // Character set variant rules (Chinese traditional/simplified)
  if (lang.hasVariants && resolvedVariant) {
    lines.push(
      `${ruleNum}. Use ONLY ${resolvedVariant} Chinese characters. If "traditional", use 繁體字 exclusively. If "simplified", use 简体字 exclusively. Never mix character sets.`,
    );
    ruleNum++;
  }

  // Reading/pronunciation format rules
  if (lang.needsReading && lang.readingFormatInstructions) {
    lines.push(`${ruleNum}. ${lang.readingFormatInstructions}`);
    ruleNum++;
  }

  lines.push(
    `${ruleNum}. Generate exactly ONE sentence. If the target word is a standard word, it must use the target word naturally. If the target word is a radical, component, or bound morpheme that cannot be used as a standalone word in natural speech, you MUST instead generate a sentence that describes or discusses the character/radical (e.g., explaining its meaning, or showing a common word that contains it), rather than trying to use it as a standalone word.`,
  );
  ruleNum++;

  lines.push(
    `${ruleNum}. The sentence should sound like something a native speaker would actually say — conversational and natural, not textbook-stilted.`,
  );
  ruleNum++;

  lines.push(
    `${ruleNum}. Match the sentence complexity to the target word itself. If the word is basic, use a simple sentence. If the word is advanced, use a more sophisticated sentence with appropriate context. The rest of the vocabulary in the sentence should be simpler than the target word.`,
  );
  ruleNum++;

  lines.push(
    `${ruleNum}. Wrap the target word in <mark> tags in the sentenceWithHighlight field. If the target word is a radical/component, wrap the radical/component character in <mark> tags where it appears.`,
  );
  ruleNum++;

  // Word breakdown instructions
  if (lang.sentenceInstructions) {
    lines.push(`${ruleNum}. ${lang.sentenceInstructions}`);
    ruleNum++;
  }

  lines.push(
    `${ruleNum}. The translation should be natural English, not word-for-word.`,
  );
  ruleNum++;

  lines.push(
    `${ruleNum}. Each wordBreakdown "meaning" must be a single short English gloss — one or two words a learner would type (e.g. "to eat", "happy", "computer"). Never list multiple definitions separated by semicolons, slashes, or commas.`,
  );
  ruleNum++;

  lines.push("");
  lines.push(
    "Respond with valid JSON only. No markdown, no code fences, no extra text.",
  );

  return lines.join("\n");
}

/**
 * Build the user message for sentence generation.
 *
 * @param params.targetWord - The vocabulary word to generate a sentence for
 * @param params.pinyin - Pronunciation/reading of the word (field name kept for backwards compat)
 * @param params.meaning - English meaning of the word
 * @param params.characterSet - Character set variant (for Chinese: "traditional"/"simplified")
 * @param params.language - ISO 639-1 language code (defaults to 'zh')
 */
export function sentenceGenerationUserMessage(params: {
  targetWord: string;
  pinyin: string;
  meaning: string;
  characterSet: string;
  language?: string;
}): string {
  const lang = getLanguageConfig(params.language ?? DEFAULT_LANGUAGE);
  const readingLabel = lang.readingLabel ?? "reading";

  // For Chinese: "Use traditional Chinese characters." (matches original prompt)
  const variantDesc = lang.code === "zh" ? "Chinese" : lang.name;
  const contextLine =
    lang.hasVariants && params.characterSet
      ? `Use ${params.characterSet} ${variantDesc} characters.\n\n`
      : "";

  const readingLine = lang.needsReading
    ? `\n${readingLabel.charAt(0).toUpperCase() + readingLabel.slice(1)}: ${params.pinyin}`
    : "";

  const breakdownExample = lang.needsReading
    ? `    { "word": "<${lang.name} word>", "${readingLabel}": "<${readingLabel}>", "meaning": "<single short English gloss>" }`
    : `    { "word": "<${lang.name} word>", "meaning": "<single short English gloss>" }`;

  return `Generate a sentence using this word. ${contextLine}Word: ${params.targetWord}${readingLine}
Meaning: ${params.meaning}

Respond with JSON in this exact format:
{
  "sentence": "<full sentence in ${lang.name}>",
  "sentenceWithHighlight": "<same sentence with target word wrapped in <mark> tags>",
  "translation": "<natural English translation>",
  "wordBreakdown": [
${breakdownExample}
  ]
}`;
}

// ---------------------------------------------------------------------------
// Call 2: Translation Checking
// ---------------------------------------------------------------------------

/**
 * Build the system message for translation grading.
 *
 * @param language - ISO 639-1 language code (defaults to 'zh')
 */
export function translationCheckSystemMessage(
  language: string = DEFAULT_LANGUAGE,
): string {
  const lang = getLanguageConfig(language);

  return `You are a ${lang.name} language tutor grading a student's English translation of a ${lang.name} sentence.

Grading rules:
1. Be LENIENT on style, word choice, and phrasing. Accept reasonable synonyms and paraphrasing.
2. Be STRICT on meaning. The translation must convey the same core meaning as the original sentence.
3. Be ESPECIALLY strict about the target word. The student must demonstrate they understood what the target word means in this context.
4. If the student's translation is in ${lang.name} or any language other than English, mark it incorrect and note the issue in the explanation.
5. Minor grammatical errors in the English are acceptable if the meaning is clear.
6. If the translation is partially correct (gets the gist but misses the target word's nuance), mark it incorrect but give an encouraging explanation.

Set "correct" to true only if:
- The overall sentence meaning is preserved (doesn't need to be word-for-word)
- The target word's meaning is correctly reflected in the translation

Always provide a "suggestedTranslation" — this should be the most natural, accurate English rendering of the ${lang.name} sentence.

Respond with valid JSON only. No markdown, no code fences, no extra text.`;
}

/**
 * Legacy constant for backwards compatibility.
 * Points to the Chinese translation check system message.
 */
export const TRANSLATION_CHECK_SYSTEM_MESSAGE = translationCheckSystemMessage("zh");

/**
 * Build the user message for translation grading.
 *
 * @param params.language - ISO 639-1 language code (defaults to 'zh')
 */
export function translationCheckUserMessage(params: {
  chineseSentence: string;
  correctTranslation: string;
  userTranslation: string;
  targetWord: string;
  targetMeaning: string;
  language?: string;
}): string {
  const lang = getLanguageConfig(params.language ?? DEFAULT_LANGUAGE);
  const refLine = params.correctTranslation
    ? `Reference translation: ${params.correctTranslation}\n`
    : "";

  // Use a generic label for the source sentence
  const sentenceLabel = `${lang.name} sentence`;

  return `Grade this translation:

${sentenceLabel}: ${params.chineseSentence}
${refLine}Student's translation: ${params.userTranslation}

Target word: ${params.targetWord}
Target word meaning: ${params.targetMeaning}

Respond with JSON in this exact format:
{
  "correct": <true or false>,
  "explanation": "<brief, encouraging explanation of why the translation is correct or incorrect>",
  "targetWordUsedCorrectly": <true or false>,
  "suggestedTranslation": "<your best natural English translation>"
}`;
}

// ---------------------------------------------------------------------------
// Call 3: AI Card Creation
// ---------------------------------------------------------------------------

/**
 * Build the system message for AI card creation.
 *
 * @param characterSetOrLanguage - Character set ("traditional"/"simplified") OR ISO 639-1 language code
 * @param variant - Character set variant (only for languages with variants)
 */
export function aiCardCreationSystemMessage(
  characterSetOrLanguage: string,
  variant?: string,
): string {
  // Backwards compatibility: if called with "traditional" or "simplified",
  // treat as Chinese with that variant
  let lang: LanguageConfig;
  let resolvedVariant: string | undefined;
  if (
    characterSetOrLanguage === "traditional" ||
    characterSetOrLanguage === "simplified"
  ) {
    lang = getLanguageConfig("zh");
    resolvedVariant = characterSetOrLanguage;
  } else {
    lang = getLanguageConfig(characterSetOrLanguage);
    resolvedVariant = variant;
  }

  const readingLabel = lang.readingLabel ?? "reading";

  const lines: string[] = [];
  lines.push(
    `You are a ${lang.name} dictionary and flashcard assistant.`,
  );
  lines.push("");
  lines.push("Rules you MUST follow:");

  let ruleNum = 1;

  // Character set variant rules
  if (lang.hasVariants && resolvedVariant) {
    lines.push(
      `${ruleNum}. Use ONLY ${resolvedVariant} Chinese characters. If "traditional", use 繁體字 exclusively. If "simplified", use 简体字 exclusively. Never mix character sets.`,
    );
    ruleNum++;
  }

  // Reading/pronunciation format rules
  if (lang.needsReading && lang.readingFormatInstructions) {
    lines.push(`${ruleNum}. ${lang.readingFormatInstructions}`);
    ruleNum++;
  }

  lines.push(
    `${ruleNum}. If the user provides English, find the single most common/useful ${lang.name} equivalent. Prefer the word a native ${lang.name} speaker would most naturally use.`,
  );
  ruleNum++;

  // Language-specific card creation instructions
  if (lang.cardCreationInstructions) {
    lines.push(`${ruleNum}. ${lang.cardCreationInstructions}`);
    ruleNum++;
  }

  lines.push(
    `${ruleNum}. The "meaning" field should contain ONLY the single most common English meaning — a short phrase a learner would type (e.g. "to study", "happy", "computer"). Never list multiple definitions separated by semicolons, slashes, or commas. If context is ambiguous, pick the most frequent meaning.`,
  );
  ruleNum++;

  lines.push(
    `${ruleNum}. The example sentence should be simple and natural — something a textbook or native speaker would use.`,
  );
  ruleNum++;

  lines.push(
    `${ruleNum}. The example sentence MUST use the target word.`,
  );
  ruleNum++;

  lines.push(
    `${ruleNum}. If the user provides a context sentence, use it to disambiguate which meaning/word is intended.`,
  );
  ruleNum++;

  lines.push("");
  lines.push(
    "Respond with valid JSON only. No markdown, no code fences, no extra text.",
  );

  return lines.join("\n");
}

/**
 * Build the user message for AI card creation.
 *
 * @param params.language - ISO 639-1 language code (defaults to 'zh')
 */
export function aiCardCreationUserMessage(params: {
  input: string;
  inputLanguage: string;
  characterSet: string;
  contextSentence?: string | null;
  language?: string;
}): string {
  const lang = getLanguageConfig(params.language ?? DEFAULT_LANGUAGE);
  const readingLabel = lang.readingLabel ?? "reading";

  const contextLine = params.contextSentence
    ? `Context: ${params.contextSentence}\n`
    : "";

  const characterSetLine =
    lang.hasVariants && params.characterSet
      ? `Character set: ${params.characterSet}\n`
      : "";

  const readingField = lang.needsReading
    ? `\n  "${readingLabel}": "<${readingLabel}>",`
    : "";

  return `Create a flashcard for:

Input: ${params.input}
Input language: ${params.inputLanguage}
${characterSetLine}${contextLine}
Respond with JSON in this exact format:
{
  "word": "<the word in ${lang.name}>",${readingField}
  "meaning": "<single primary English meaning>",
  "exampleSentence": "<example sentence in ${lang.name} using the word>",
  "exampleTranslation": "<English translation of example sentence>"
}`;
}
