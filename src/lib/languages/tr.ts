/**
 * Turkish language configuration.
 *
 * Turkish is a phonetic (alphabetic) language, so it skips the
 * reading/pronunciation quiz step entirely.
 */

import type { LanguageConfig } from "./types";

export const turkishConfig: LanguageConfig = {
  code: "tr",
  name: "Turkish",
  nativeName: "Türkçe",
  isPhonetic: true,
  wordSegmentation: "whitespace",
  exampleWord: "merhaba",
  exampleMeaning: "hello",
};
