/**
 * Portuguese language configuration.
 *
 * Portuguese is a phonetic (alphabetic) language, so it skips the
 * reading/pronunciation quiz step entirely.
 */

import type { LanguageConfig } from "./types";

export const portugueseConfig: LanguageConfig = {
  code: "pt",
  name: "Portuguese",
  nativeName: "Português",
  isPhonetic: true,
  wordSegmentation: "whitespace",
  exampleWord: "olá",
  exampleMeaning: "hello",
};
