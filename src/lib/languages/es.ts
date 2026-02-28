/**
 * Spanish language configuration.
 *
 * Spanish is a phonetic (alphabetic) language, so it skips the
 * reading/pronunciation quiz step entirely.
 */

import type { LanguageConfig } from "./types";

export const spanishConfig: LanguageConfig = {
  code: "es",
  name: "Spanish",
  nativeName: "Español",
  isPhonetic: true,
  wordSegmentation: "whitespace",
  exampleWord: "hola",
  exampleMeaning: "hello",
};
