export interface StarterPackCard {
  word: string;
  pinyin: string;
  englishMeaning: string;
}

export interface StarterPack {
  id: string;
  name: string;
  emoji: string;
  description: string;
  cards: StarterPackCard[];
}

export const starterPacks: StarterPack[] = [
  {
    id: "essentials",
    name: "Essentials",
    emoji: "🌟",
    description: "Greetings, numbers, pronouns, and basic verbs",
    cards: [
      { word: "你好", pinyin: "ni3hao3", englishMeaning: "hello" },
      { word: "谢谢", pinyin: "xie4xie", englishMeaning: "thank you" },
      { word: "对不起", pinyin: "dui4buqi3", englishMeaning: "sorry" },
      { word: "再见", pinyin: "zai4jian4", englishMeaning: "goodbye" },
      { word: "是", pinyin: "shi4", englishMeaning: "to be; yes" },
      { word: "不", pinyin: "bu4", englishMeaning: "not; no" },
      { word: "我", pinyin: "wo3", englishMeaning: "I; me" },
      { word: "你", pinyin: "ni3", englishMeaning: "you" },
      { word: "他", pinyin: "ta1", englishMeaning: "he; him" },
      { word: "她", pinyin: "ta1", englishMeaning: "she; her" },
      { word: "我们", pinyin: "wo3men", englishMeaning: "we; us" },
      { word: "好", pinyin: "hao3", englishMeaning: "good; well" },
      { word: "要", pinyin: "yao4", englishMeaning: "to want; to need" },
      { word: "有", pinyin: "you3", englishMeaning: "to have; there is" },
      { word: "请", pinyin: "qing3", englishMeaning: "please" },
    ],
  },
  {
    id: "food-dining",
    name: "Food & Dining",
    emoji: "🍜",
    description: "Restaurant vocab, common dishes, and ordering",
    cards: [
      { word: "吃", pinyin: "chi1", englishMeaning: "to eat" },
      { word: "喝", pinyin: "he1", englishMeaning: "to drink" },
      { word: "米饭", pinyin: "mi3fan4", englishMeaning: "rice" },
      { word: "面条", pinyin: "mian4tiao2", englishMeaning: "noodles" },
      { word: "水", pinyin: "shui3", englishMeaning: "water" },
      { word: "茶", pinyin: "cha2", englishMeaning: "tea" },
      { word: "菜单", pinyin: "cai4dan1", englishMeaning: "menu" },
      { word: "买单", pinyin: "mai3dan1", englishMeaning: "to pay the bill" },
      { word: "好吃", pinyin: "hao3chi1", englishMeaning: "delicious" },
      { word: "饺子", pinyin: "jiao3zi", englishMeaning: "dumplings" },
      { word: "筷子", pinyin: "kuai4zi", englishMeaning: "chopsticks" },
      { word: "餐厅", pinyin: "can1ting1", englishMeaning: "restaurant" },
    ],
  },
  {
    id: "travel",
    name: "Travel",
    emoji: "✈️",
    description: "Directions, transport, hotel, and emergencies",
    cards: [
      { word: "去", pinyin: "qu4", englishMeaning: "to go" },
      { word: "来", pinyin: "lai2", englishMeaning: "to come" },
      { word: "哪里", pinyin: "na3li3", englishMeaning: "where" },
      { word: "地铁", pinyin: "di4tie3", englishMeaning: "subway" },
      { word: "出租车", pinyin: "chu1zu1che1", englishMeaning: "taxi" },
      { word: "机场", pinyin: "ji1chang3", englishMeaning: "airport" },
      { word: "酒店", pinyin: "jiu3dian4", englishMeaning: "hotel" },
      { word: "左", pinyin: "zuo3", englishMeaning: "left" },
      { word: "右", pinyin: "you4", englishMeaning: "right" },
      { word: "帮忙", pinyin: "bang1mang2", englishMeaning: "to help" },
      { word: "多少钱", pinyin: "duo1shao3qian2", englishMeaning: "how much (money)" },
      { word: "厕所", pinyin: "ce4suo3", englishMeaning: "restroom; toilet" },
    ],
  },
];
