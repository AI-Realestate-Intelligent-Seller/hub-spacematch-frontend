// Emails (Michael 2026-10-31, from his talk with Angel): done-for-you emails first.
// Ready-made library per client group · Rent vs own builder · Move-up builder · My templates (optional
// builder, "Suggest for team" → Michael/Cris approve) · Review tab for admins/office. No AI, no sending
// from the Hub: agents send from their own Gmail, or Lofty sends the Smart Plans.
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, Calculator, ChevronDown, Download, FileText, Home, Loader2, Pencil, Plus, Send, Sparkles, Trash2, Users } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  EmailPreview, MoneyField, PctField, TextField, btnDark, btnLight, card, inputCls, labelCls, useSigner,
} from "@/components/hub/EmailBits";
import { FIELDS, GROUPS, SEGMENTS, fill, fillSubject, libraryCsv, toLofty, type LibEmail } from "@/lib/emailLibrary";
import { moveUpEmail, rentVsOwnEmail } from "@/lib/emailWriters";
import { placeOf, usd } from "@/lib/homeMath";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

type Tab = "library" | "rent" | "moveup" | "mine" | "review";
const errMsg = (e: unknown) => String((e as Error).message ?? e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? String((e as Error).message ?? e);
const LOFTY_READY = true; // 19 SM Smart Plans live in Lofty (tag-triggered) since 2026-10-31

export function EmailsPage() {
  const [params, setParams] = useSearchParams();
  const data = useQuery(api.emailTemplates.overview);
  const tab = (params.get("tab") as Tab) || "library";
  const go = (t: Tab, extra: Record<string, string> = {}) => setParams({ tab: t, ...extra }, { replace: true });
  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }>; show?: boolean }[] = [
    { id: "library", label: "Ready-made", icon: Sparkles },
    { id: "rent", label: "Rent vs own", icon: Home },
    { id: "moveup", label: "Move-up", icon: ArrowRight },
    { id: "mine", label: "My templates", icon: Pencil },
    { id: "review", label: `Review${data?.review.length ? ` (${data.review.length})` : ""}`, icon: Users, show: !!data?.canReview },
  ];
  const [draft, setDraft] = useState<{ subject: string; body: string; basedOn?: string; segment?: string; title?: string } | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[30px] font-semibold leading-tight md:text-[36px]">Emails</h1>
        <p className="mt-1 text-[16px] text-stone-600">Ready-to-send emails for every kind of client. Pick one, add their name, send it from your Gmail.</p>
        <Link to="/signature" data-testid="emails-signature" className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[14px] font-semibold text-[#7a5a26] ring-1 ring-[#D9BC8C] hover:bg-[#FBFAF7]">
          <Pencil className="size-4" /> Make your email signature <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0" role="tablist">
        {tabs.filter(t => t.show !== false).map(t => {
          const Icon = t.icon;
          const on = t.id === tab;
          return (
            <button key={t.id} type="button" role="tab" aria-selected={on} data-testid={`tab-${t.id}`} onClick={() => go(t.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[15px] font-semibold ${on ? "bg-[#9C7434] text-white" : "bg-white text-stone-700 ring-1 ring-[#ebe5da]"}`}>
              <Icon className="size-4" /> {t.label}
            </button>
          );
        })}
      </div>
      {tab === "library" && <Library team={data?.team ?? []} onEdit={d => { setDraft(d); go("mine"); }} />}
      {tab === "rent" && <RentVsOwn ratePct={data?.rate.ratePct ?? 7.24} rateNote={data ? `${data.rate.source}, ${data.rate.asOf}` : ""} canSetRate={!!data?.canReview} />}
      {tab === "moveup" && <MoveUp ratePct={data?.rate.ratePct ?? 7.24} />}
      {tab === "mine" && <MyTemplates mine={data?.mine ?? []} draft={draft} clearDraft={() => setDraft(null)} canReview={!!data?.canReview} />}
      {tab === "review" && data?.canReview && <Review rows={data.review} />}
    </div>
  );
}

// ---------------- Ready-made library ----------------
function Library({ team, onEdit }: { team: Doc<"emailTemplates">[]; onEdit: (d: { subject: string; body: string; basedOn?: string; segment?: string; title?: string }) => void }) {
  const signer = useSigner();
  const [seg, setSeg] = useState(SEGMENTS[0].id);
  const [grp, setGrp] = useState(GROUPS[0].id);
  const [first, setFirst] = useState("");
  const [to, setTo] = useState("");
  const [hood, setHood] = useState("");
  const [open, setOpen] = useState<string | null>(SEGMENTS[0].emails[0].id);
  const teamSeg = team.length ? [{ id: "team", label: `From the team (${team.length})` }] : [];
  const segment = SEGMENTS.find(s => s.id === seg);
  const emails: (LibEmail & { by?: string })[] = segment
    ? segment.emails
    : team.map(t => ({ id: t._id, step: `By ${t.ownerName}`, subject: t.subject, body: t.body, by: t.ownerName }));
  const vals = { first_name: first, neighborhood: hood, agent_first: signer.name.split(" ")[0], agent_name: signer.name, agent_phone: signer.phone };
  const download = () => {
    const blob = new Blob([libraryCsv()], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "SpaceMatch email library.csv";
    a.click();
  };
  return (
    <div className="space-y-4">
      <section className={`${card} border-l-4 border-[#9C7434]`}>
        <p className="text-[15px] leading-relaxed text-stone-700">
          <b className="text-[#0A0A0A]">How to use it:</b> send the <b>Everyone</b> email to your whole list first. Their replies tell you who's buying, selling or just renting.
          Then each group gets its own short series. {LOFTY_READY
            ? <>In Lofty, add the matching tag to the contact (for example <b>SM Renters</b>). The Smart Plan with the same name starts on its own and sends the series from you. Milestone emails (under contract, Just Sold, tax appeal) show up as tasks so you send them at the right moment.</>
            : <>Lofty versions (team templates + automatic Smart Plans) are being set up. Until then, send from here.</>}
        </p>
        <button type="button" className={`${btnLight} mt-3`} onClick={download}><Download className="size-4" /> Download all (for other CRMs)</button>
      </section>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
        {GROUPS.map(g => (
          <button key={g.id} type="button" data-testid={`grp-${g.id}`} onClick={() => { setGrp(g.id); setSeg(g.segs[0]); setOpen(null); }}
            className={`shrink-0 rounded-lg px-3.5 py-2 text-[14px] font-bold ${grp === g.id ? "bg-[#9C7434] text-white" : "bg-[#f6f1e8] text-stone-700"}`}>
            {g.label} <span className="font-normal opacity-75">({g.segs.length})</span>
          </button>
        ))}
      </div>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
        {[...SEGMENTS.filter(s => (GROUPS.find(g => g.id === grp)?.segs ?? []).includes(s.id)).map(s => ({ id: s.id, label: s.label })), ...(grp === "touch" ? teamSeg : [])].map(s => (
          <button key={s.id} type="button" data-testid={`seg-${s.id}`} onClick={() => { setSeg(s.id); setOpen(null); }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-semibold ${seg === s.id ? "bg-[#0A0A0A] text-white" : "bg-white text-stone-700 ring-1 ring-[#ebe5da]"}`}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {segment && (
            <p className="text-[15px] text-stone-600"><b className="text-stone-800">Who:</b> {segment.who} <span className="whitespace-nowrap"><b className="text-stone-800">When:</b> {segment.cadence}.</span></p>
          )}
          {emails.map(m => {
            const isOpen = open === m.id;
            const subject = fillSubject(m.subject, vals);
            const body = fill(`${m.body}`, vals);
            return (
              <div key={m.id} className={card} data-testid={`email-${m.id}`}>
                <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen(isOpen ? null : m.id)}>
                  <span>
                    <span className="block text-[13px] font-semibold text-[#9C7434]">{m.step}</span>
                    <span className="block text-[17px] font-semibold text-[#0A0A0A]">{subject}</span>
                    {!isOpen && <span className="mt-0.5 line-clamp-2 block text-[14px] text-stone-500">{body.split("\n").slice(2).join(" ")}</span>}
                  </span>
                  <ChevronDown className={`mt-1 size-5 shrink-0 text-stone-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="mt-3 space-y-3">
                    <EmailPreview subject={subject} body={body} signer={signer} to={to}
                      lofty={{ subject: toLofty(m.subject, vals), body: toLofty(m.body, { neighborhood: hood, agent_first: vals.agent_first, agent_phone: vals.agent_phone }) }} />
                    <button type="button" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#9C7434]"
                      onClick={() => onEdit({ subject: m.subject, body: m.body, basedOn: m.id, segment: segment?.id ?? "other", title: `${m.subject} (my version)` })}>
                      <Pencil className="size-4" /> Make my own version
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <aside className={`${card} h-fit space-y-3 lg:sticky lg:top-24`}>
          <p className="font-semibold">Fill in for this client <span className="font-normal text-stone-500">(optional)</span></p>
          <TextField label="First name" value={first} onChange={setFirst} placeholder="Jordan" testId="lib-first" />
          <TextField label="Their email" value={to} onChange={setTo} placeholder="jordan@gmail.com" type="email" />
          <TextField label="Neighborhood" value={hood} onChange={setHood} placeholder="Lakeview" />
          <p className="text-[13px] text-stone-500">Blank is fine. The email says "Hi there" and "your neighborhood" instead. Your name, phone and the team line are added at the bottom.</p>
        </aside>
      </div>
    </div>
  );
}

// ---------------- Rent vs own ----------------
const EXTRAS = [300, 500, 600];
function RentVsOwn({ ratePct, rateNote, canSetRate }: { ratePct: number; rateNote: string; canSetRate: boolean }) {
  const signer = useSigner();
  const [first, setFirst] = useState("");
  const [to, setTo] = useState("");
  const [zip, setZip] = useState("");
  const [rent, setRent] = useState(2500);
  const [extra, setExtra] = useState(500);
  const [custom, setCustom] = useState(false);
  const [kind, setKind] = useState<"condo" | "house">("condo");
  const [buys, setBuys] = useState("");
  const [more, setMore] = useState(false);
  const [rate, setRate] = useState<number | null>(null);
  const [down, setDown] = useState(10);
  const [tax, setTax] = useState(2);
  const [hoa, setHoa] = useState<number | null>(null);
  const [ins, setIns] = useState<number | null>(null);
  const [appr, setAppr] = useState(3);
  const [rentUp, setRentUp] = useState(3);
  const [save, setSave] = useState(4);
  const [compare, setCompare] = useState(true);
  const setTeamRate = useMutation(api.emailTemplates.setRate);
  const place = placeOf(zip);
  const input = {
    rent, extra, zip, ratePct: rate ?? ratePct, downPct: down, taxPct: tax,
    hoa: hoa ?? (kind === "condo" ? 400 : 0), insurance: ins ?? (kind === "condo" ? 35 : 150), pmiPct: 0.5,
    appreciationPct: appr, rentGrowthPct: rentUp, savingsPct: save, commissionPct: 6,
  };
  const built = useMemo(() => rentVsOwnEmail(input, { firstName: first, buys, showSavings: compare }), [JSON.stringify(input), first, buys, compare]);
  const r = built.r;
  const row = (label: string, a: string, b: string, strong = false) => (
    <tr className={strong ? "font-semibold text-[#0A0A0A]" : "text-stone-700"}>
      <td className="py-1.5 pr-2">{label}</td><td className="py-1.5 text-right">{a}</td><td className="py-1.5 text-right">{b}</td>
    </tr>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <section className={`${card} h-fit space-y-4`}>
        <p className="text-[15px] text-stone-600">Fill in 3 boxes. The Hub works out what they can buy and writes the email with their numbers.</p>
        <TextField label="Client first name" value={first} onChange={setFirst} placeholder="Jordan" testId="rvo-first" />
        <TextField label="Zip code where they'd buy" value={zip} onChange={setZip} placeholder="60611" testId="rvo-zip"
          hint={place ? `${place.name}${place.chicago ? ", Chicago" : ""}` : "Sets the area name, property tax and transfer tax."} />
        <MoneyField label="Rent they pay now (per month)" value={rent} onChange={setRent} testId="rvo-rent" />
        <div>
          <span className={labelCls}>How much more per month to show them</span>
          <div className="mt-1 grid grid-cols-4 gap-2">
            {EXTRAS.map(x => (
              <button key={x} type="button" data-testid={`rvo-extra-${x}`} onClick={() => { setExtra(x); setCustom(false); }}
                className={`rounded-xl py-2.5 text-[15px] font-semibold ${!custom && extra === x ? "bg-[#0A0A0A] text-white" : "bg-[#F7F5F1] ring-1 ring-[#ebe5da]"}`}>+${x}</button>
            ))}
            <button type="button" onClick={() => setCustom(true)} className={`rounded-xl py-2.5 text-[15px] font-semibold ${custom ? "bg-[#0A0A0A] text-white" : "bg-[#F7F5F1] ring-1 ring-[#ebe5da]"}`}>Other</button>
          </div>
          {custom && <div className="mt-2"><MoneyField label="Extra per month" value={extra} onChange={setExtra} /></div>}
        </div>
        <div>
          <span className={labelCls}>What they'd buy</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(["condo", "house"] as const).map(k => (
              <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-xl py-2.5 text-[15px] font-semibold ${kind === k ? "bg-[#0A0A0A] text-white" : "bg-[#F7F5F1] ring-1 ring-[#ebe5da]"}`}>
                {k === "condo" ? "Condo / townhome" : "House"}
              </button>
            ))}
          </div>
        </div>
        <TextField label="What that price buys there (optional)" value={buys} onChange={setBuys} placeholder="a 1-bed condo with in-unit laundry" hint="Your words, from what you've seen sell. Goes into the email." />
        <TextField label="Their email (optional)" value={to} onChange={setTo} type="email" placeholder="jordan@gmail.com" />
        <button type="button" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#9C7434]" onClick={() => setMore(!more)}>
          <ChevronDown className={`size-4 transition-transform ${more ? "rotate-180" : ""}`} /> Assumptions (rate, down payment, taxes)
        </button>
        {more && (
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#F7F5F1] p-3">
            <PctField label="Rate" value={rate ?? ratePct} onChange={setRate} hint={rate === null ? rateNote : "Your number"} />
            <PctField label="Down payment" value={down} onChange={setDown} />
            <PctField label="Property tax / yr" value={tax} onChange={setTax} hint="% of price" />
            <MoneyField label="HOA / mo" value={hoa ?? (kind === "condo" ? 400 : 0)} onChange={setHoa} />
            <MoneyField label="Insurance / mo" value={ins ?? (kind === "condo" ? 35 : 150)} onChange={setIns} />
            <PctField label="Value growth / yr" value={appr} onChange={setAppr} />
            <PctField label="Rent growth / yr" value={rentUp} onChange={setRentUp} />
            <PctField label="Savings account" value={save} onChange={setSave} />
            <label className="col-span-2 flex items-center gap-2 text-[14px] text-stone-700">
              <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} className="size-4 accent-[#9C7434]" />
              Include the fair comparison (renting and saving the difference)
            </label>
            {canSetRate && rate !== null && rate !== ratePct && (
              <button type="button" className={`${btnLight} col-span-2`} onClick={() => setTeamRate({ ratePct: rate }).then(() => { toast.success(`Team rate set to ${rate}%`); setRate(null); })}>
                Make {rate}% the team rate
              </button>
            )}
          </div>
        )}
      </section>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#0A0A0A] p-5 text-white" data-testid="rvo-result">
          <p className="text-[15px] text-white/65">{usd(r.budget)}/mo all in buys about</p>
          <p className="font-display text-[44px] font-semibold leading-tight" data-testid="rvo-price">{usd(Math.round(r.price / 1000) * 1000)}</p>
          <p className="text-[14px] text-white/60">in {r.place.name} · {r.monthly.pmi ? `${down}% down` : `${down}% down`} · {(rate ?? ratePct)}% rate · cash to close ≈ {usd(Math.round(r.cashIn / 1000) * 1000)}</p>
          <table className="mt-4 w-full text-[14px] [&_td]:border-t [&_td]:border-white/10">
            <thead><tr className="text-white/55"><th className="py-1 text-left font-normal">If they sell after</th><th className="text-right font-normal">5 years</th><th className="text-right font-normal">10 years</th></tr></thead>
            <tbody className="[&_tr]:text-white/80">
              {row("Rent paid (gone)", usd(r.five.rentPaid), usd(r.ten.rentPaid))}
              {row("Owning payments", usd(r.five.ownPaid), usd(r.ten.ownPaid))}
              {row("Walk away with", usd(r.five.walkAway), usd(r.ten.walkAway), true)}
              {row("…minus cash put in", usd(r.five.gain), usd(r.ten.gain))}
              {compare && row("Renter who saved instead", usd(r.five.renterSavings), usd(r.ten.renterSavings))}
            </tbody>
          </table>
          <p className="mt-3 text-[13px] text-white/50">Walk away = sale price after {appr}%/yr growth, minus ~6% commission, transfer taxes, title and attorney, minus the loan balance.</p>
        </section>
        <EmailPreview subject={built.subject} body={built.body} signer={signer} to={to} testId="rvo-email" />
      </div>
    </div>
  );
}

// ---------------- Move-up ----------------
function MoveUp({ ratePct }: { ratePct: number }) {
  const signer = useSigner();
  const [first, setFirst] = useState("");
  const [to, setTo] = useState("");
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");
  const [value, setValue] = useState(650000);
  const [payoff, setPayoff] = useState(250000);
  const [currentPI, setCurrentPI] = useState(0);
  const [nextPrice, setNextPrice] = useState(800000);
  const [keep, setKeep] = useState(75000);
  const [rate, setRate] = useState<number | null>(null);
  const [kind, setKind] = useState<"condo" | "house">("house");
  const [comm, setComm] = useState(6);
  const place = placeOf(zip) ?? { county: "cook" as const, chicago: true, name: "Chicago", zip: "" };
  const input = { value, payoff, currentPI, place, commissionPct: comm, nextPrice, keep, ratePct: rate ?? ratePct, taxPct: 2, hoa: kind === "condo" ? 450 : 0, insurance: kind === "condo" ? 40 : 175 };
  const built = useMemo(() => moveUpEmail(input, { firstName: first, address }), [JSON.stringify(input), first, address]);
  const r = built.r;
  const netLink = `/net-sheet?price=${value}&payoff=${payoff}${zip ? `&zip=${zip}` : ""}${address ? `&address=${encodeURIComponent(address)}` : ""}`;
  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <section className={`${card} h-fit space-y-4`}>
        <p className="text-[15px] text-stone-600">For owners: sell, buy the next place, and keep cash in the bank. The Hub writes the email with their numbers.</p>
        <TextField label="Client first name" value={first} onChange={setFirst} placeholder="Chris" testId="mu-first" />
        <TextField label="Their home (optional)" value={address} onChange={setAddress} placeholder="2202 N Clybourn Ave" />
        <TextField label="Zip code" value={zip} onChange={setZip} placeholder="60614" hint={zip && placeOf(zip) ? placeOf(zip)!.name : "Sets the transfer taxes."} />
        <MoneyField label="What their home would sell for" value={value} onChange={setValue} testId="mu-value" hint="Use your comps." />
        <MoneyField label="Loan payoff" value={payoff} onChange={setPayoff} />
        <MoneyField label="Next home price" value={nextPrice} onChange={setNextPrice} testId="mu-next" />
        <MoneyField label="Cash to keep in the bank" value={keep} onChange={setKeep} testId="mu-keep" />
        <div className="grid grid-cols-2 gap-2">
          {(["condo", "house"] as const).map(k => (
            <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-xl py-2.5 text-[15px] font-semibold ${kind === k ? "bg-[#0A0A0A] text-white" : "bg-[#F7F5F1] ring-1 ring-[#ebe5da]"}`}>
              Next: {k === "condo" ? "condo" : "house"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <PctField label="Rate on new loan" value={rate ?? ratePct} onChange={setRate} />
          <PctField label="Commission" value={comm} onChange={setComm} />
        </div>
        <MoneyField label="Their payment today, P&I (optional)" value={currentPI} onChange={setCurrentPI} />
        <TextField label="Their email (optional)" value={to} onChange={setTo} type="email" />
      </section>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#0A0A0A] p-5 text-white" data-testid="mu-result">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-[14px] text-white/60">Walk away with</p><p className="font-display text-[32px] font-semibold">{usd(r.walkAway)}</p></div>
            <div><p className="text-[14px] text-white/60">Keep in the bank</p><p className="font-display text-[32px] font-semibold text-[#D9BC8C]">{usd(r.keep)}</p></div>
            <div><p className="text-[14px] text-white/60">Down on the next home</p><p className="text-[20px] font-semibold">{usd(r.down)} <span className="text-white/50">({Math.round(r.downPct)}%)</span></p></div>
            <div><p className="text-[14px] text-white/60">New payment, all in</p><p className="text-[20px] font-semibold">{usd(r.monthly.total)}/mo</p></div>
          </div>
          <Link to={netLink} className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#D9BC8C]"><Calculator className="size-4" /> Open the full net sheet</Link>
        </section>
        <EmailPreview subject={built.subject} body={built.body} signer={signer} to={to} testId="mu-email" />
      </div>
    </div>
  );
}

// ---------------- My templates (optional builder) ----------------
const STATUS: Record<string, [string, string]> = {
  mine: ["Just me", "bg-stone-100 text-stone-700"],
  suggested: ["Waiting for approval", "bg-amber-100 text-amber-800"],
  team: ["In the team library", "bg-emerald-100 text-emerald-800"],
  declined: ["Not added to team", "bg-stone-100 text-stone-500"],
};
function MyTemplates({ mine, draft, clearDraft, canReview }: {
  mine: Doc<"emailTemplates">[]; draft: { subject: string; body: string; basedOn?: string; segment?: string; title?: string } | null; clearDraft: () => void; canReview: boolean;
}) {
  const signer = useSigner();
  const saveT = useMutation(api.emailTemplates.save);
  const removeT = useMutation(api.emailTemplates.remove);
  const suggestT = useMutation(api.emailTemplates.suggest);
  const [edit, setEdit] = useState<{ id?: Id<"emailTemplates">; title: string; segment: string; subject: string; body: string; basedOn?: string } | null>(
    draft ? { title: draft.title ?? "", segment: draft.segment ?? "other", subject: draft.subject, body: draft.body, basedOn: draft.basedOn } : null,
  );
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const insert = (key: string) => {
    if (!edit) return;
    const el = bodyRef.current;
    const tok = `{${key}}`;
    const at = el?.selectionStart ?? edit.body.length;
    const body = edit.body.slice(0, at) + tok + edit.body.slice(el?.selectionEnd ?? at);
    setEdit({ ...edit, body });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + tok.length, at + tok.length); });
  };
  const start = (from?: LibEmail) => {
    clearDraft();
    setEdit(from ? { title: `${from.subject} (my version)`, segment: "other", subject: from.subject, body: from.body, basedOn: from.id } : { title: "", segment: "other", subject: "", body: "Hi {first_name},\n\n" });
  };
  const doSave = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      await saveT({ id: edit.id, title: edit.title, segment: edit.segment, subject: edit.subject, body: edit.body, basedOn: edit.basedOn });
      toast.success("Saved to My templates");
      setEdit(null); clearDraft();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const sample = Object.fromEntries(FIELDS.map(f => [f.key, f.key.startsWith("agent") ? (f.key === "agent_name" ? signer.name : f.key === "agent_phone" ? signer.phone : signer.name.split(" ")[0]) : f.sample]));
  if (edit) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className={`${card} space-y-3`} data-testid="tpl-editor">
          <p className="text-[15px] text-stone-600">Start from a ready-made email or a blank page. Tap a field to drop it in where your cursor is.</p>
          <TextField label="Name it (only you see this)" value={edit.title} onChange={t => setEdit({ ...edit, title: t })} placeholder="Open house follow-up" testId="tpl-title" />
          <label className="block">
            <span className={labelCls}>Who it's for</span>
            <select className={`${inputCls} mt-1`} value={edit.segment} onChange={e => setEdit({ ...edit, segment: e.target.value })}>
              {SEGMENTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              <option value="other">Other</option>
            </select>
          </label>
          <TextField label="Subject" value={edit.subject} onChange={t => setEdit({ ...edit, subject: t })} placeholder="Quick question, {first_name}" testId="tpl-subject" />
          <div>
            <span className={labelCls}>Email</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {FIELDS.map(f => (
                <button key={f.key} type="button" onClick={() => insert(f.key)} className="rounded-full bg-[#9C7434]/10 px-3 py-1 text-[13px] font-semibold text-[#9C7434]">+ {f.label}</button>
              ))}
            </div>
            <textarea ref={bodyRef} data-testid="tpl-body" className={`${inputCls} mt-2 min-h-[280px] font-[inherit] leading-relaxed`} value={edit.body} onChange={e => setEdit({ ...edit, body: e.target.value })} />
            <p className="mt-1 text-[13px] text-stone-500">Don't add a sign-off. Your name, phone and the team line are added for you.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnDark} onClick={doSave} disabled={busy} data-testid="tpl-save">{busy ? <Loader2 className="size-4 animate-spin" /> : null} Save</button>
            <button type="button" className={btnLight} onClick={() => { setEdit(null); clearDraft(); }}>Cancel</button>
          </div>
        </section>
        <div>
          <p className="mb-2 text-[14px] font-semibold text-stone-600">Preview with a sample client</p>
          <EmailPreview subject={fillSubject(edit.subject || "(no subject)", sample)} body={fill(edit.body, sample)} signer={signer} />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <section className={`${card} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}>
        <div>
          <p className="font-semibold">Want to write your own?</p>
          <p className="text-[15px] text-stone-600">Optional. Most agents just use Ready-made. Your templates are only yours until you tap <b>Suggest for team</b>{canReview ? "" : " and Michael or Cris approves it"}.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={btnDark} onClick={() => start()} data-testid="tpl-new"><Plus className="size-4" /> Blank</button>
          <Link to="/emails?tab=library" className={btnLight}><FileText className="size-4" /> Start from ready-made</Link>
        </div>
      </section>
      {mine.length === 0 && <p className="text-center text-[15px] text-stone-500">No templates yet.</p>}
      {mine.map(t => (
        <TemplateRow key={t._id} t={t} signer={signer}
          actions={
            <>
              <button type="button" className={btnLight} onClick={() => setEdit({ id: t._id, title: t.title, segment: t.segment, subject: t.subject, body: t.body })}><Pencil className="size-4" /> Edit</button>
              {(t.status === "mine" || t.status === "declined") && (
                <button type="button" className={btnLight} data-testid="tpl-suggest" onClick={() => suggestT({ id: t._id }).then(s => toast.success(s === "team" ? "Added to the team library" : "Sent to Michael and Cris to approve")).catch(e => toast.error(errMsg(e)))}>
                  <Send className="size-4" /> Suggest for team
                </button>
              )}
              <button type="button" className={`${btnLight} text-red-700`} onClick={() => { if (confirm("Delete this template?")) removeT({ id: t._id }); }}><Trash2 className="size-4" /></button>
            </>
          } />
      ))}
    </div>
  );
}

function TemplateRow({ t, signer, actions }: { t: Doc<"emailTemplates">; signer: ReturnType<typeof useSigner>; actions: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [label, cls] = STATUS[t.status] ?? STATUS.mine;
  const seg = SEGMENTS.find(s => s.id === t.segment)?.label ?? "Other";
  return (
    <div className={card} data-testid="tpl-row">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" className="text-left" onClick={() => setOpen(!open)}>
          <span className="block text-[17px] font-semibold">{t.title}</span>
          <span className="block text-[14px] text-stone-500">{seg} · {t.subject}</span>
        </button>
        <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${cls}`}>{label}</span>
      </div>
      {t.reviewNote && <p className="mt-2 text-[14px] text-stone-600"><b>Note:</b> {t.reviewNote}</p>}
      {open && <div className="mt-3"><EmailPreview subject={fillSubject(t.subject, {})} body={fill(t.body, {})} signer={signer} lofty={{ subject: toLofty(t.subject), body: toLofty(t.body) }} /></div>}
      <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

// ---------------- Review (admins + office) ----------------
function Review({ rows }: { rows: Doc<"emailTemplates">[] }) {
  const signer = useSigner();
  const review = useMutation(api.emailTemplates.review);
  if (!rows.length) return <p className={`${card} text-center text-[15px] text-stone-500`}>Nothing waiting. When an agent suggests an email for the team, it shows up here and you get an email.</p>;
  return (
    <div className="space-y-3">
      {rows.map(t => (
        <div key={t._id}>
          <p className="mb-1 text-[14px] text-stone-500">From <b className="text-stone-700">{t.ownerName}</b></p>
          <TemplateRow t={t} signer={signer}
            actions={
              <>
                <button type="button" className={btnDark} onClick={() => review({ id: t._id, approve: true }).then(() => toast.success("Added to the team library"))}>Approve for team</button>
                <button type="button" className={btnLight} onClick={() => { const note = prompt("Why not? (optional, the agent sees this)") ?? undefined; review({ id: t._id, approve: false, note }).then(() => toast.success("Sent back")); }}>Not now</button>
              </>
            } />
        </div>
      ))}
    </div>
  );
}
