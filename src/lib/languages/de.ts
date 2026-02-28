/**
 * German language configuration.
 *
 * German is a phonetic (alphabetic) language, so it skips the
 * reading/pronunciation quiz step entirely.
 */

import type { LanguageConfig } from "./types";

export const germanConfig: LanguageConfig = {
  code: "de",
  name: "German",
  nativeName: "Deutsch",
  isPhonetic: true,
  wordSegmentation: "whitespace",
  exampleWord: "hallo",
  exampleMeaning: "hello",
};
