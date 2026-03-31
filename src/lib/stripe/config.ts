export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    dailyLimit: 0,
    campaigns: 1,
    features: ["1 campaign", "Preview mode only", "See how it works"],
  },
  starter: {
    name: "Starter",
    price: 49,
    dailyLimit: 10,
    campaigns: 2,
    priceId: process.env.STRIPE_STARTER_PRICE_ID ?? "",
    features: [
      "10 personalized demos/day",
      "2 campaigns",
      "Branded PDF reports",
      "Copy-paste email drafts",
      "Daily auto-pipeline",
    ],
  },
  growth: {
    name: "Growth",
    price: 99,
    dailyLimit: 25,
    campaigns: 999,
    priceId: process.env.STRIPE_GROWTH_PRICE_ID ?? "",
    features: [
      "25 personalized demos/day",
      "Unlimited campaigns",
      "All PDF templates",
      "Copy-paste email drafts",
      "Daily auto-pipeline",
      "Priority support",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;

export function getPlanByPriceId(priceId: string): PlanId | null {
  if (priceId === PLANS.starter.priceId) return "starter";
  if (priceId === PLANS.growth.priceId) return "growth";
  return null;
}
