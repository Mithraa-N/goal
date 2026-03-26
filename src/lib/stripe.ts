import Stripe from "stripe";

export const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("CRITICAL VULNERABILITY: STRIPE_SECRET_KEY is missing from environment. Application halted.");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-12-18.acacia" as any,
    typescript: true,
  });
};

export const STRIPE_PLANS = {
  monthly: {
    priceId: process.env.STRIPE_MONTHLY_PRICE_ID!,
    name: "Monthly",
    amount: 1999, // £19.99/month in pence
    interval: "month" as const,
  },
  yearly: {
    priceId: process.env.STRIPE_YEARLY_PRICE_ID!,
    name: "Yearly",
    amount: 19999, // £199.99/year in pence
    interval: "year" as const,
  },
};
