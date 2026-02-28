/**
 * Indonesian language configuration.
 *
 * Indonesian is a phonetic (alphabetic) language, so it skips the
 * reading/pronunciation quiz step entirely.
 */

import type { LanguageConfig } from "./types";

export const indonesianConfig: LanguageConfig = {
  code: "id",
  name: "Indonesian",
  nativeName: "Bahasa Indonesia",
  isPhonetic: true,
  wordSegmentation: "whitespace",
  exampleWord: "halo",
  exampleMeaning: "hello",
};
