import { OFFICE_CITY, OFFICE_LINE1, OFFICE_STATE, OFFICE_ZIP } from "./officeDefs";
// Lob print + mail for the 6x11 seller mailers (Michael 2026-11-01, "go").
// Shared by the UI and Convex. Prices: help.lob.com pricing-details, 2026-11-01 (Developer plan,
// 6x11 USPS Marketing Mail $1.052 incl. print + postage; ≤500 pieces a month on the free plan).
// What every mailing pays per card, the team's own included (Michael 2026-11-02, "go B"): Lob $1.052 + Viktor's
// cost ×2 + recovery of the done-for-you build. Nobody pays Lob's raw cost.
export const LOB_CARD_PRICE = 1.16;
export const LOB_COST = 1.052; // what Lob charges us (Developer plan, 6x11 std)
// "Mail it for me" series: the same homes get the next card in SEQUENCE every 4 weeks, 3 drops in all.
export const SERIES_DROPS = 3;
export const SERIES_GAP_DAYS = 28;
export const MAIL_TOPS = [200, 400, 800]; // list sizes allowed for done-for-you (cards per ZIP)
export const LOB_FREE_MONTHLY = 500;
export const LOB_MAIL_LABEL = "USPS Marketing Mail, usually 1 to 3 weeks";
export const LOB_FROM = {
  line1: OFFICE_LINE1.replace(/\.$/, ""), // USPS style, no trailing period
  city: OFFICE_CITY,
  state: OFFICE_STATE,
  zip: OFFICE_ZIP,
};
export const lobAmount = (cards: number) => Math.round(cards * LOB_CARD_PRICE * 100) / 100;
