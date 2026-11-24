// Why SpaceMatch link — one-time agent tutorial check (graded server-side in whyLinks.completeTutorial).
export type WhyQuiz = { q: string; options: string[]; answer: number; why: string };

export const WHY_QUIZ: WhyQuiz[] = [
  {
    q: "When is the best moment to send your link?",
    options: [
      "Before the first call, with no context",
      "During the call, as soon as you know if they're selling, buying or both",
      "Only after they sign a listing agreement",
    ],
    answer: 1,
    why: "Send it while you're still on the phone, so you can walk them through it live.",
  },
  {
    q: "Your prospect says: \"We'd sell this place and buy something bigger.\" Which link do you send?",
    options: ["Seller", "Buyer", "Sell & buy"],
    answer: 2,
    why: "Sell & buy adds the timing options and the next-home budget calculator.",
  },
  {
    q: "Your Hub shows \"Viewing now · The SpaceMatch way\". What do you do?",
    options: [
      "Stay quiet and wait for them to finish",
      "Walk them through it: \"Tap the switch at the top. That's the difference.\"",
      "Send them a second link",
    ],
    answer: 1,
    why: "You can see where they are. Guide them and ask which part matters most to them.",
  },
  {
    q: "The prospect asks: \"So you can get me $50K more?\" What's the right answer?",
    options: [
      "\"Yes, the page shows it.\"",
      "\"I'll show you real numbers for your home in my CMA and net sheet. No one can promise a price.\"",
      "\"Our homes always sell above asking.\"",
    ],
    answer: 1,
    why: "Numbers on the page are examples. Never promise a price, a timeline or a result.",
  },
];
