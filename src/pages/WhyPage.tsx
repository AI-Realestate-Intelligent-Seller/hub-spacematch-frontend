import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight, BadgeCheck, CalendarCheck, Check, ChevronLeft, ChevronRight, Home, KeyRound, Loader2, MessageSquare,
  MoveHorizontal, Phone, Play, Quote, Repeat, Sparkles, Star, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { agentBySlug } from "@/lib/agents";
import { profileFor } from "@/lib/rosterProfiles";
import { smsHref, telHref } from "@/lib/hub";
import {
  BOTH_OPTIONS, BOTH_ROWS, BUY_ROWS, BUY_STEPS, CASES, LAUNCH, OFFICE, PATH_LABEL, REVIEWS, SELL_ROWS, STAGING, STATS,
  TEAM_LINE, type WhyPath, brokerageLine,
} from "@/lib/whyContent";
import { api } from "../../convex/_generated/api";
import { buildDemoData } from "./DemoSellerPage";
import { SellerPortalView } from "./SellerPortalPage";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const num = (s: string) => Number(s.replace(/[^\d.]/g, "")) || 0;

// ---------- tracking ----------
function useTracker(token: string | null) {
  const ping = useMutation(api.whyLinks.ping);
  const sent = useRef(new Set<string>());
  const send = useCallback(
    (a: { open?: boolean; section?: string; action?: string; path?: string }) => {
      if (!token) return;
      ping({ token, ...a }).catch(() => {});
    },
    [token, ping],
  );
  useEffect(() => {
    if (!token) return;
    send({ open: true, section: "intro" });
    const beat = setInterval(() => { if (document.visibilityState === "visible") send({}); }, 20_000);
    const vis = () => { if (document.visibilityState === "visible") send({}); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(beat); document.removeEventListener("visibilitychange", vis); };
  }, [token, send]);
  const action = useCallback((name: string) => {
    if (sent.current.has(name)) return;
    sent.current.add(name);
    send({ action: name });
  }, [send]);
  return { send, action };
}

