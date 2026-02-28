export interface StarterPackCard {
  word: string;
  reading: string;
  englishMeaning: string;
}

export interface StarterPack {
  id: string;
  name: string;
  emoji: string;
  description: string;
  cards: StarterPackCard[];
}

export const starterPacksByLanguage: Record<string, StarterPack[]> = {
  zh: [
    {
      id: "essentials",
      name: "Essentials",
      emoji: "🌟",
      description: "Greetings, numbers, pronouns, and basic verbs",
      cards: [
        { word: "你好", reading: "ni3hao3", englishMeaning: "hello" },
        { word: "谢谢", reading: "xie4xie", englishMeaning: "thank you" },
        { word: "对不起", reading: "dui4buqi3", englishMeaning: "sorry" },
        { word: "再见", reading: "zai4jian4", englishMeaning: "goodbye" },
        { word: "是", reading: "shi4", englishMeaning: "to be; yes" },
        { word: "不", reading: "bu4", englishMeaning: "not; no" },
        { word: "我", reading: "wo3", englishMeaning: "I; me" },
        { word: "你", reading: "ni3", englishMeaning: "you" },
        { word: "他", reading: "ta1", englishMeaning: "he; him" },
        { word: "她", reading: "ta1", englishMeaning: "she; her" },
        { word: "我们", reading: "wo3men", englishMeaning: "we; us" },
        { word: "好", reading: "hao3", englishMeaning: "good; well" },
        { word: "要", reading: "yao4", englishMeaning: "to want; to need" },
        { word: "有", reading: "you3", englishMeaning: "to have; there is" },
        { word: "请", reading: "qing3", englishMeaning: "please" },
      ],
    },
    {
      id: "food-dining",
      name: "Food & Dining",
      emoji: "🍜",
      description: "Restaurant vocab, common dishes, and ordering",
      cards: [
        { word: "吃", reading: "chi1", englishMeaning: "to eat" },
        { word: "喝", reading: "he1", englishMeaning: "to drink" },
        { word: "米饭", reading: "mi3fan4", englishMeaning: "rice" },
        { word: "面条", reading: "mian4tiao2", englishMeaning: "noodles" },
        { word: "水", reading: "shui3", englishMeaning: "water" },
        { word: "茶", reading: "cha2", englishMeaning: "tea" },
        { word: "菜单", reading: "cai4dan1", englishMeaning: "menu" },
        { word: "买单", reading: "mai3dan1", englishMeaning: "to pay the bill" },
        { word: "好吃", reading: "hao3chi1", englishMeaning: "delicious" },
        { word: "饺子", reading: "jiao3zi", englishMeaning: "dumplings" },
        { word: "筷子", reading: "kuai4zi", englishMeaning: "chopsticks" },
        { word: "餐厅", reading: "can1ting1", englishMeaning: "restaurant" },
      ],
    },
    {
      id: "travel",
      name: "Travel",
      emoji: "✈️",
      description: "Directions, transport, hotel, and emergencies",
      cards: [
        { word: "去", reading: "qu4", englishMeaning: "to go" },
        { word: "来", reading: "lai2", englishMeaning: "to come" },
        { word: "哪里", reading: "na3li3", englishMeaning: "where" },
        { word: "地铁", reading: "di4tie3", englishMeaning: "subway" },
        { word: "出租车", reading: "chu1zu1che1", englishMeaning: "taxi" },
        { word: "机场", reading: "ji1chang3", englishMeaning: "airport" },
        { word: "酒店", reading: "jiu3dian4", englishMeaning: "hotel" },
        { word: "左", reading: "zuo3", englishMeaning: "left" },
        { word: "右", reading: "you4", englishMeaning: "right" },
        { word: "帮忙", reading: "bang1mang2", englishMeaning: "to help" },
        { word: "多少钱", reading: "duo1shao3qian2", englishMeaning: "how much (money)" },
        { word: "厕所", reading: "ce4suo3", englishMeaning: "restroom; toilet" },
      ],
    },
  ],
  ja: [
    {
      id: "ja-essentials",
      name: "Essentials",
      emoji: "🌟",
      description: "Basic greetings, pronouns, and everyday phrases",
      cards: [
        { word: "こんにちは", reading: "konnichiwa", englishMeaning: "hello" },
        { word: "ありがとう", reading: "arigatou", englishMeaning: "thank you" },
        { word: "すみません", reading: "sumimasen", englishMeaning: "excuse me; sorry" },
        { word: "さようなら", reading: "sayounara", englishMeaning: "goodbye" },
        { word: "はい", reading: "hai", englishMeaning: "yes" },
        { word: "いいえ", reading: "iie", englishMeaning: "no" },
        { word: "私", reading: "watashi", englishMeaning: "I; me" },
        { word: "あなた", reading: "anata", englishMeaning: "you" },
        { word: "好き", reading: "suki", englishMeaning: "to like; favorite" },
        { word: "食べる", reading: "taberu", englishMeaning: "to eat" },
        { word: "飲む", reading: "nomu", englishMeaning: "to drink" },
        { word: "行く", reading: "iku", englishMeaning: "to go" },
      ],
    },
  ],
  ko: [
    {
      id: "ko-essentials",
      name: "Essentials",
      emoji: "🌟",
      description: "Basic greetings, pronouns, and everyday phrases",
      cards: [
        { word: "안녕하세요", reading: "annyeonghaseyo", englishMeaning: "hello" },
        { word: "감사합니다", reading: "gamsahamnida", englishMeaning: "thank you" },
        { word: "죄송합니다", reading: "joesonghamnida", englishMeaning: "sorry" },
        { word: "안녕히 가세요", reading: "annyeonghi gaseyo", englishMeaning: "goodbye" },
        { word: "네", reading: "ne", englishMeaning: "yes" },
        { word: "아니요", reading: "aniyo", englishMeaning: "no" },
        { word: "저", reading: "jeo", englishMeaning: "I; me (formal)" },
        { word: "좋다", reading: "jota", englishMeaning: "to be good" },
        { word: "먹다", reading: "meokda", englishMeaning: "to eat" },
        { word: "가다", reading: "gada", englishMeaning: "to go" },
        { word: "물", reading: "mul", englishMeaning: "water" },
        { word: "사랑", reading: "sarang", englishMeaning: "love" },
      ],
    },
  ],
  es: [
    {
      id: "es-essentials",
      name: "Essentials",
      emoji: "🌟",
      description: "Basic greetings, pronouns, and everyday phrases",
      cards: [
        { word: "hola", reading: "", englishMeaning: "hello" },
        { word: "gracias", reading: "", englishMeaning: "thank you" },
        { word: "por favor", reading: "", englishMeaning: "please" },
        { word: "lo siento", reading: "", englishMeaning: "sorry" },
        { word: "adiós", reading: "", englishMeaning: "goodbye" },
        { word: "sí", reading: "", englishMeaning: "yes" },
        { word: "no", reading: "", englishMeaning: "no" },
        { word: "yo", reading: "", englishMeaning: "I" },
        { word: "tú", reading: "", englishMeaning: "you" },
        { word: "bueno", reading: "", englishMeaning: "good" },
        { word: "comer", reading: "", englishMeaning: "to eat" },
        { word: "beber", reading: "", englishMeaning: "to drink" },
      ],
    },
  ],
  fr: [
    {
      id: "fr-essentials",
      name: "Essentials",
      emoji: "🌟",
      description: "Basic greetings, pronouns, and everyday phrases",
      cards: [
        { word: "bonjour", reading: "", englishMeaning: "hello" },
        { word: "merci", reading: "", englishMeaning: "thank you" },
        { word: "s'il vous plaît", reading: "", englishMeaning: "please" },
        { word: "pardon", reading: "", englishMeaning: "sorry; excuse me" },
        { word: "au revoir", reading: "", englishMeaning: "goodbye" },
        { word: "oui", reading: "", englishMeaning: "yes" },
        { word: "non", reading: "", englishMeaning: "no" },
        { word: "je", reading: "", englishMeaning: "I" },
        { word: "vous", reading: "", englishMeaning: "you (formal)" },
        { word: "bon", reading: "", englishMeaning: "good" },
        { word: "manger", reading: "", englishMeaning: "to eat" },
        { word: "boire", reading: "", englishMeaning: "to drink" },
      ],
    },
  ],
  de: [
    {
      id: "de-essentials",
      name: "Essentials",
      emoji: "🌟",
      description: "Basic greetings, pronouns, and everyday phrases",
      cards: [
        { word: "hallo", reading: "", englishMeaning: "hello" },
        { word: "danke", reading: "", englishMeaning: "thank you" },
        { word: "bitte", reading: "", englishMeaning: "please; you're welcome" },
        { word: "Entschuldigung", reading: "", englishMeaning: "excuse me; sorry" },
        { word: "auf Wiedersehen", reading: "", englishMeaning: "goodbye" },
        { word: "ja", reading: "", englishMeaning: "yes" },
        { word: "nein", reading: "", englishMeaning: "no" },
        { word: "ich", reading: "", englishMeaning: "I" },
        { word: "du", reading: "", englishMeaning: "you" },
        { word: "gut", reading: "", englishMeaning: "good" },
        { word: "essen", reading: "", englishMeaning: "to eat" },
        { word: "trinken", reading: "", englishMeaning: "to drink" },
      ],
    },
  ],
};

// Backward compat: export the Chinese packs as default
export const starterPacks = starterPacksByLanguage.zh;
