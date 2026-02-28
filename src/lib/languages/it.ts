/**
 * Italian language configuration.
 *
 * Italian is a phonetic (alphabetic) language, so it skips the
 * reading/pronunciation quiz step entirely.
 */

import type { LanguageConfig } from "./types";

export const italianConfig: LanguageConfig = {
  code: "it",
  name: "Italian",
  nativeName: "Italiano",
  isPhonetic: true,
  wordSegmentation: "whitespace",
  exampleWord: "ciao",
  exampleMeaning: "hello",
};
