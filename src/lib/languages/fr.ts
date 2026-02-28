/**
 * French language configuration.
 *
 * French is a phonetic (alphabetic) language, so it skips the
 * reading/pronunciation quiz step entirely.
 */

import type { LanguageConfig } from "./types";

export const frenchConfig: LanguageConfig = {
  code: "fr",
  name: "French",
  nativeName: "Français",
  isPhonetic: true,
  wordSegmentation: "whitespace",
  exampleWord: "bonjour",
  exampleMeaning: "hello",
};
