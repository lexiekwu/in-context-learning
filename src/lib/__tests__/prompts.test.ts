import { describe, it, expect } from "vitest";
import {
  sentenceGenerationSystemMessage,
  sentenceGenerationUserMessage,
  TRANSLATION_CHECK_SYSTEM_MESSAGE,
  translationCheckUserMessage,
  aiCardCreationSystemMessage,
  aiCardCreationUserMessage,
} from "@/lib/llm/prompts";

describe("sentenceGenerationSystemMessage", () => {
  it("includes the character set in the prompt", () => {
    const msg = sentenceGenerationSystemMessage("traditional");
    expect(msg).toContain("traditional");
    expect(msg).toContain("繁體字");
  });

  it("includes numbered tone format instruction", () => {
    const msg = sentenceGenerationSystemMessage("simplified");
    expect(msg).toContain("ni3hao3");
    expect(msg).toContain("simplified");
    expect(msg).toContain("简体字");
  });

  it("includes <mark> tag instruction", () => {
    const msg = sentenceGenerationSystemMessage("traditional");
    expect(msg).toContain("<mark>");
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
