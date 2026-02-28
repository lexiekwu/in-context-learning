/**
 * Norwegian language configuration.
 *
 * Norwegian is a phonetic (alphabetic) language, so it skips the
 * reading/pronunciation quiz step entirely.
 */

import type { LanguageConfig } from "./types";

export const norwegianConfig: LanguageConfig = {
  code: "no",
  name: "Norwegian",
  nativeName: "Norsk",
  isPhonetic: true,
  wordSegmentation: "whitespace",
  exampleWord: "hei",
  exampleMeaning: "hello",
};
