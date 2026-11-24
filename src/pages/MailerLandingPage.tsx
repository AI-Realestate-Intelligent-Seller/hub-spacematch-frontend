// Public page behind every mailer QR code: /v/:code. Logs the scan (once per browser session),
// shows the agent + property, and turns a reply into a Hub lead + Lofty Seller lead.
import { useMutation } from "convex/react";
import { CheckCircle2, Loader2, Phone, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { AGENTS, agentBySlug, agentSlug } from "@/lib/agents";
import { MAIL_OFFICE, MAIL_PHONE, mailBrokerage } from "@/lib/mailerBuilder";
import { api } from "../../convex/_generated/api";

type Landing = {
  code: string; propAddr: string; propShort: string; replied: boolean; design: string; askAddress?: boolean;
  agent: { name: string; phone: string; email: string; slug: string };
};

const TIMELINES = ["In the next 3 months", "3–6 months", "6–12 months", "1+ year", "Just curious"];
const WANTS = ["My home's value range + net sheet", "Check my home against your buyers", "A neighborhood sales report + my value", "A spring game plan for my home", "A call to talk through options", "The launch plan for my home", "Just the value, no call",
  "A fix-or-sell plan", "A move-timing plan", "A next-chapter plan", "A rental-exit review", "A property next-steps checklist", "A selling plan for my home"];

// Each mailer design makes one ask; the page repeats it (kicker, promise, default "want", button, thank-you).
type Ask = { kicker: string; intro: (first: string) => string; want: string; button: string; done: string; title: string };
const DEFAULT_ASK: Ask = {
  kicker: "Your private home value", title: "Your private home value · SpaceMatch",
  intro: f => `A value range built from real MLS sales near you, plus a net sheet showing what you'd walk away with. Prepared personally by ${f}. No call unless you ask for one.`,
  want: WANTS[0], button: "Send me my home value", done: "your value range and net sheet",
};
const SALE_ASK: Partial<Ask> = {
  kicker: "Your home's selling plan", title: "A selling plan for your home · SpaceMatch",
  intro: f => `Your postcard features a documented past sale by a SpaceMatch team member, completed at a prior brokerage. Your home needs its own plan: ${f} will review current comparable sales, preparation and launch options. Past results do not guarantee your result. No call unless you ask.`,
  want: "A selling plan for my home", button: "Request my home's selling plan", done: "your home's selling plan",
};
const ASKS: Record<string, Partial<Ask>> = {
  soldashland: SALE_ASK,
  soldoverlook: SALE_ASK,
  launch: { want: "The launch plan for my home" },
  buyers: {
    kicker: "Private buyer match", title: "Is there a buyer for your home? · SpaceMatch",
    intro: f => `Tell us a little about your home and ${f} will check it against the buyers and investors in our 23,000+ network, with a value range from real MLS sales. No call unless you ask for one.`,
    want: "Check my home against your buyers", button: "Check for a buyer match", done: "what our buyer network turns up, plus your value range",
  },
  netsheet: {
    kicker: "Your free net sheet", title: "Your free net sheet · SpaceMatch",
    intro: f => `What your home would likely sell for, and what you'd walk away with after the mortgage, taxes and closing costs. Prepared personally by ${f}. No call unless you ask for one.`,
    button: "Send me my net sheet", done: "your net sheet and value range",
  },
  market: {
    kicker: "Your free neighborhood report", title: "Your neighborhood sales report · SpaceMatch",
    intro: f => `Recent sales near you, the homes competing right now and where your home fits, pulled from the MLS by ${f}. No call unless you ask for one.`,
    want: "A neighborhood sales report + my value", button: "Send me my neighborhood report", done: "your neighborhood sales report",
  },
  spring: {
    kicker: "Your free spring game plan", title: "Your spring game plan · SpaceMatch",
    intro: f => `Your value range, a fix-or-skip list and the best week to list, prepared personally by ${f}. No call unless you ask for one.`,
    want: "A spring game plan for my home", button: "Send me my spring plan", done: "your spring game plan",
  },
  fixorsell: {
    kicker: "Your fix-or-sell plan", title: "Fix it up or sell as-is? · SpaceMatch",
    intro: f => `${f} will compare selling in today's condition with selective improvements, using comparable sales and estimated selling costs. Prep costs need quotes; no renovation return is guaranteed. No call unless you ask.`,
    want: "A fix-or-sell plan", button: "Request my fix-or-sell plan", done: "your fix-or-sell plan",
  },
  movetiming: {
    kicker: "Your move-timing plan", title: "Sell first or buy first? · SpaceMatch",
    intro: f => `${f} will help map selling first, buying first or coordinating closings around your plans. Financing requires lender approval, and transaction terms require agreement. No call unless you ask.`,
    want: "A move-timing plan", button: "Request my move-timing plan", done: "your move-timing plan",
  },
  rightsize: {
    kicker: "Your next-chapter plan", title: "A home for what's next · SpaceMatch",
    intro: f => `${f} will help compare your current home's estimated proceeds with the costs and steps of a move to a home that fits better. Tell us what you want to change. No call unless you ask.`,
    want: "A next-chapter plan", button: "Request my next-chapter plan", done: "your next-chapter plan",
  },
  landlord: {
    kicker: "Your rental-exit review", title: "Keep the rental or plan an exit? · SpaceMatch",
    intro: f => `${f} will review the property, your plans and the lease timeline you provide, then outline a potential sale path and estimated proceeds. Legal and tax questions belong with your attorney and CPA. No call unless you ask.`,
    want: "A rental-exit review", button: "Request my rental-exit review", done: "your rental-exit review",
  },
  inherited: {
    kicker: "Your property next-steps checklist", title: "Inherited-home next steps · SpaceMatch",
    intro: f => `If you're handling an inherited home, ${f} will help organize the property questions, preparation choices and next steps. Your attorney should confirm ownership and authority to sell. No call unless you ask.`,
    want: "A property next-steps checklist", button: "Request my property checklist", done: "your property next-steps checklist",
  },
};
const askFor = (design: string): Ask => ({ ...DEFAULT_ASK, ...(ASKS[design] ?? {}) });
// Original team: /mailers/agents/<slug>.png. Agents added on /team: their uploaded headshot.
const mailerPhoto = (slug: string) => {
  const a = AGENTS.find(x => agentSlug(x.name) === slug);
  return a?.photo ?? (a && !a.added ? `/mailers/agents/${slug}.png` : null);
};
const inputCls = "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-[16px] focus:outline-none focus:ring-2 focus:ring-[#9C7434]";
const tel = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;
const sms = (p: string) => `sms:${p.replace(/[^\d+]/g, "")}`;

export function MailerLandingPage() {
  const { code = "" } = useParams();
  const [params] = useSearchParams();
  const scan = useMutation(api.mailers.scan);
  const reply = useMutation(api.mailers.reply);
  const [data, setData] = useState<Landing | null | undefined>(undefined);
  const [f, setF] = useState({ fullName: "", email: "", phone: "", timeline: "", want: WANTS[0], notes: "", propAddr: "" });
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const ran = useRef(false);
  const isSample = code.toUpperCase() === "SAMPLE";

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (isSample) {
      const a = agentBySlug(params.get("a")) ?? AGENTS[0];
      setData({ code: "SAMPLE", propAddr: "1234 W Sample St, Chicago, IL 60614", propShort: "1234 W Sample St", replied: false, design: params.get("d") ?? "value", agent: { ...a, slug: agentSlug(a.name) } });
      return;
    }
    const key = `mailer-scan-${code.toUpperCase()}`;
    const repeat = sessionStorage.getItem(key) === "1";
    scan({ code, repeat })
      .then(r => {
        const l = r as Landing | null;
        setData(l);
        if (l) setF(x => ({ ...x, want: askFor(l.design).want }));
        sessionStorage.setItem(key, "1");
      })
      .catch(() => setData(null));
  }, [code, isSample, params, scan]);
  useEffect(() => {
    const ask = askFor(data?.design ?? "value");
    document.title = ask.title;
    if (isSample && data) setF(x => ({ ...x, want: ask.want }));
  }, [data, isSample]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (data?.askAddress && f.propAddr.trim().length < 5) return setErr("Please add the address of your home");
    if (f.fullName.trim().length < 2) return setErr("Please add your name");
    if (!f.email.trim() && !f.phone.trim()) return setErr("Please add an email or a phone number so we can reach you");
    if (!f.timeline) return setErr("When might you sell? Pick one (\"Just curious\" is fine)");
    if (isSample) { setDone(true); return; }
    setBusy(true);
    try {
      const { propAddr, ...rest } = f;
      await reply({ code, ...rest, propAddr: data?.askAddress ? propAddr : undefined, website: hp || undefined });
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (x) {
      const m = String((x as Error).message ?? x);
      setErr(m.match(/Uncaught Error: ([^\n]+)/)?.[1] ?? "Something went wrong. Please try again or call us.");
    } finally {
      setBusy(false);
    }
  };

  if (data === undefined) return <div className="grid min-h-svh place-items-center bg-[#0A0A0A]"><Loader2 className="size-7 animate-spin text-[#D9BC8C]" /></div>;
  if (data === null) {
    return (
      <div className="grid min-h-svh place-items-center bg-[#F7F5F1] p-6 text-center">
        <div className="max-w-sm">
          <h1 className="font-['Playfair_Display'] text-2xl">We couldn't find that code</h1>
          <p className="mt-2 text-stone-600">Please call or text SpaceMatch at <a className="font-semibold text-[#9C7434]" href={tel("(773) 985-7153")}>(773) 985-7153</a> and we'll get you your home value.</p>
        </div>
      </div>
    );
  }

  const a = data.agent;
  const first = a.name.split(" ")[0];
  const ask = askFor(data.design);
  const home = data.askAddress ? (f.propAddr.trim() || "your home") : data.propShort;
  return (
    <div className="min-h-svh bg-[#F7F5F1]" data-testid="mailer-landing">
      <header className="bg-[#0A0A0A] text-white">
        <div className="mx-auto max-w-xl px-5 pb-8 pt-6">
          <img src="/logo-white.png" alt="SpaceMatch" className="h-6" />
          {isSample && <div className="mt-4 rounded-lg bg-[#9C7434]/25 px-3 py-2 text-sm text-[#F1E3C8]">Sample page. Real mailers open this page with the homeowner's address, and replies go straight to the agent.</div>}
          <p className="mt-6 text-[15px] text-[#D9BC8C]" data-testid="mailer-kicker">{ask.kicker}</p>
          <h1 className="mt-1 font-['Playfair_Display'] text-[32px] leading-tight">{data.askAddress ? "What is your home worth?" : data.propShort}</h1>
          <p className="mt-2 text-[#ddd6ca]">{ask.intro(first)}</p>
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
            {mailerPhoto(a.slug)
              ? <img src={mailerPhoto(a.slug)!} alt={a.name} className="size-14 rounded-full ring-2 ring-[#9C7434]" />
              : <span className="flex size-14 items-center justify-center rounded-full bg-[#9C7434] font-semibold">{a.name.split(" ").map(s => s[0]).slice(0, 2).join("")}</span>}
            <div className="min-w-0 text-sm">
              <div className="font-semibold text-[16px]">{a.name}</div>
              <div className="text-[#cfc7b9]">Your SpaceMatch agent</div>
              <div className="mt-0.5 flex items-center gap-1 text-[#D9BC8C]">{[0, 1, 2, 3, 4].map(i => <Star key={i} className="size-3.5 fill-current" />)}<span className="ml-1 text-[#cfc7b9]">5.0 · 115 Zillow reviews for our team</span></div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-5 px-5 py-6">
        {done ? (
          <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-[#ebe5da]" data-testid="mailer-done">
            <CheckCircle2 className="mx-auto size-14 text-[#9C7434]" />
            <h2 className="mt-3 font-['Playfair_Display'] text-2xl">Thank you{f.fullName ? `, ${f.fullName.trim().split(" ")[0]}` : ""}!</h2>
            <p className="mt-2 text-stone-600">{first} has your request for {home} and will be in touch soon with {ask.done}.</p>
            <a href={tel(a.phone)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0A0A0A] px-4 py-3 font-semibold text-white"><Phone className="size-4" /> Call {first} now</a>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            {data.replied && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">We already have a request for this home. Send another if anything changed.</div>}
            <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]">
              {data.askAddress && (
                <div>
                  <label className="mb-1.5 block font-medium" htmlFor="addr">Your home's address</label>
                  <input id="addr" autoComplete="street-address" value={f.propAddr} onChange={e => setF({ ...f, propAddr: e.target.value })} placeholder="e.g. 1234 W Elm St, Glenview" className={inputCls} data-testid="mailer-addr" />
                </div>
              )}
              <div>
                <label className="mb-1.5 block font-medium">When might you sell?</label>
                <div className="flex flex-wrap gap-2">
                  {TIMELINES.map(t => (
                    <button key={t} type="button" onClick={() => setF({ ...f, timeline: t })} className={`rounded-full px-3.5 py-2 text-[15px] ring-1 ${f.timeline === t ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white text-stone-700 ring-stone-300"}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block font-medium" htmlFor="want">What would help most?</label>
                <select id="want" value={f.want} onChange={e => setF({ ...f, want: e.target.value })} className={inputCls}>
                  {WANTS.map(w => <option key={w}>{w}</option>)}
                </select>
              </div>
            </section>
            <section className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da] sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block font-medium" htmlFor="nm">Your name</label>
                <input id="nm" autoComplete="name" value={f.fullName} onChange={e => setF({ ...f, fullName: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block font-medium" htmlFor="ph">Mobile</label>
                <input id="ph" type="tel" autoComplete="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block font-medium" htmlFor="em">Email</label>
                <input id="em" type="email" autoComplete="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block font-medium" htmlFor="nt">Anything we should know? <span className="font-normal text-stone-400">(optional)</span></label>
                <textarea id="nt" rows={3} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Recent updates, questions, timing…" className={inputCls} />
              </div>
              <p className="text-xs text-stone-500 sm:col-span-2">Add a phone or an email, whichever you prefer. By sending, you agree that SpaceMatch Inc. may contact you about your home by call, text or email. Reply STOP to opt out anytime.</p>
            </section>
            <input tabIndex={-1} autoComplete="off" value={hp} onChange={e => setHp(e.target.value)} name="website" className="hidden" aria-hidden />
            {err && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{err}</div>}
            <button type="submit" disabled={busy} data-testid="mailer-submit" className="w-full rounded-2xl bg-[#9C7434] py-4 text-base font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 className="mx-auto size-5 animate-spin" /> : ask.button}
            </button>
            <div className="flex gap-3">
              <a href={tel(a.phone)} className="flex-1 rounded-xl bg-white py-3 text-center font-semibold ring-1 ring-[#ebe5da]">Call {first}</a>
              <a href={sms(a.phone)} className="flex-1 rounded-xl bg-white py-3 text-center font-semibold ring-1 ring-[#ebe5da]">Text {first}</a>
            </div>
          </form>
        )}
        <section className="rounded-2xl bg-[#0A0A0A] p-5 text-white">
          <div className="text-[13px] text-[#D9BC8C]">Why sellers pick SpaceMatch</div>
          <ul className="mt-2 space-y-1.5 text-[15px] text-[#e8e2d7]">
            <li>Digital staging and magazine-grade photos: shot at 2pm, ready by 7pm</li>
            <li>A 14-day launch with Reels, targeted ads and a 23,000+ buyer &amp; investor network</li>
            <li>Your own live Seller Portal: every view, showing and buyer comment</li>
            <li>Se habla español · 한국어 상담</li>
          </ul>
        </section>
        <p className="pb-6 text-center text-xs text-stone-500">{mailBrokerage()} · {MAIL_OFFICE} · {MAIL_PHONE} · Equal Housing Opportunity</p>
      </main>
    </div>
  );
}
