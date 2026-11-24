// Seller net sheet (Michael 2026-10-31): quick, close-to-accurate walk-away number during a listing
// conversation. Chicago/IL transfer taxes, Cook County tax proration (bills in arrears), title,
// attorney, commission. Every line is editable or explained. No AI.
import { Mail, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { MoneyField, PctField, TextField, btnDark, btnLight, card, copyText, inputCls, labelCls, useSigner } from "@/components/hub/EmailBits";
import { gmailLink, signature } from "@/lib/emailLibrary";
import { type County, netSheet, num, placeOf, roundTo, usd } from "@/lib/homeMath";

const COUNTIES: { id: string; label: string; county: County; chicago: boolean }[] = [
  { id: "chicago", label: "City of Chicago", county: "cook", chicago: true },
  { id: "cook", label: "Cook County suburb", county: "cook", chicago: false },
  { id: "collar", label: "DuPage, Lake, Will, Kane, McHenry", county: "dupage", chicago: false },
  { id: "other", label: "Elsewhere in Illinois", county: "other", chicago: false },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function NetSheetPage() {
  const [params] = useSearchParams();
  const signer = useSigner();
  const zipParam = params.get("zip") ?? "";
  const initialLoc = (() => { const p = placeOf(zipParam); if (!p) return "chicago"; return p.chicago ? "chicago" : p.county === "cook" ? "cook" : p.county === "other" ? "other" : "collar"; })();
  const [address, setAddress] = useState(params.get("address") ?? "");
  const [seller, setSeller] = useState("");
  const [to, setTo] = useState("");
  const [price, setPrice] = useState(num(params.get("price") ?? "") || 450000);
  const [payoff, setPayoff] = useState(num(params.get("payoff") ?? "") || 250000);
  const [listPct, setListPct] = useState(3.5);
  const [buyerPct, setBuyerPct] = useState(2.5);
  const [loc, setLoc] = useState(initialLoc);
  const [annualTax, setAnnualTax] = useState(roundTo((num(params.get("price") ?? "") || 450000) * 0.019, 100));
  const [closeMonth, setCloseMonth] = useState(() => ((new Date().getMonth() + 2) % 12) + 1);
  const [priorUnpaid, setPriorUnpaid] = useState(true);
  const [attorney, setAttorney] = useState(750);
  const [hoaFees, setHoaFees] = useState(0);
  const [credits, setCredits] = useState(0);
  const [other, setOther] = useState(0);
  const L = COUNTIES.find(c => c.id === loc) ?? COUNTIES[0];
  const base = { payoff, listPct, buyerPct, place: L, annualTax, closeMonth, priorYearUnpaid: priorUnpaid, attorney, hoaFees, credits, other };
  const res = useMemo(() => netSheet({ price, ...base }), [price, JSON.stringify(base)]);
  const scen = [-0.05, 0, 0.05].map(d => { const p = roundTo(price * (1 + d), 1000); return { d, p, net: netSheet({ price: p, ...base }).net }; });
  const summary = [
    `Estimated net sheet${address ? ` for ${address}` : ""}`,
    "",
    `Sale price: ${usd(price)}`,
    ...res.lines.map(l => `${l.label}: -${usd(l.amount)}`),
    `Loan payoff: -${usd(payoff)}`,
    "",
    `Estimated walk-away: ${usd(res.net)}`,
    "",
    "This is an estimate. Final numbers come from your title company's closing statement.",
  ].join("\n");
  const emailBody = `Hi ${seller.trim() || "there"},\n\nHere's the estimated net sheet we talked about. At ${usd(price)}, after all selling costs and paying off your loan, you'd walk away with about ${usd(roundTo(res.net, 100))}.\n\n${summary}\n\nIf we land 5% higher (${usd(scen[2].p)}), that's about ${usd(roundTo(scen[2].net, 100))}. 5% lower (${usd(scen[0].p)}), about ${usd(roundTo(scen[0].net, 100))}.\n\nAny questions, call me.\n\n${signature(signer)}`;
  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <h1 className="font-display text-[30px] font-semibold leading-tight md:text-[36px]">Seller net sheet</h1>
        <p className="mt-1 text-[16px] text-stone-600">What the seller walks away with. Built for the kitchen table: change the price and everything updates.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <section className={`${card} h-fit space-y-4 print:hidden`}>
          <TextField label="Property (optional)" value={address} onChange={setAddress} placeholder="2202 N Clybourn Ave #3" />
          <MoneyField label="Sale price" value={price} onChange={setPrice} testId="ns-price" />
          <MoneyField label="Loan payoff (all loans, HELOC too)" value={payoff} onChange={setPayoff} testId="ns-payoff" />
          <div className="grid grid-cols-2 gap-3">
            <PctField label="Listing side" value={listPct} onChange={setListPct} />
            <PctField label="Buyer side" value={buyerPct} onChange={setBuyerPct} hint="0 if the buyer pays" />
          </div>
          <label className="block">
            <span className={labelCls}>Where is it?</span>
            <select className={`${inputCls} mt-1`} value={loc} onChange={e => setLoc(e.target.value)} data-testid="ns-loc">
              {COUNTIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <span className="mt-1 block text-[13px] text-stone-500">Sets transfer taxes. Some suburbs charge their own, add it under Other.</span>
          </label>
          <MoneyField label="Last full-year property tax bill" value={annualTax} onChange={setAnnualTax} hint="From the tax bill or the listing. Default is a guess (1.9% of price)." />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Closing month</span>
              <select className={`${inputCls} mt-1`} value={closeMonth} onChange={e => setCloseMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </label>
            <MoneyField label="Attorney" value={attorney} onChange={setAttorney} />
          </div>
          <label className="flex items-start gap-2 text-[14px] text-stone-700">
            <input type="checkbox" checked={priorUnpaid} onChange={e => setPriorUnpaid(e.target.checked)} className="mt-0.5 size-4 accent-[#9C7434]" />
            <span>Last year's 2nd installment not paid yet <span className="block text-[13px] text-stone-500">Cook County bills a year behind. Until the 2nd bill is paid (usually late in the year), the seller credits it at closing.</span></span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            <MoneyField label="HOA fees" value={hoaFees} onChange={setHoaFees} />
            <MoneyField label="Credits" value={credits} onChange={setCredits} />
            <MoneyField label="Other" value={other} onChange={setOther} />
          </div>
          <TextField label="Seller first name (for the email)" value={seller} onChange={setSeller} placeholder="Chris" />
          <TextField label="Seller email (optional)" value={to} onChange={setTo} type="email" />
        </section>

        <div className="order-first space-y-4 lg:order-none">
          <section className="rounded-2xl bg-[#0A0A0A] p-5 text-white" data-testid="ns-result">
            {address && <p className="text-[15px] text-white/70">{address}</p>}
            <p className="text-[15px] text-white/65">Estimated walk-away at {usd(price)}</p>
            <p className="font-display text-[48px] font-semibold leading-tight" data-testid="ns-net">{usd(res.net)}</p>
            <p className="text-[14px] text-white/60">Selling costs {usd(res.costs)} ({res.costPct.toFixed(1)}% of price) · payoff {usd(payoff)}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {scen.map(s => (
                <button key={s.d} type="button" onClick={() => setPrice(s.p)} className={`rounded-xl px-2 py-2.5 ${s.d === 0 ? "bg-[#9C7434]" : "bg-white/10"} print:bg-white/10`}>
                  <span className="block text-[13px] text-white/70">{s.d === 0 ? "At this price" : s.d < 0 ? "5% lower" : "5% higher"}</span>
                  <span className="block text-[13px] text-white/60">{usd(s.p)}</span>
                  <span className="block text-[17px] font-semibold">{usd(s.net)}</span>
                </button>
              ))}
            </div>
          </section>
          <section className={card}>
            <table className="w-full text-[15px]">
              <tbody>
                <tr className="font-semibold"><td className="py-2">Sale price</td><td /><td className="py-2 text-right">{usd(price)}</td></tr>
                {res.lines.map(l => (
                  <tr key={l.label} className="border-t border-[#f0ebe2] text-stone-700">
                    <td className="py-2 pr-2">{l.label}</td>
                    <td className="py-2 pr-2 text-[13px] text-stone-500">{l.note}</td>
                    <td className="py-2 text-right">−{usd(l.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-[#f0ebe2] text-stone-700"><td className="py-2">Loan payoff</td><td /><td className="py-2 text-right">−{usd(payoff)}</td></tr>
                <tr className="border-t-2 border-[#0A0A0A] font-semibold"><td className="py-2">Estimated walk-away</td><td /><td className="py-2 text-right">{usd(res.net)}</td></tr>
              </tbody>
            </table>
            <p className="mt-3 text-[13px] text-stone-500">Estimate only. Transfer taxes: Illinois $0.50, county $0.25 and Chicago $1.50 (seller part) per $500. Title is an estimate within a few hundred dollars. The title company's closing statement has the final numbers.</p>
          </section>
          <div className="flex flex-wrap gap-2 print:hidden">
            <a className={btnDark} href={gmailLink(to, `Your net sheet${address ? `: ${address}` : ""}`, emailBody)} target="_blank" rel="noreferrer"><Mail className="size-4" /> Email it (Gmail)</a>
            <button type="button" className={btnLight} onClick={() => copyText(summary, "Net sheet copied")}>Copy</button>
            <button type="button" className={btnLight} onClick={() => window.print()}><Printer className="size-4" /> Print / PDF</button>
          </div>
        </div>
      </div>
    </div>
  );
}
