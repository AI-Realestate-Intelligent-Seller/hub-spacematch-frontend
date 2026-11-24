// Pay by card (Stripe), shared by the UI and Convex. Michael 2026-11-10: "add the stripe option".
export const CARD_FEE_PCT = 3; // added to the agent's total when Michael picks "agent pays the card fee"
export type CardKind = "list" | "lob" | "reel" | "ad";
export type FeeMode = "agent" | "absorb";
export const cents = (n: number) => Math.round(n * 100);
export const cardFee = (amount: number, feePct: number) => Math.round(amount * feePct) / 100;
export const cardTotal = (amount: number, feePct: number) => Math.round((amount + cardFee(amount, feePct)) * 100) / 100;
