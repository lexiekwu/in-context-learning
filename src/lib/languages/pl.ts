/**
 * Polish language configuration.
 *
 * Polish is a phonetic (alphabetic) language, so it skips the
 * reading/pronunciation quiz step entirely.
 */

import type { LanguageConfig } from "./types";

export const polishConfig: LanguageConfig = {
  code: "pl",
  name: "Polish",
  nativeName: "Polski",
  isPhonetic: true,
  wordSegmentation: "whitespace",
  exampleWord: "cześć",
  exampleMeaning: "hello",
};
