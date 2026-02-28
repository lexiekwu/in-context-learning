/**
 * Dutch language configuration.
 *
 * Dutch is a phonetic (alphabetic) language, so it skips the
 * reading/pronunciation quiz step entirely.
 */

import type { LanguageConfig } from "./types";

export const dutchConfig: LanguageConfig = {
  code: "nl",
  name: "Dutch",
  nativeName: "Nederlands",
  isPhonetic: true,
  wordSegmentation: "whitespace",
  exampleWord: "hallo",
  exampleMeaning: "hello",
};
