// Zualingo Premium plans sold on /subscriptions. Edit prices and payment methods here.
export type Plan = { id: string; name: string; days: number; price: string; note: string; best?: boolean };

export const plans: Plan[] = [
  { id: "month", name: "1 Month", days: 30, price: "$2.99", note: "Try every Premium feature" },
  { id: "quarter", name: "3 Months", days: 90, price: "$7.99", note: "Save 11%", best: true },
  { id: "year", name: "12 Months", days: 365, price: "$24.99", note: "Save 30%. Best for serious learners" },
];

export const methods = ["Bank transfer", "USDT (BEP-20)", "$ZUBA token"];

export const planById = (id: string) => plans.find((p) => p.id === id);

export const perks = [
  { t: "All 11 lesson chapters", d: "Chapters 5 to 11 in all 20 African languages: family, market, numbers, time, travel and more." },
  { t: "160 extra Kitendawili riddles", d: "Riddle levels 41 to 200, the hardest riddles of the elders, plus Elder and Sage live rooms." },
  { t: "Every Zuba Boom level", d: "Unlock level 7 and beyond with tougher puzzles and bigger stars." },
  { t: "All Zuba Run cities", d: "Run past chapter 2 into every African city and face every boss." },
  { t: "Every illustrated story", d: "Read all the Premium folktales, legends and hero stories in the Story Theatre." },
  { t: "Unlimited hearts", d: "Keep learning without running out of hearts in lessons." },
];

export type PremiumRequest = {
  email: string;
  name: string;
  plan: string;
  method: string;
  reference: string;
  at: string;
  status: "pending" | "issued";
  issuedAt?: string;
};
