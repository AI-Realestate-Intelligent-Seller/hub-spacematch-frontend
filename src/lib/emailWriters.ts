// Long-form, client-specific emails built from the numbers (no AI). Plain text so they paste
// cleanly into Gmail, Lofty or any CRM. Rounded the way a person would say them.
import { type MoveUpIn, type RentVsOwnIn, moveUp, rentVsOwn, roundTo, usd } from "./homeMath";

const r100 = (n: number) => usd(roundTo(n, 100));
const r1k = (n: number) => usd(roundTo(n, 1000));
const r10 = (n: number) => usd(roundTo(n, 10));

// "an $800,000 home", "a $650,000 home"
const article = (n: number) => {
  const lead = Number(roundTo(n, 1000).toLocaleString("en-US").split(",")[0]);
  return String(lead).startsWith("8") || lead === 11 || lead === 18 ? "an" : "a";
};

export type Built = { subject: string; body: string };

export function rentVsOwnEmail(i: RentVsOwnIn, opts: { firstName: string; buys?: string; showSavings: boolean }): Built & { r: ReturnType<typeof rentVsOwn> } {
  const r = rentVsOwn(i);
  const name = opts.firstName.trim() || "there";
  const area = r.place.name;
  const m = r.monthly;
  const f = r.five, t = r.ten;
  const lines: string[] = [];
  lines.push(`Hi ${name},`);
  lines.push(
    `You're paying about ${usd(i.rent)} a month in rent right now. I ran the numbers on what it would look like if you put ${usd(i.extra)} more a month, ${usd(r.budget)} total, toward owning in ${area} instead.`,
  );
  lines.push(
    `At ${usd(r.budget)} a month, all in, you could buy a place around ${r1k(r.price)}${opts.buys?.trim() ? `. In ${area} that's ${opts.buys.trim().replace(/\.$/, "")}` : ""}.`,
  );
  lines.push(
    [
      `Here's where the ${usd(r.budget)} goes each month:`,
      `- Mortgage (principal and interest): ${r10(m.pi)}`,
      `- Property tax: ${r10(m.tax)}`,
      ...(m.hoa ? [`- HOA: ${r10(m.hoa)}`] : []),
      `- Insurance: ${r10(m.insurance)}`,
      ...(m.pmi ? [`- Mortgage insurance (goes away once you have about 22% equity): ${r10(m.pmi)}`] : []),
    ].join("\n"),
  );
  lines.push(
    `To get in, you'd need about ${r1k(r.down)} down (${i.downPct}%) plus about ${r1k(r.closing)} in closing costs, so roughly ${r1k(r.cashIn)} total. If that's more than you have saved, there are lower down payment options and some Illinois down payment help programs. We can go over those.`,
  );
  lines.push(
    `Now the part that matters. Think of the extra ${usd(i.extra)} a month like a savings account. Every payment pays down part of your loan, and that comes back to you when you sell.`,
  );
  const h = (x: typeof f) =>
    [
      `If you sold after ${x.years} years:`,
      `- Renting, you'd have paid about ${r1k(x.rentPaid)} in rent, and none of it comes back.`,
      `- Owning, you'd have paid about ${r1k(x.ownPaid)} in total payments. When you sell, after selling costs and paying off the loan, you'd walk away with about ${r1k(x.walkAway)}. That's the ${r1k(x.cashIn)} you put in back, ${x.gain >= 0 ? `plus about ${r1k(x.gain)}` : `minus about ${r1k(-x.gain)}`}.`,
    ].join("\n");
  lines.push(h(f));
  lines.push(h(t));
  if (opts.showSavings) {
    const d5 = f.walkAway - f.renterSavings, d10 = t.walkAway - t.renterSavings;
    const say = (d: number, y: number) =>
      Math.abs(d) < 5000
        ? `after ${y} years it comes out about even`
        : d > 0
          ? `after ${y} years owning comes out about ${r1k(d)} ahead`
          : `after ${y} years renting and saving comes out about ${r1k(-d)} ahead`;
    lines.push(
      `To be fair, I also compared it to renting and putting that same money (the down payment plus the difference each month) in a ${i.savingsPct}% savings account. ${say(d5, 5)[0].toUpperCase()}${say(d5, 5).slice(1)}, and ${say(d10, 10)}. The longer you stay, the more owning pulls ahead, because rent keeps going up and your mortgage payment doesn't.`,
    );
  }
  lines.push(
    `This uses a ${i.ratePct}% rate, home values going up ${i.appreciationPct}% a year and rent going up ${i.rentGrowthPct}% a year. It's an estimate, not a loan offer. A lender would give you your real rate and payment.`,
  );
  lines.push(
    `If you want, I can send you a few real listings around ${r1k(r.price)} in ${area}, or connect you with a lender to see what you'd qualify for. Just reply and let me know.`,
  );
  return { subject: `What ${usd(r.budget)} a month could buy you in ${area.replace(/^the /, "")}`, body: lines.join("\n\n"), r };
}

export function moveUpEmail(i: MoveUpIn, opts: { firstName: string; address?: string }): Built & { r: ReturnType<typeof moveUp> } {
  const r = moveUp(i);
  const name = opts.firstName.trim() || "there";
  const home = opts.address?.trim() ? opts.address.trim() : "your home";
  const m = r.monthly;
  const lines: string[] = [];
  lines.push(`Hi ${name},`);
  lines.push(
    `You've built real equity in ${home}. I ran the numbers on what a move could look like: sell, buy your next place, and still keep cash in the bank.`,
  );
  lines.push(
    [
      `If ${home} sold for around ${r1k(i.value)}:`,
      `- Selling costs (commission, transfer taxes, title, attorney): about ${r1k(r.sellCosts)}`,
      `- Paying off your loan: about ${r1k(i.payoff)}`,
      `- You'd walk away with about ${r1k(r.walkAway)}`,
    ].join("\n"),
  );
  lines.push(
    [
      `Here's one way to use it on ${article(i.nextPrice)} ${r1k(i.nextPrice)} home:`,
      `- Keep ${r1k(r.keep)} in the bank`,
      `- Closing costs on the new place: about ${r1k(r.nextClosing)}`,
      `- Put down about ${r1k(r.down)} (${Math.round(r.downPct)}%)`,
    ].join("\n"),
  );
  lines.push(
    `Your new monthly payment would be about ${r100(m.total)} all in: ${r10(m.pi)} for the mortgage, ${r10(m.tax)} in property tax${m.hoa ? `, ${r10(m.hoa)} HOA` : ""} and ${r10(m.insurance)} insurance${m.pmi ? `, plus ${r10(m.pmi)} mortgage insurance until you reach 20% equity` : ""}.${i.currentPI ? ` Today you pay about ${r100(i.currentPI)} for principal and interest, so it's good to look at both side by side.` : ""}`,
  );
  lines.push(
    `The cash you keep is the point. It's a cushion for anything that comes up, money for updates on the new place, or a start on your next investment. You move up and you still have money working for you.`,
  );
  lines.push(
    `A couple of honest notes: this uses a ${i.ratePct}% rate on the new loan, and rates change. If your current rate is lower, the trade-off is worth talking through. A different split (more down, less in the bank) lowers the payment. I can run that version too.`,
  );
  lines.push(
    `Want me to pull recent sales near you to firm up the ${r1k(i.value)}, and send you a few homes around ${r1k(i.nextPrice)}? Just reply and I'll put it together.`,
  );
  return { subject: `Your move: cash out and keep ${r1k(r.keep)} in the bank`, body: lines.join("\n\n"), r };
}