function useSectionWatch(onSection: (id: string) => void, deps: unknown[]) {
  useEffect(() => {
    let last = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = (e.target as HTMLElement).dataset.why ?? "";
          if (id && id !== last) {
            last = id;
            clearTimeout(timer);
            timer = setTimeout(() => onSection(id), 400);
          }
        }
      },
      { threshold: 0, rootMargin: "-45% 0px -45% 0px" },
    );
    document.querySelectorAll("[data-why]").forEach(el => io.observe(el));
    return () => { io.disconnect(); clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// ---------- small pieces ----------
function Eyebrow({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return <p className={`text-[14px] font-semibold ${light ? "text-[#D9BC8C]" : "text-[#9C7434]"}`}>{children}</p>;
}
function H2({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return <h2 className={`font-display mt-1 text-[28px] md:text-[38px] leading-[1.15] font-semibold ${light ? "text-white" : "text-[#0A0A0A]"}`}>{children}</h2>;
}
function Section({ id, dark, children, className = "" }: { id: string; dark?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <section data-why={id} id={id} className={`px-5 py-14 md:py-20 ${dark ? "bg-[#0A0A0A] text-white" : ""} ${className}`}>
      <div className="mx-auto max-w-3xl">{children}</div>
    </section>
  );
}

function BeforeAfter({ onUse }: { onUse: () => void }) {
  const [i, setI] = useState(0);
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const move = (x: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100)));
    onUse();
  };
  const ex = STAGING[i];
  return (
    <div>
      <div
        ref={box}
        className="relative aspect-[3/2] w-full select-none overflow-hidden rounded-2xl bg-stone-200 touch-none shadow-xl"
        onPointerDown={e => { drag.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); move(e.clientX); }}
        onPointerMove={e => drag.current && move(e.clientX)}
        onPointerUp={() => { drag.current = false; }}
        data-testid="before-after"
      >
        <img src={ex.after} alt="After digital staging" className="absolute inset-0 size-full object-cover" draggable={false} />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <img src={ex.before} alt="Before, empty room" className="absolute inset-0 size-full object-cover" draggable={false} />
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-black/65 px-3 py-1 text-sm font-semibold text-white">Before</span>
        <span className="absolute right-3 top-3 rounded-full bg-[#9C7434] px-3 py-1 text-sm font-semibold text-white">After</span>
        <div className="absolute inset-y-0" style={{ left: `${pos}%` }}>
          <div className="absolute inset-y-0 -ml-px w-0.5 bg-white shadow" />
          <div className="absolute top-1/2 -ml-6 -mt-6 grid size-12 place-items-center rounded-full bg-white text-[#0A0A0A] shadow-lg">
            <MoveHorizontal className="size-5" />
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] text-stone-600">Drag the handle. Same room, same day.</p>
        <div className="flex gap-2">
          {STAGING.map((s, k) => (
            <button key={s.label} type="button" onClick={() => { setI(k); setPos(50); onUse(); }}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ring-1 ${k === i ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white text-stone-700 ring-stone-300"}`}>
              Example {k + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Compare({ path, onUse }: { path: WhyPath; onUse: () => void }) {
  const [sm, setSm] = useState(false);
  const rows = path === "sell" ? SELL_ROWS : path === "buy" ? BUY_ROWS : [...BOTH_ROWS, ...SELL_ROWS.slice(0, 5), BUY_ROWS[0], BUY_ROWS[1]];
  return (
    <div>
      <div className="sticky top-16 z-10 mx-auto flex w-full max-w-md rounded-full bg-white/10 p-1 ring-1 ring-white/20 backdrop-blur" role="tablist">
        {[false, true].map(v => (
          <button key={String(v)} type="button" role="tab" aria-selected={sm === v}
            onClick={() => { setSm(v); onUse(); }}
            className={`flex-1 rounded-full px-4 py-2.5 text-[15px] font-semibold transition-colors ${sm === v ? (v ? "bg-[#9C7434] text-white" : "bg-white text-[#0A0A0A]") : "text-white/75"}`}>
            {v ? "The SpaceMatch way" : "The typical way"}
          </button>
        ))}
      </div>
      {!sm && (
        <button type="button" onClick={() => { setSm(true); onUse(); }} className="mx-auto mt-3 flex items-center gap-1.5 text-[15px] text-[#D9BC8C] animate-pulse">
          Tap to see the difference <ArrowRight className="size-4" />
        </button>
      )}
      <ul className="mt-6 divide-y divide-white/12">
        {rows.map(r => (
          <li key={r.k} className="grid grid-cols-[110px_1fr] gap-4 py-4 md:grid-cols-[150px_1fr]">
            <span className="pt-0.5 text-[15px] font-semibold text-white/60">{r.k}</span>
            <span className={`flex items-start gap-2.5 text-[17px] leading-snug transition-all duration-300 ${sm ? "text-white" : "text-white/55"}`}>
              {sm ? <Check className="mt-0.5 size-5 shrink-0 text-[#D9BC8C]" /> : <X className="mt-0.5 size-5 shrink-0 text-white/35" />}
              <span key={`${r.k}-${sm}`} className="animate-in fade-in slide-in-from-bottom-1 duration-300">{sm ? r.sm : r.typical}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Steps({ items, onUse }: { items: { d?: string; t: string; body: string }[]; onUse: () => void }) {
  const [i, setI] = useState(0);
  const cur = items[i];
  return (
    <div>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2" style={{ scrollbarWidth: "none" }}>
        {items.map((s, k) => (
          <button key={s.t} type="button" onClick={() => { setI(k); onUse(); }}
            className={`shrink-0 rounded-xl px-3.5 py-2.5 text-left ring-1 transition-colors ${k === i ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : k < i ? "bg-[#F1E7D4] text-[#0A0A0A] ring-[#E3D2B0]" : "bg-white text-stone-700 ring-stone-200"}`}>
            <span className={`block text-[13px] font-semibold ${k === i ? "text-[#D9BC8C]" : "text-[#9C7434]"}`}>{s.d ?? `Step ${k + 1}`}</span>
            <span className="block text-[15px] font-semibold">{s.t}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200 shadow-sm min-h-[120px]">
        <p className="text-[14px] font-semibold text-[#9C7434]">{cur.d ?? `Step ${i + 1} of ${items.length}`}</p>
        <p className="font-display mt-1 text-[24px] font-semibold">{cur.t}</p>
        <p className="mt-2 text-[17px] leading-relaxed text-stone-700">{cur.body}</p>
        <div className="mt-4 flex justify-between">
          <button type="button" disabled={i === 0} onClick={() => { setI(i - 1); onUse(); }} className="flex items-center gap-1 text-[15px] text-stone-500 disabled:opacity-30"><ChevronLeft className="size-4" /> Back</button>
          <button type="button" disabled={i === items.length - 1} onClick={() => { setI(i + 1); onUse(); }} className="flex items-center gap-1 text-[15px] font-semibold text-[#9C7434] disabled:opacity-30">Next <ChevronRight className="size-4" /></button>
        </div>
      </div>
    </div>
  );
}

function Calculator({ path, onUse }: { path: WhyPath; onUse: () => void }) {
  const [value, setValue] = useState("650,000");
  const [payoff, setPayoff] = useState("250,000");
  const [cost, setCost] = useState(8);
  const [down, setDown] = useState(20);
  const [price, setPrice] = useState("550,000");
  const [rate, setRate] = useState("6.5");
  const net = Math.max(0, num(value) * (1 - cost / 100) - num(payoff));
  const power = down > 0 ? net / (down / 100) : 0;
  const loan = num(price) * (1 - down / 100);
  const r = num(rate) / 100 / 12;
  const pmt = r > 0 ? (loan * r) / (1 - (1 + r) ** -360) : loan / 360;
  const inputCls = "w-full rounded-xl border border-stone-300 bg-white py-3 pl-7 pr-3 text-[17px] outline-none focus:border-[#9C7434] focus:ring-2 focus:ring-[#9C7434]/20";
  const Money = ({ label, v, set }: { label: string; v: string; set: (s: string) => void }) => (
    <label className="block">
      <span className="text-[15px] font-semibold text-stone-700">{label}</span>
      <div className="relative mt-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
        <input inputMode="numeric" className={inputCls} value={v}
          onChange={e => { const d = e.target.value.replace(/\D/g, ""); set(d ? Number(d).toLocaleString("en-US") : ""); onUse(); }} />
      </div>
    </label>
  );
  const Slider = ({ label, v, set, min, max, suffix }: { label: string; v: number; set: (n: number) => void; min: number; max: number; suffix: string }) => (
    <label className="block">
      <span className="flex justify-between text-[15px] font-semibold text-stone-700"><span>{label}</span><span className="text-[#9C7434]">{v}{suffix}</span></span>
      <input type="range" min={min} max={max} value={v} onChange={e => { set(Number(e.target.value)); onUse(); }} className="mt-2 w-full accent-[#9C7434]" />
    </label>
  );
  if (path === "buy") {
    return (
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <Money label="Home price" v={price} set={setPrice} />
          <Slider label="Down payment" v={down} set={setDown} min={3} max={50} suffix="%" />
          <label className="block">
            <span className="text-[15px] font-semibold text-stone-700">Interest rate (example, your lender sets the real one)</span>
            <input inputMode="decimal" className={`${inputCls} pl-3`} value={rate} onChange={e => { setRate(e.target.value.replace(/[^\d.]/g, "")); onUse(); }} />
          </label>
        </div>
        <div className="rounded-2xl bg-[#0A0A0A] p-6 text-white">
          <p className="text-[15px] text-white/65">Principal & interest, 30-year</p>
          <p className="font-display mt-1 text-[44px] font-semibold" data-testid="calc-result">{money(pmt)}<span className="text-[20px] text-white/60">/mo</span></p>
          <p className="mt-3 text-[15px] text-white/70">Down payment {money(num(price) * down / 100)} · loan {money(loan)}. Taxes, insurance and HOA are extra.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-4">
        <Money label="What you think it's worth" v={value} set={setValue} />
        <Money label="Mortgage payoff (rough is fine)" v={payoff} set={setPayoff} />
        <Slider label="Selling costs (commission, title, transfer tax, attorney)" v={cost} set={setCost} min={3} max={10} suffix="%" />
        {path === "both" && <Slider label="Down payment on your next home" v={down} set={setDown} min={5} max={50} suffix="%" />}
      </div>
      <div className="rounded-2xl bg-[#0A0A0A] p-6 text-white">
        <p className="text-[15px] text-white/65">Estimated walk-away</p>
        <p className="font-display mt-1 text-[44px] font-semibold" data-testid="calc-result">{money(net)}</p>
        {path === "both" && (
          <div className="mt-4 border-t border-white/15 pt-4">
            <p className="text-[15px] text-white/65">With {down}% down, that could support a next home around</p>
            <p className="font-display mt-1 text-[34px] font-semibold text-[#D9BC8C]">{money(power)}</p>
          </div>
        )}
        <p className="mt-4 text-[14px] leading-relaxed text-white/60">A rough estimate, not an appraisal. Your agent prepares a real net sheet from comps for your home.</p>
      </div>
    </div>
  );
}

function PortalDemo({ onClose }: { onClose: () => void }) {
  const data = useMemo(() => buildDemoData(), []);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="fixed inset-0 z-50 bg-black/70 md:grid md:place-items-center md:p-6" role="dialog" aria-label="Seller Portal demo">
      <div className="relative h-full w-full overflow-y-auto bg-[#F7F5F1] md:h-[88vh] md:max-w-[440px] md:rounded-[36px] md:ring-8 md:ring-[#1c1c1c]">
        <SellerPortalView data={data} token="demo" demo
          top={<p className="rounded-2xl bg-[#FBF3E4] p-4 text-[15px] ring-1 ring-[#E8D3A8]"><b>Demo listing.</b> Every number here is made up. Your own page fills in by itself from Zillow, ShowingTime, Instagram and your ads.</p>} />
        <div className="h-20" />
      </div>
      <button type="button" onClick={onClose} className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#9C7434] px-5 py-3 text-[16px] font-semibold text-white shadow-2xl" data-testid="close-demo">
        <X className="size-4" /> Close demo
      </button>
    </div>
  );
}

// ---------- page ----------
export function WhyPage() {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const token = params.get("k");
  const link = useQuery(api.whyLinks.view, token ? { token } : "skip");
  const agent = agentBySlug(slug);
  const prof = profileFor(slug);
  const first = agent?.name.split(" ")[0] ?? "";
  const urlPath = params.get("for") as WhyPath | null;
  const [path, setPath] = useState<WhyPath | null>(urlPath && ["sell", "buy", "both"].includes(urlPath) ? urlPath : null);
  const [demo, setDemo] = useState(false);
  const [video, setVideo] = useState(false);
  const { send, action } = useTracker(token && link !== null ? token : null);
  const prospect = link?.prospectName ?? params.get("n") ?? "";

  useEffect(() => { if (link && !path) setPath(link.path as WhyPath); }, [link, path]);
  useEffect(() => {
    document.title = agent ? `Why SpaceMatch · ${agent.name}` : "SpaceMatch Inc.";
  }, [agent]);
  useSectionWatch(id => send({ section: id }), [path, send, !!link]);

  if (!agent) {
    return <div className="grid min-h-svh place-items-center bg-[#F7F5F1] p-6 text-center text-stone-600">This link isn't valid anymore. Please ask your SpaceMatch agent for a new one.</div>;
  }
  if (token && link === undefined) {
    return <div className="grid min-h-svh place-items-center bg-[#0A0A0A]"><Loader2 className="size-7 animate-spin text-[#D9BC8C]" /></div>;
  }
  const choose = (p: WhyPath) => { setPath(p); send({ path: p, action: `Picked ${PATH_LABEL[p].toLowerCase()}` }); setTimeout(() => document.getElementById("difference")?.scrollIntoView({ behavior: "smooth" }), 80); };
  const p: WhyPath = path ?? "sell";
  const tel = telHref(agent.phone);
  const sms = smsHref(agent.phone, `Hi ${first}, it's ${prospect || "me"}. I just looked at your SpaceMatch page.`);
  const selling = p !== "buy";

  return (
    <div className="min-h-svh bg-[#F7F5F1] pb-24 text-[#0A0A0A] md:pb-0">
      {/* top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 bg-[#0A0A0A]/95 px-4 text-white backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <img src="/logo-white.png" alt="SpaceMatch" className="h-6 w-auto" />
        <div className="flex items-center gap-2">
          <a href={sms} onClick={() => action("Tapped text")} className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold md:flex"><MessageSquare className="size-4 text-[#D9BC8C]" /> Text {first}</a>
          <a href={tel} onClick={() => action("Tapped call")} className="flex items-center gap-1.5 rounded-full bg-[#9C7434] px-3.5 py-2 text-sm font-semibold"><Phone className="size-4" /> Call {first}</a>
        </div>
      </header>

      {/* hero */}
      <section data-why="intro" className="relative overflow-hidden bg-[#0A0A0A] px-5 pb-12 pt-8 text-white md:pb-16 md:pt-12">
        <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: "url(/media/why/chicago.jpg)" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/40 via-[#0A0A0A]/70 to-[#0A0A0A]" />
        <div className="relative mx-auto max-w-3xl">
          <div className="flex items-center gap-4">
            {prof?.photo && <img src={prof.photo} alt={agent.name} className="size-20 rounded-full object-cover ring-2 ring-[#D9BC8C] md:size-24" />}
            <div>
              <p className="text-[15px] text-[#D9BC8C]">{prospect ? `Prepared for ${prospect}` : "Your SpaceMatch agent"}</p>
              <p className="text-[20px] font-semibold">{agent.name}</p>
              <p className="text-[15px] text-white/65">{prof?.title ?? "Broker · SpaceMatch Inc."}</p>
            </div>
          </div>
          <h1 className="font-display mt-7 text-[36px] font-semibold leading-[1.08] md:text-[56px]" data-testid="why-hero">
            {prospect ? `${prospect}, most` : "Most"} homes get listed.<br /><span className="text-[#D9BC8C]">Yours gets launched.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[18px] leading-relaxed text-white/80">
            SpaceMatch is a marketing company designed to sell real estate. Here's what that means for you, in about two minutes.
          </p>
          <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4">
            {STATS.map(s => (
              <div key={s.n} className="border-t border-[#9C7434] pt-3">
                <p className="font-display text-[28px] font-semibold">{s.n}</p>
                <p className="text-[14px] leading-snug text-white/65">{s.l}</p>
              </div>
            ))}
          </div>
          {prof?.intro && (
            <button type="button" onClick={() => { setVideo(true); action("Played intro video"); }} className="mt-8 flex w-full items-center gap-4 rounded-2xl bg-white/8 p-3 text-left ring-1 ring-white/15 md:w-auto md:pr-6">
              <span className="relative block h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-black">
                <img src={prof.intro.replace(".mp4", ".jpg")} alt="" className="size-full object-cover opacity-80" />
                <Play className="absolute inset-0 m-auto size-7 fill-white text-white" />
              </span>
              <span><span className="block text-[17px] font-semibold">Meet {first}</span><span className="block text-[14px] text-white/60">A short hello, 30 seconds</span></span>
            </button>
          )}
        </div>
      </section>

      {/* path */}
      <Section id="path">
        <Eyebrow>Let's make this about you</Eyebrow>
        <H2>What are you planning?</H2>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {([["sell", "Selling my home", Home], ["buy", "Buying a home", KeyRound], ["both", "Selling & buying", Repeat]] as const).map(([k, l, Icon]) => (
            <button key={k} type="button" onClick={() => choose(k)} data-testid={`path-${k}`}
              className={`flex items-center gap-3 rounded-2xl p-4 text-left ring-2 transition-all md:flex-col md:items-start md:p-5 ${path === k ? "bg-[#0A0A0A] text-white ring-[#0A0A0A] shadow-lg" : "bg-white ring-stone-200 hover:ring-[#9C7434]"}`}>
              <Icon className={`size-7 ${path === k ? "text-[#D9BC8C]" : "text-[#9C7434]"}`} />
              <span className="text-[18px] font-semibold">{l}</span>
              {path === k && <Check className="ml-auto size-5 text-[#D9BC8C] md:hidden" />}
            </button>
          ))}
        </div>
      </Section>

      {/* difference */}
      <Section id="difference" dark>
        <Eyebrow light>{PATH_LABEL[p]} with SpaceMatch</Eyebrow>
        <H2 light>{selling ? "Same home. Sells like a different one." : "Buy with a team that knows how homes are sold."}</H2>
        <p className="mt-3 text-[17px] text-white/70">Most brokerages run the same cookie-cutter playbook. Here's how ours is different.</p>
        <div className="mt-8"><Compare path={p} onUse={() => action("Compared typical vs SpaceMatch")} /></div>
      </Section>

      {selling && (
        <Section id="staging">
          <Eyebrow>Stagifi digital staging</Eyebrow>
          <H2>Buyers fall in love online first.</H2>
          <p className="mt-3 text-[17px] leading-relaxed text-stone-700">Empty or cluttered rooms look smaller online. Our in-house studio stages and declutters your photos. Photos at 2pm, magazine-ready by 7pm.</p>
          <div className="mt-6"><BeforeAfter onUse={() => action("Used before/after slider")} /></div>
        </Section>
      )}

      {selling && (
        <Section id="portal" dark>
          <div className="grid items-center gap-8 md:grid-cols-[1fr_260px]">
            <div>
              <Eyebrow light>Most teams can't offer this</Eyebrow>
              <H2 light>You'll never wonder what your agent is doing.</H2>
              <p className="mt-3 text-[17px] leading-relaxed text-white/75">Your own private Seller Portal, live on your phone: every launch step, Zillow views and saves, showings, buyer feedback, ad results and offers. Plus a summary every Monday.</p>
              <button type="button" onClick={() => { setDemo(true); action("Opened Seller Portal demo"); }} data-testid="open-demo"
                className="mt-6 flex items-center gap-2 rounded-xl bg-[#9C7434] px-5 py-3.5 text-[17px] font-semibold">
                <Sparkles className="size-5" /> Try the live demo
              </button>
            </div>
            <button type="button" onClick={() => { setDemo(true); action("Opened Seller Portal demo"); }} className="mx-auto hidden w-[240px] overflow-hidden rounded-[30px] ring-8 ring-[#1f1f1f] md:block" aria-label="Open the Seller Portal demo">
              <div className="bg-[#0A0A0A] p-4 text-left">
                <p className="text-[12px] text-emerald-400">● Live</p>
                <p className="mt-1 text-[15px] font-semibold">2150 Ridge Ave</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[["2,146", "Zillow views"], ["68", "Saves"], ["14", "Showings"], ["9,810", "Reel views"]].map(([n, l]) => (
                    <div key={l} className="rounded-lg bg-white/10 p-2"><p className="text-[17px] font-semibold">{n}</p><p className="text-[11px] text-white/60">{l}</p></div>
                  ))}
                </div>
              </div>
              <div className="space-y-2 bg-[#F7F5F1] p-4 text-left text-[#0A0A0A]">
                <p className="text-[13px] font-semibold">Feedback</p>
                <p className="rounded-lg bg-white p-2 text-[12px] leading-snug">"Loved the kitchen and the yard."</p>
                <p className="rounded-lg bg-white p-2 text-[12px] leading-snug">"Beautiful light."</p>
              </div>
            </button>
          </div>
        </Section>
      )}

      {selling ? (
        <Section id="launch">
          <Eyebrow>The SpaceMatch launch system</Eyebrow>
          <H2>A launch, engineered in 14 days.</H2>
          <p className="mt-3 text-[17px] text-stone-700">Peak attention arrives in the first days. We prepare before we launch, so none of it is wasted. Tap each step.</p>
          <div className="mt-6"><Steps items={LAUNCH} onUse={() => action("Explored the 14-day launch")} /></div>
          <p className="mt-3 text-[14px] text-stone-500">Sample sequence. It depends on your home, the market and your approval.</p>
        </Section>
      ) : null}

      {p !== "sell" && (
        <Section id="journey" className={selling ? "bg-white" : ""}>
          <Eyebrow>Buying with SpaceMatch</Eyebrow>
          <H2>Your path to the keys.</H2>
          <div className="mt-6"><Steps items={BUY_STEPS} onUse={() => action("Explored the buying steps")} /></div>
        </Section>
      )}

      {p === "both" && (
        <Section id="plan">
          <Eyebrow>Selling and buying at the same time</Eyebrow>
          <H2>Four ways to time it. We'll pick yours together.</H2>
          <BothOptions onUse={() => action("Looked at sell & buy timing")} />
        </Section>
      )}

      <Section id="numbers" className="bg-white">
        <Eyebrow>Run your numbers</Eyebrow>
        <H2>{p === "sell" ? "What could you walk away with?" : p === "buy" ? "What would it cost each month?" : "From this sale to your next home."}</H2>
        <div className="mt-6"><Calculator path={p} onUse={() => action("Used the calculator")} /></div>
      </Section>

      <Section id="proof" dark>
        <Eyebrow light>Results, not promises</Eyebrow>
        <H2 light>In our clients' words.</H2>
        <Reviews onUse={() => action("Read reviews")} />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {CASES.map(c => (
            <div key={c.t} className="overflow-hidden rounded-2xl bg-white/6 ring-1 ring-white/12">
              {c.img ? <img src={c.img} alt={c.t} className="h-40 w-full object-cover" loading="lazy" /> : <div className="grid h-40 place-items-center bg-[#9C7434]/25 font-display text-[30px] text-[#D9BC8C]">Above asking</div>}
              <div className="p-4"><p className="text-[16px] font-semibold">{c.t}</p><p className="mt-1 text-[15px] text-white/65">{c.s}</p></div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-white/45">Historical examples. Not a guarantee of future results.</p>
      </Section>

      {prof && (
        <Section id="agent">
          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            {prof.photo && <img src={prof.photo} alt={agent.name} className="w-40 rounded-2xl object-cover shadow-lg md:w-full" loading="lazy" />}
            <div>
              <Eyebrow>Why {first}</Eyebrow>
              <H2>{prof.head.split("\n")[0]}</H2>
              {prof.head.includes("\n") && <p className="font-display mt-1 text-[20px] italic text-stone-600">{prof.head.split("\n")[1]}</p>}
              <p className="mt-4 text-[17px] leading-relaxed text-stone-700">{prof.p1}</p>
              <p className="mt-3 text-[17px] leading-relaxed text-stone-700">{prof.p2}</p>
              {prof.stats.length > 0 && (
                <div className="mt-6 grid grid-cols-3 gap-3 border-t border-stone-300 pt-4">
                  {prof.stats.slice(0, 3).map(s => (
                    <div key={s[0] + s[1]}><p className="font-display text-[22px] font-semibold leading-tight">{s[0]}</p><p className="mt-1 text-[14px] leading-snug text-stone-600">{s[1]}</p></div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {prof.cards.length > 0 && (
            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {prof.cards.map(c => (
                <div key={c[0]} className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                  <BadgeCheck className="size-6 text-[#9C7434]" />
                  <p className="mt-2 text-[17px] font-semibold">{c[0]}</p>
                  <p className="mt-1 text-[15px] leading-snug text-stone-600">{c[1]}</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      <Section id="next" dark>
        <NextStep path={p} agentSlug={slug} token={token} first={first} prospect={prospect} tel={tel} sms={sms} onAction={action} />
      </Section>

      <footer className="bg-[#0A0A0A] px-5 pb-10 text-[13px] leading-relaxed text-white/50">
        <div className="mx-auto max-w-3xl border-t border-white/10 pt-6">
          <p>{agent.name}{prof?.lic ? `, Illinois licensed broker #${prof.lic}` : ""} · {agent.phone} · {agent.email}</p>
          <p className="mt-1">{brokerageLine()} · {OFFICE} · {TEAM_LINE} · spacematchinc.com</p>
          <p className="mt-1">Staging shown is a Stagifi example. Calculator figures are estimates, not appraisals or loan offers. If your home is listed with another broker, this is not a solicitation. Equal Housing Opportunity.</p>
        </div>
      </footer>

      {/* mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 gap-2 border-t border-stone-200 bg-white/95 p-2.5 backdrop-blur md:hidden" style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}>
        <a href={tel} onClick={() => action("Tapped call")} className="flex items-center justify-center gap-1.5 rounded-xl bg-stone-100 py-3 text-[15px] font-semibold"><Phone className="size-4 text-[#9C7434]" /> Call</a>
        <a href={sms} onClick={() => action("Tapped text")} className="flex items-center justify-center gap-1.5 rounded-xl bg-stone-100 py-3 text-[15px] font-semibold"><MessageSquare className="size-4 text-[#9C7434]" /> Text</a>
        <a href="#next" onClick={() => action("Tapped next step")} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#9C7434] py-3 text-[15px] font-semibold text-white">Next step</a>
      </div>

      {demo && <PortalDemo onClose={() => setDemo(false)} />}
      {video && prof?.intro && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" role="dialog" aria-label={`Meet ${first}`}>
          <div className="relative w-full max-w-sm">
            <button type="button" onClick={() => setVideo(false)} className="absolute -top-12 right-0 flex items-center gap-1 rounded-full bg-white px-3 py-2 text-sm font-semibold"><X className="size-4" /> Close</button>
            {/* biome-ignore lint/a11y/useMediaCaption: agent intro, burned-in captions */}
            <video src={prof.intro} poster={prof.intro.replace(".mp4", ".jpg")} controls autoPlay playsInline className="max-h-[80vh] w-full rounded-2xl bg-black" />
          </div>
        </div>
      )}
    </div>
  );
}

function BothOptions({ onUse }: { onUse: () => void }) {
  const [sel, setSel] = useState<number | null>(null);
  return (
    <div className="mt-6 grid gap-3 md:grid-cols-2">
      {BOTH_OPTIONS.map((o, k) => (
        <button key={o.t} type="button" onClick={() => { setSel(k); onUse(); }}
          className={`rounded-2xl p-4 text-left ring-2 transition-all ${sel === k ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white ring-stone-200"}`}>
          <p className="text-[18px] font-semibold">{o.t}</p>
          <p className={`mt-2 flex gap-2 text-[15px] ${sel === k ? "text-white/85" : "text-stone-700"}`}><Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />{o.pro}</p>
          <p className={`mt-1 flex gap-2 text-[15px] ${sel === k ? "text-white/65" : "text-stone-500"}`}><span className="mt-0.5 w-4 shrink-0 text-center">–</span>{o.con}</p>
        </button>
      ))}
      {sel !== null && <p className="text-[16px] text-stone-700 md:col-span-2">Good instinct. We'll check it against your numbers and your lender on our call.</p>}
    </div>
  );
}

function Reviews({ onUse }: { onUse: () => void }) {
  const [i, setI] = useState(0);
  const r = REVIEWS[i];
  return (
    <div className="mt-6 rounded-2xl bg-white/6 p-6 ring-1 ring-white/12">
      <div className="flex gap-0.5">{[0, 1, 2, 3, 4].map(k => <Star key={k} className="size-5 fill-[#D9BC8C] text-[#D9BC8C]" />)}</div>
      <Quote className="mt-4 size-7 text-[#9C7434]" />
      <p key={i} className="mt-2 min-h-[120px] text-[19px] leading-relaxed text-white animate-in fade-in duration-300">{r.q}</p>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-[15px] text-white/60">{r.who}</p>
        <div className="flex gap-2">
          <button type="button" aria-label="Previous review" onClick={() => { setI((i + REVIEWS.length - 1) % REVIEWS.length); onUse(); }} className="grid size-10 place-items-center rounded-full bg-white/10"><ChevronLeft className="size-5" /></button>
          <button type="button" aria-label="Next review" onClick={() => { setI((i + 1) % REVIEWS.length); onUse(); }} className="grid size-10 place-items-center rounded-full bg-white/10"><ChevronRight className="size-5" /></button>
        </div>
      </div>
      <p className="mt-3 text-[13px] text-white/45">5.0★ across 115 Google & Zillow reviews · published at spacematchinc.com/testimonials</p>
    </div>
  );
}

function NextStep({ path, agentSlug, token, first, prospect, tel, sms, onAction }: {
  path: WhyPath; agentSlug: string; token: string | null; first: string; prospect: string; tel?: string; sms?: string; onAction: (a: string) => void;
}) {
  const submit = useMutation(api.whyLinks.request);
  const [f, setF] = useState({ fullName: prospect, phone: "", email: "", address: "", timeline: "", note: "", hp: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => { if (prospect) setF(x => (x.fullName ? x : { ...x, fullName: prospect })); }, [prospect]);
  const title = { sell: "Get your home's value and launch plan", buy: "Get your personal search plan", both: "Get your sell-and-buy plan" }[path];
  const sub = {
    sell: `${first} prepares a branded market analysis with a net sheet for your home, usually within a day, and walks you through it.`,
    buy: `${first} builds your search plan: target areas, budget, a vetted lender and alerts that include our Coming Soon homes.`,
    both: `${first} maps both moves: your home's value and net, your next budget and the timing option that fits.`,
  }[path];
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(x => ({ ...x, [k]: e.target.value }));
  const inputCls = "w-full rounded-xl border-0 bg-white px-3.5 py-3 text-[17px] text-[#0A0A0A] outline-none ring-1 ring-white/20 focus:ring-2 focus:ring-[#9C7434]";
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await submit({ agentSlug, token: token ?? undefined, path, ...f });
      setDone(true);
      onAction("Asked for a plan");
    } catch (x) {
      const m = String((x as Error).message ?? x);
      setErr(/Uncaught Error: ([^\n]+)/.exec(m)?.[1] ?? "Something went wrong. Please call or text instead.");
    } finally { setBusy(false); }
  };
  if (done) {
    return (
      <div className="text-center" data-testid="why-done">
        <CalendarCheck className="mx-auto size-12 text-[#D9BC8C]" />
        <H2 light>Done. {first} has it.</H2>
        <p className="mx-auto mt-3 max-w-md text-[17px] text-white/75">You'll hear back shortly. If you're still on the phone together, just say "sent".</p>
      </div>
    );
  }
  return (
    <div>
      <Eyebrow light>Your next step</Eyebrow>
      <H2 light>{title}</H2>
      <p className="mt-3 text-[17px] text-white/75">{sub} No obligation.</p>
      <form onSubmit={go} className="mt-6 grid gap-3 md:grid-cols-2">
        <input className={inputCls} placeholder="Your name" autoComplete="name" value={f.fullName} onChange={set("fullName")} aria-label="Your name" />
        <input className={inputCls} placeholder="Mobile phone" type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} aria-label="Mobile phone" />
        <input className={inputCls} placeholder="Email" type="email" autoComplete="email" value={f.email} onChange={set("email")} aria-label="Email" />
        <input className={inputCls} placeholder={path === "buy" ? "Areas you're looking in" : "Your property address"} value={f.address} onChange={set("address")} aria-label={path === "buy" ? "Areas" : "Property address"} />
        <select className={inputCls} value={f.timeline} onChange={set("timeline")} aria-label="Timing">
          <option value="">When are you thinking?</option>
          {["ASAP", "1–3 months", "3–6 months", "6+ months", "Just exploring"].map(o => <option key={o}>{o}</option>)}
        </select>
        <input className={inputCls} placeholder="Anything we should know? (optional)" value={f.note} onChange={set("note")} aria-label="Note" />
        <input className="hidden" tabIndex={-1} autoComplete="off" value={f.hp} onChange={set("hp")} aria-hidden />
        {err && <p className="text-[15px] text-red-300 md:col-span-2">{err}</p>}
        <button type="submit" disabled={busy} data-testid="why-submit" className="flex items-center justify-center gap-2 rounded-xl bg-[#9C7434] py-4 text-[17px] font-semibold text-white md:col-span-2">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <>Send it to {first} <ArrowRight className="size-5" /></>}
        </button>
      </form>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <a href={tel} onClick={() => onAction("Tapped call")} className="flex items-center justify-center gap-2 rounded-xl bg-white/10 py-3 font-semibold"><Phone className="size-4 text-[#D9BC8C]" /> Call {first}</a>
        <a href={sms} onClick={() => onAction("Tapped text")} className="flex items-center justify-center gap-2 rounded-xl bg-white/10 py-3 font-semibold"><MessageSquare className="size-4 text-[#D9BC8C]" /> Text {first}</a>
      </div>
    </div>
  );
}
