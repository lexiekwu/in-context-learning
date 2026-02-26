import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // -------------------------------------------------------------------------
  // 1. Create a sample user
  // -------------------------------------------------------------------------
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      name: "Demo User",
      googleId: "google-demo-user-001",
      targetLanguage: "zh",
      languageVariant: "traditional",
      subscriptionStatus: "TRIAL",
      // trialEndsAt defaults to now() + 7 days via DB default
    },
  });

  console.log(`  Created user: ${user.email} (${user.id})`);

  // -------------------------------------------------------------------------
  // 2. Create 12 sample flashcards across all 4 card states
  // -------------------------------------------------------------------------
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;

  const flashcardData = [
    // NEW cards (3) — never reviewed, due immediately
    {
      word: "你好",
      reading: "ni3hao3",
      englishMeaning: "hello",
      state: "NEW" as const,
      difficulty: 0,
      stability: 0,
      due: now,
      reps: 0,
      lapses: 0,
    },
    {
      word: "謝謝",
      reading: "xie4xie4",
      englishMeaning: "thank you",
      state: "NEW" as const,
      difficulty: 0,
      stability: 0,
      due: now,
      reps: 0,
      lapses: 0,
    },
    {
      word: "再見",
      reading: "zai4jian4",
      englishMeaning: "goodbye",
      state: "NEW" as const,
      difficulty: 0,
      stability: 0,
      due: now,
      reps: 0,
      lapses: 0,
    },

    // LEARNING cards (3) — reviewed once or twice, short intervals
    {
      word: "學習",
      reading: "xue2xi2",
      englishMeaning: "to study / to learn",
      state: "LEARNING" as const,
      difficulty: 5.2,
      stability: 3.7,
      due: new Date(now.getTime() - 2 * 60 * 60 * 1000), // due 2h ago
      reps: 1,
      lapses: 0,
      lastReview: new Date(now.getTime() - 6 * 60 * 60 * 1000),
    },
    {
      word: "吃飯",
      reading: "chi1fan4",
      englishMeaning: "to eat (a meal)",
      state: "LEARNING" as const,
      difficulty: 5.5,
      stability: 2.1,
      due: new Date(now.getTime() - 30 * 60 * 1000), // due 30min ago
      reps: 2,
      lapses: 0,
      lastReview: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    },
    {
      word: "喝水",
      reading: "he1shui3",
      englishMeaning: "to drink water",
      state: "LEARNING" as const,
      difficulty: 4.8,
      stability: 1.5,
      due: now,
      reps: 1,
      lapses: 0,
      lastReview: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    },

    // REVIEW cards (4) — graduated, longer intervals
    {
      word: "圖書館",
      reading: "tu2shu1guan3",
      englishMeaning: "library",
      state: "REVIEW" as const,
      difficulty: 5.1,
      stability: 10.2,
      due: new Date(now.getTime() - 1 * oneDay), // overdue by 1 day
      reps: 5,
      lapses: 0,
      lastReview: new Date(now.getTime() - 11 * oneDay),
    },
    {
      word: "每天",
      reading: "mei3tian1",
      englishMeaning: "every day",
      state: "REVIEW" as const,
      difficulty: 4.5,
      stability: 20.5,
      due: new Date(now.getTime() + 3 * oneDay), // due in 3 days
      reps: 8,
      lapses: 0,
      lastReview: new Date(now.getTime() - 18 * oneDay),
    },
    {
      word: "電腦",
      reading: "dian4nao3",
      englishMeaning: "computer",
      state: "REVIEW" as const,
      difficulty: 5.8,
      stability: 8.4,
      due: new Date(now.getTime() - 2 * oneDay), // overdue by 2 days
      reps: 4,
      lapses: 1,
      lastReview: new Date(now.getTime() - 10 * oneDay),
    },
    {
      word: "工作",
      reading: "gong1zuo4",
      englishMeaning: "to work / work",
      state: "REVIEW" as const,
      difficulty: 4.2,
      stability: 42.0,
      due: new Date(now.getTime() + 14 * oneDay), // due in 2 weeks
      reps: 12,
      lapses: 0,
      lastReview: new Date(now.getTime() - 28 * oneDay),
    },

    // RELEARNING cards (2) — lapsed from REVIEW, short intervals
    {
      word: "天氣",
      reading: "tian1qi4",
      englishMeaning: "weather",
      state: "RELEARNING" as const,
      difficulty: 6.2,
      stability: 3.1,
      due: new Date(now.getTime() - 1 * 60 * 60 * 1000), // due 1h ago
      reps: 6,
      lapses: 2,
      lastReview: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    },
    {
      word: "醫院",
      reading: "yi1yuan4",
      englishMeaning: "hospital",
      state: "RELEARNING" as const,
      difficulty: 5.9,
      stability: 2.8,
      due: now,
      reps: 3,
      lapses: 1,
      lastReview: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
  ];

  const createdCards = [];
  for (const data of flashcardData) {
    const card = await prisma.flashcard.upsert({
      where: {
        userId_word_language: { userId: user.id, word: data.word, language: "zh" },
      },
      update: {},
      create: {
        userId: user.id,
        word: data.word,
        reading: data.reading,
        englishMeaning: data.englishMeaning,
        state: data.state,
        difficulty: data.difficulty,
        stability: data.stability,
        due: data.due,
        reps: data.reps,
        lapses: data.lapses,
        lastReview: data.lastReview ?? null,
        elapsed_days: 0,
        scheduled_days: 0,
      },
    });
    createdCards.push(card);
    console.log(`  Created flashcard: ${card.word} (${card.state})`);
  }

  // -------------------------------------------------------------------------
  // 3. Create a study session with some review logs
  // -------------------------------------------------------------------------
  const session = await prisma.studySession.create({
    data: {
      userId: user.id,
      startedAt: new Date(now.getTime() - 30 * 60 * 1000), // started 30 min ago
      endedAt: new Date(now.getTime() - 5 * 60 * 1000), // ended 5 min ago
      cardsReviewed: 5,
      cardsCorrect: 3,
    },
  });

  console.log(`  Created study session: ${session.id}`);

  // Create review logs for cards that have been reviewed
  const reviewedCards = createdCards.filter((c) => c.reps > 0);
  const reviewLogData = [
    {
      flashcard: reviewedCards[0], // 學習 (LEARNING)
      translationCorrect: true,
      readingCorrect: true,
      overallRating: "GOOD" as const,
      priorState: "NEW" as const,
    },
    {
      flashcard: reviewedCards[1], // 吃飯 (LEARNING)
      translationCorrect: true,
      readingCorrect: false,
      overallRating: "AGAIN" as const,
      priorState: "NEW" as const,
    },
    {
      flashcard: reviewedCards[3], // 圖書館 (REVIEW)
      translationCorrect: true,
      readingCorrect: true,
      overallRating: "GOOD" as const,
      priorState: "REVIEW" as const,
    },
    {
      flashcard: reviewedCards[5], // 電腦 (REVIEW)
      translationCorrect: false,
      readingCorrect: true,
      overallRating: "AGAIN" as const,
      priorState: "REVIEW" as const,
    },
    {
      flashcard: reviewedCards[7], // 天氣 (RELEARNING)
      translationCorrect: true,
      readingCorrect: true,
      overallRating: "GOOD" as const,
      priorState: "REVIEW" as const,
    },
  ];

  for (let i = 0; i < reviewLogData.length; i++) {
    const rl = reviewLogData[i];
    const reviewLog = await prisma.reviewLog.create({
      data: {
        flashcardId: rl.flashcard.id,
        userId: user.id,
        sessionId: session.id,
        generatedSentence: `Sample sentence containing ${rl.flashcard.word}。`,
        priorState: rl.priorState,
        userTranslation: "Sample user translation.",
        correctTranslation: "Sample correct translation.",
        translationCorrect: rl.translationCorrect,
        userReading: rl.flashcard.reading,
        readingCorrect: rl.readingCorrect,
        overallRating: rl.overallRating,
        reviewedAt: new Date(
          now.getTime() - (25 - i * 5) * 60 * 1000
        ),
        responseTimeMs: 8000 + Math.floor(Math.random() * 10000),
      },
    });
    console.log(
      `  Created review log: ${rl.flashcard.word} → ${rl.overallRating}`
    );
  }

  console.log("\nSeeding complete.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
