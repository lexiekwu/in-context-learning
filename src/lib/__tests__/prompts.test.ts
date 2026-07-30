import { describe, it, expect } from "vitest";
import {
  sentenceGenerationSystemMessage,
  sentenceGenerationUserMessage,
  TRANSLATION_CHECK_SYSTEM_MESSAGE,
  translationCheckSystemMessage,
  translationCheckUserMessage,
  aiCardCreationSystemMessage,
  aiCardCreationUserMessage,
} from "@/lib/llm/prompts";

// ---------------------------------------------------------------------------
// Backwards compatibility — Chinese (existing tests preserved)
// ---------------------------------------------------------------------------

describe("sentenceGenerationSystemMessage", () => {
  it("includes the character set in the prompt (legacy call)", () => {
    const msg = sentenceGenerationSystemMessage("traditional");
    expect(msg).toContain("traditional");
    expect(msg).toContain("繁體字");
  });

  it("includes numbered tone format instruction (legacy call)", () => {
    const msg = sentenceGenerationSystemMessage("simplified");
    expect(msg).toContain("ni3hao3");
    expect(msg).toContain("simplified");
    expect(msg).toContain("简体字");
  });

  it("includes <mark> tag instruction", () => {
    const msg = sentenceGenerationSystemMessage("traditional");
    expect(msg).toContain("<mark>");
  });

  it("works with explicit language code 'zh' and variant", () => {
    const msg = sentenceGenerationSystemMessage("zh", "traditional");
    expect(msg).toContain("Mandarin Chinese");
    expect(msg).toContain("繁體字");
    expect(msg).toContain("ni3hao3");
  });

  it("instructs relatively short <15 words simple sentences and discourages compound sentences", () => {
    const msg = sentenceGenerationSystemMessage("zh");
    expect(msg).toContain("<15 words");
    expect(msg).toContain("Discourage compound sentences");
  });
});

describe("sentenceGenerationUserMessage", () => {
  it("interpolates all parameters", () => {
    const msg = sentenceGenerationUserMessage({
      targetWord: "學習",
      pinyin: "xue2xi2",
      meaning: "to study",
      characterSet: "traditional",
    });

    expect(msg).toContain("Word: 學習");
    expect(msg).toContain("Pinyin: xue2xi2");
    expect(msg).toContain("Meaning: to study");
    expect(msg).toContain("traditional");
  });

  it("includes JSON format instruction", () => {
    const msg = sentenceGenerationUserMessage({
      targetWord: "你好",
      pinyin: "ni3hao3",
      meaning: "hello",
      characterSet: "simplified",
    });

    expect(msg).toContain("wordBreakdown");
    expect(msg).toContain("sentenceWithHighlight");
  });
});

describe("TRANSLATION_CHECK_SYSTEM_MESSAGE", () => {
  it("instructs lenient style grading", () => {
    expect(TRANSLATION_CHECK_SYSTEM_MESSAGE).toContain("LENIENT");
  });

  it("instructs strict meaning grading", () => {
    expect(TRANSLATION_CHECK_SYSTEM_MESSAGE).toContain("STRICT on meaning");
  });

  it("requires JSON response", () => {
    expect(TRANSLATION_CHECK_SYSTEM_MESSAGE).toContain("valid JSON only");
  });

  it("matches the output of translationCheckSystemMessage('zh')", () => {
    expect(TRANSLATION_CHECK_SYSTEM_MESSAGE).toBe(
      translationCheckSystemMessage("zh"),
    );
  });
});

describe("translationCheckUserMessage", () => {
  it("includes reference translation when provided", () => {
    const msg = translationCheckUserMessage({
      chineseSentence: "你好世界",
      correctTranslation: "Hello world",
      userTranslation: "Hi world",
      targetWord: "你好",
      targetMeaning: "hello",
    });

    expect(msg).toContain("Reference translation: Hello world");
    expect(msg).toContain("Student's translation: Hi world");
    expect(msg).toContain("Target word: 你好");
  });

  it("omits reference line when correctTranslation is empty", () => {
    const msg = translationCheckUserMessage({
      chineseSentence: "你好世界",
      correctTranslation: "",
      userTranslation: "Hi world",
      targetWord: "你好",
      targetMeaning: "hello",
    });

    expect(msg).not.toContain("Reference translation:");
  });
});

describe("aiCardCreationSystemMessage", () => {
  it("instructs single definition preference", () => {
    const msg = aiCardCreationSystemMessage("traditional");
    expect(msg).toContain("single most common English meaning");
    expect(msg).toContain("Never list multiple definitions");
  });

  it("includes character set rules", () => {
    const msg = aiCardCreationSystemMessage("simplified");
    expect(msg).toContain("simplified");
    expect(msg).toContain("简体字");
  });
});

