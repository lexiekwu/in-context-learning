/**
 * Language configuration registry.
 *
 * Central entry point for all language configs. Add new languages by:
 * 1. Creating a config file (e.g. `fr.ts`)
 * 2. Importing it here and adding it to the LANGUAGE_REGISTRY
 */

export type {
  ReadingSystem,
  LanguageVariant,
  LanguageConfig,
} from "./types";

import type { LanguageConfig } from "./types";
import { chineseConfig } from "./zh";
import { spanishConfig } from "./es";
import { japaneseConfig } from "./ja";
import { koreanConfig } from "./ko";
import { frenchConfig } from "./fr";
import { germanConfig } from "./de";
import { portugueseConfig } from "./pt";
import { italianConfig } from "./it";
import { russianConfig } from "./ru";
import { arabicConfig } from "./ar";
import { hindiConfig } from "./hi";
import { turkishConfig } from "./tr";
import { dutchConfig } from "./nl";
import { swedishConfig } from "./sv";
import { polishConfig } from "./pl";
import { vietnameseConfig } from "./vi";
import { greekConfig } from "./el";
import { thaiConfig } from "./th";
import { indonesianConfig } from "./id";
import { norwegianConfig } from "./no";

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const LANGUAGE_REGISTRY: Record<string, LanguageConfig> = {
  zh: chineseConfig,
  es: spanishConfig,
  ja: japaneseConfig,
  ko: koreanConfig,
  fr: frenchConfig,
  de: germanConfig,
  pt: portugueseConfig,
  it: italianConfig,
  ru: russianConfig,
  ar: arabicConfig,
  hi: hindiConfig,
  tr: turkishConfig,
  nl: dutchConfig,
  sv: swedishConfig,
  pl: polishConfig,
  vi: vietnameseConfig,
  el: greekConfig,
  th: thaiConfig,
  id: indonesianConfig,
  no: norwegianConfig,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the language configuration for a given language code.
 * Throws if the language code is not supported.
 */
export function getLanguageConfig(code: string): LanguageConfig {
  const config = LANGUAGE_REGISTRY[code];
  if (!config) {
    throw new Error(
      `Unsupported language code: "${code}". ` +
        `Supported languages: ${Object.keys(LANGUAGE_REGISTRY).join(", ")}`
    );
  }
  return config;
}

/**
 * Array of all supported languages, suitable for rendering UI dropdowns.
 * Each entry contains the code, English name, and native name.
 */
export const SUPPORTED_LANGUAGES = Object.values(LANGUAGE_REGISTRY).map(
  ({ code, name, nativeName }) => ({ code, name, nativeName })
);
