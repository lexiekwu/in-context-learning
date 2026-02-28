/**
 * Vietnamese language configuration.
 *
 * Vietnamese is a phonetic (alphabetic) language, so it skips the
 * reading/pronunciation quiz step entirely.
 */

import type { LanguageConfig } from "./types";

export const vietnameseConfig: LanguageConfig = {
  code: "vi",
  name: "Vietnamese",
  nativeName: "Tiếng Việt",
  isPhonetic: true,
  wordSegmentation: "whitespace",
  exampleWord: "xin chào",
  exampleMeaning: "hello",
};
