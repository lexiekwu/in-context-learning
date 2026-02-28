/**
 * Swedish language configuration.
 *
 * Swedish is a phonetic (alphabetic) language, so it skips the
 * reading/pronunciation quiz step entirely.
 */

import type { LanguageConfig } from "./types";

export const swedishConfig: LanguageConfig = {
  code: "sv",
  name: "Swedish",
  nativeName: "Svenska",
  isPhonetic: true,
  wordSegmentation: "whitespace",
  exampleWord: "hej",
  exampleMeaning: "hello",
};
