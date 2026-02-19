import { describe, it, expect } from "vitest";
import {
  normalizePinyin,
  hasToneMarks,
  verifyPinyin,
  isNumberedPinyinFormat,
} from "@/lib/pinyin";

// ---------------------------------------------------------------------------
// normalizePinyin
// ---------------------------------------------------------------------------

describe("normalizePinyin", () => {
  it("converts to lowercase", () => {
    expect(normalizePinyin("Ni3Hao3")).toBe("ni3hao3");
  });

  it("strips leading and trailing whitespace", () => {
    expect(normalizePinyin("  ni3hao3  ")).toBe("ni3hao3");
  });

  it("removes internal spaces", () => {
    expect(normalizePinyin("ni3 hao3")).toBe("ni3hao3");
  });

  it("removes hyphens", () => {
    expect(normalizePinyin("ni3-hao3")).toBe("ni3hao3");
  });

  it("removes apostrophes", () => {
    expect(normalizePinyin("xi'an")).toBe("xian");
  });

  it("collapses multiple spaces", () => {
    expect(normalizePinyin("ni3   hao3")).toBe("ni3hao3");
  });

  it("handles combined normalizations", () => {
    expect(normalizePinyin("  Ni3 - Hao3 ")).toBe("ni3hao3");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizePinyin("   ")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(normalizePinyin("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// hasToneMarks
// ---------------------------------------------------------------------------

describe("hasToneMarks", () => {
  it("detects a-macron (ā)", () => {
    expect(hasToneMarks("māma")).toBe(true);
  });

  it("detects e-acute (é)", () => {
    expect(hasToneMarks("méi")).toBe(true);
  });

  it("detects i-caron (ǐ)", () => {
    expect(hasToneMarks("nǐ")).toBe(true);
  });

  it("detects u-diaeresis (ü)", () => {
    expect(hasToneMarks("lü")).toBe(true);
  });

  it("detects o-grave (ò)", () => {
    expect(hasToneMarks("wò")).toBe(true);
  });

  it("returns false for numbered pinyin", () => {
    expect(hasToneMarks("ni3hao3")).toBe(false);
  });

  it("returns false for plain ASCII", () => {
    expect(hasToneMarks("hello")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(hasToneMarks("")).toBe(false);
  });

  it("returns false for digits only", () => {
    expect(hasToneMarks("12345")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// verifyPinyin — spec examples from 01-quiz-flow.md Section 3.5
// ---------------------------------------------------------------------------

describe("verifyPinyin", () => {
  const stored = "ni3hao3";

  it("accepts exact match: ni3hao3", () => {
    const result = verifyPinyin("ni3hao3", stored);
    expect(result.correct).toBe(true);
    expect(result.hasToneMarks).toBe(false);
  });

  it("accepts case-insensitive match: Ni3Hao3", () => {
    const result = verifyPinyin("Ni3Hao3", stored);
    expect(result.correct).toBe(true);
  });

  it("accepts with leading/trailing whitespace", () => {
    const result = verifyPinyin(" ni3hao3 ", stored);
    expect(result.correct).toBe(true);
  });

  it("accepts with internal space: ni3 hao3", () => {
    const result = verifyPinyin("ni3 hao3", stored);
    expect(result.correct).toBe(true);
  });

  it("accepts with hyphen: ni3-hao3", () => {
    const result = verifyPinyin("ni3-hao3", stored);
    expect(result.correct).toBe(true);
  });

  it("rejects missing tone numbers: nihao", () => {
    const result = verifyPinyin("nihao", stored);
    expect(result.correct).toBe(false);
    expect(result.hasToneMarks).toBe(false);
  });

  it("rejects wrong tone: ni2hao3", () => {
    const result = verifyPinyin("ni2hao3", stored);
    expect(result.correct).toBe(false);
    expect(result.hasToneMarks).toBe(false);
  });

  it("triggers tone mark warning for nǐhǎo (not counted as incorrect)", () => {
    const result = verifyPinyin("nǐhǎo", stored);
    expect(result.correct).toBe(false);
    expect(result.hasToneMarks).toBe(true);
    expect(result.toneMarkMessage).toBeDefined();
    expect(result.toneMarkMessage).toContain("numbered tones");
  });

  it("rejects empty string (not matching)", () => {
    const result = verifyPinyin("", stored);
    expect(result.correct).toBe(false);
  });

  it("rejects unrelated input: hello", () => {
    const result = verifyPinyin("hello", stored);
    expect(result.correct).toBe(false);
    expect(result.hasToneMarks).toBe(false);
  });

  it("rejects partial match: ni3hao (missing last tone)", () => {
    const result = verifyPinyin("ni3hao", stored);
    expect(result.correct).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// verifyPinyin — multiple valid readings
// ---------------------------------------------------------------------------

describe("verifyPinyin with multiple readings", () => {
  const stored = "le0/le";

  it("accepts first reading: le0", () => {
    const result = verifyPinyin("le0", stored);
    expect(result.correct).toBe(true);
  });

  it("accepts second reading: le", () => {
    const result = verifyPinyin("le", stored);
    expect(result.correct).toBe(true);
  });

  it("rejects non-matching reading: liao3", () => {
    const result = verifyPinyin("liao3", stored);
    expect(result.correct).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isNumberedPinyinFormat
// ---------------------------------------------------------------------------

describe("isNumberedPinyinFormat", () => {
  it("accepts valid numbered pinyin: ni3hao3", () => {
    expect(isNumberedPinyinFormat("ni3hao3")).toBe(true);
  });

  it("accepts single syllable: ma1", () => {
    expect(isNumberedPinyinFormat("ma1")).toBe(true);
  });

  it("accepts neutral tone: ma0", () => {
    expect(isNumberedPinyinFormat("ma0")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isNumberedPinyinFormat("")).toBe(false);
  });

  it("rejects letters only (no digit): nihao", () => {
    expect(isNumberedPinyinFormat("nihao")).toBe(false);
  });

  it("rejects digits only (no letter): 123", () => {
    expect(isNumberedPinyinFormat("123")).toBe(false);
  });

  it("rejects tone-marked input: nǐhǎo", () => {
    // After normalization, tone marks remain (they're not stripped),
    // and they fail the [a-z0-5]+ check
    expect(isNumberedPinyinFormat("nǐhǎo")).toBe(false);
  });

  it("rejects digits outside 0-5: ma9", () => {
    expect(isNumberedPinyinFormat("ma9")).toBe(false);
  });

  it("accepts with spaces (normalized away): ni3 hao3", () => {
    expect(isNumberedPinyinFormat("ni3 hao3")).toBe(true);
  });
});