describe("aiCardCreationUserMessage", () => {
  it("interpolates input and language", () => {
    const msg = aiCardCreationUserMessage({
      input: "happy",
      inputLanguage: "english",
      characterSet: "traditional",
    });

    expect(msg).toContain("Input: happy");
    expect(msg).toContain("Input language: english");
    expect(msg).toContain("traditional");
  });

  it("includes context sentence when provided", () => {
    const msg = aiCardCreationUserMessage({
      input: "開",
      inputLanguage: "chinese",
      characterSet: "traditional",
      contextSentence: "請開門",
    });

    expect(msg).toContain("Context: 請開門");
  });

  it("omits context line when not provided", () => {
    const msg = aiCardCreationUserMessage({
      input: "開",
      inputLanguage: "chinese",
      characterSet: "traditional",
    });

    expect(msg).not.toContain("Context:");
  });

  it("uses single primary meaning format in JSON example", () => {
    const msg = aiCardCreationUserMessage({
      input: "hello",
      inputLanguage: "english",
      characterSet: "simplified",
    });

    expect(msg).toContain("single primary English meaning");
    expect(msg).not.toContain("semicolons");
  });
});

// ---------------------------------------------------------------------------
// Multi-language support — new tests
// ---------------------------------------------------------------------------

describe("sentenceGenerationSystemMessage (multi-language)", () => {
  it("generates Japanese-specific prompts", () => {
    const msg = sentenceGenerationSystemMessage("ja");
    expect(msg).toContain("Japanese");
    expect(msg).toContain("hiragana");
    expect(msg).not.toContain("pinyin");
    expect(msg).not.toContain("繁體字");
  });

  it("generates Spanish prompts without reading instructions", () => {
    const msg = sentenceGenerationSystemMessage("es");
    expect(msg).toContain("Spanish");
    expect(msg).not.toContain("pinyin");
    expect(msg).not.toContain("reading");
    expect(msg).not.toContain("hiragana");
  });

  it("generates Korean prompts with romanization", () => {
    const msg = sentenceGenerationSystemMessage("ko");
    expect(msg).toContain("Korean");
    expect(msg).toContain("Revised Romanization");
  });

  it("falls back to Chinese for unknown language codes", () => {
    const msg = sentenceGenerationSystemMessage("xx");
    expect(msg).toContain("Mandarin Chinese");
  });
});

describe("sentenceGenerationUserMessage (multi-language)", () => {
  it("uses 'reading' label for Japanese", () => {
    const msg = sentenceGenerationUserMessage({
      targetWord: "食べる",
      pinyin: "たべる",
      meaning: "to eat",
      characterSet: "",
      language: "ja",
    });

    expect(msg).toContain("Reading: たべる");
    expect(msg).toContain("Japanese");
    expect(msg).toContain('"reading"');
  });

  it("omits reading field for phonetic languages", () => {
    const msg = sentenceGenerationUserMessage({
      targetWord: "comer",
      pinyin: "",
      meaning: "to eat",
      characterSet: "",
      language: "es",
    });

    expect(msg).toContain("Spanish");
    expect(msg).not.toContain("Pinyin:");
    expect(msg).not.toContain("Reading:");
  });
});

describe("translationCheckSystemMessage (multi-language)", () => {
  it("generates language-specific grading prompt for Japanese", () => {
    const msg = translationCheckSystemMessage("ja");
    expect(msg).toContain("Japanese");
    expect(msg).toContain("LENIENT");
    expect(msg).toContain("STRICT on meaning");
  });

  it("generates language-specific grading prompt for Spanish", () => {
    const msg = translationCheckSystemMessage("es");
    expect(msg).toContain("Spanish");
  });

  it("defaults to Chinese", () => {
    const msg = translationCheckSystemMessage();
    expect(msg).toContain("Mandarin Chinese");
  });
});

describe("translationCheckUserMessage (multi-language)", () => {
  it("uses language name in sentence label for Japanese", () => {
    const msg = translationCheckUserMessage({
      chineseSentence: "彼は食べる",
      correctTranslation: "He eats",
      userTranslation: "He eats food",
      targetWord: "食べる",
      targetMeaning: "to eat",
      language: "ja",
    });

    expect(msg).toContain("Japanese sentence:");
  });
});

describe("aiCardCreationSystemMessage (multi-language)", () => {
  it("generates Japanese card creation prompts", () => {
    const msg = aiCardCreationSystemMessage("ja");
    expect(msg).toContain("Japanese");
    expect(msg).toContain("hiragana");
    expect(msg).not.toContain("繁體字");
  });

  it("generates Spanish card creation prompts without reading", () => {
    const msg = aiCardCreationSystemMessage("es");
    expect(msg).toContain("Spanish");
    expect(msg).not.toContain("pinyin");
    expect(msg).not.toContain("reading");
  });
});

describe("aiCardCreationUserMessage (multi-language)", () => {
  it("includes reading field for Japanese", () => {
    const msg = aiCardCreationUserMessage({
      input: "eat",
      inputLanguage: "english",
      characterSet: "",
      language: "ja",
    });

    expect(msg).toContain("Japanese");
    expect(msg).toContain('"reading"');
  });

  it("omits reading field and character set for Spanish", () => {
    const msg = aiCardCreationUserMessage({
      input: "eat",
      inputLanguage: "english",
      characterSet: "",
      language: "es",
    });

    expect(msg).toContain("Spanish");
    expect(msg).not.toContain('"reading"');
    expect(msg).not.toContain('"pinyin"');
    expect(msg).not.toContain("Character set:");
  });
});
