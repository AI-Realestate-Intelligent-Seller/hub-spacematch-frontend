import { useMutation, useQuery } from "convex/react";
import QRCode from "qrcode";
import {
  ArrowRight, Check, CheckCircle2, Copy, Eye, GraduationCap, Home, KeyRound, Loader2, Mail, MessageSquare, MonitorPlay,
  QrCode, Repeat, Send, Sparkles, Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SECTION_NAMES, type WhyPath } from "@/lib/whyContent";
import { WHY_QUIZ } from "../../convex/whyDefs";
import { api } from "../../convex/_generated/api";

const LIVE_MS = 60_000;
const base = () =>
  typeof window !== "undefined" && /spacematchinc\.com$|viktor\.space$/.test(window.location.hostname)
    ? "https://hub.spacematchinc.com"
    : window.location.origin;
const linkUrl = (slug: string, token?: string) => `${base()}/m/${slug}${token ? `?k=${token}` : ""}`;
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
const PATHS: { k: WhyPath; l: string; icon: typeof Home }[] = [
  { k: "sell", l: "Seller", icon: Home },
  { k: "buy", l: "Buyer", icon: KeyRound },
  { k: "both", l: "Sell & buy", icon: Repeat },
];

// ---------- one-time tutorial ----------
const TUTORIAL = [
  {
    t: "What your link is",
    body: "A page with your photo, your name and your story. It shows the prospect who SpaceMatch is and how we work differently from a cookie-cutter brokerage: staging before/after, a live Seller Portal demo, the 14-day launch, a calculator and real reviews. It looks great on a phone.",
    tip: "Each link you send is personal (\"Prepared for Jane\") and tracked, so you see when they open it.",
  },
  {
    t: "When to send it",
    body: "On the call, as soon as you know if they're selling, buying, or both. Don't wait until after you hang up.",
    tip: "Say: \"I'm texting you something right now. It takes two minutes and shows exactly how we'd handle your sale. Open it while we talk.\"",
  },
  {
    t: "Send it in 15 seconds",
    body: "Open the Why SpaceMatch tile, type their first name, tap Seller, Buyer or Sell & buy, then tap Text (or Email). Your phone opens with the message ready. Add their number and send.",
    tip: "Pick Sell & buy whenever they're moving from one home to another. It adds the timing options and the next-home budget.",
  },
  {
    t: "Walk them through it live",
    body: "Keep this page open. You'll see \"Viewing now\" and the section they're on. Guide them: \"Tap the switch at the top, that's the difference.\" \"Drag the photo, that's the same room.\" \"Tap Try the live demo, that's what you'd see every day.\"",
    tip: "Then ask: \"Which of these matters most to you?\" Their answer is your listing appointment.",
  },
  {
    t: "Close for the next step",
    body: "Ask for the appointment while they're on the page. If they tap \"Send it to you\", the request lands in your Hub inbox and your email, with what they looked at. Call back within 1 hour (team standard).",
    tip: "Never promise a price, timeline or result. Numbers on the page are examples. Real numbers come from your CMA and net sheet.",
  },
];

function Tutorial({ slug, onDone }: { slug: string; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>(WHY_QUIZ.map(() => -1));
  const [wrong, setWrong] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const complete = useMutation(api.whyLinks.completeTutorial);
  const quiz = step === TUTORIAL.length;
  const cur = TUTORIAL[step];
  const submit = async () => {
    setBusy(true);
    try {
      const r = await complete({ answers });
      if (r.ok) { toast.success("You're set. Your link is unlocked."); onDone(); }
      else setWrong(r.wrong);
    } finally { setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-2xl" data-testid="why-tutorial">
      <div className="rounded-3xl bg-[#0A0A0A] p-6 text-white md:p-8">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-[#D9BC8C]"><GraduationCap className="size-5" /> One-time tutorial · about 3 minutes</p>
        <h1 className="font-display mt-2 text-[30px] font-semibold leading-tight md:text-[38px]">Your Why SpaceMatch link</h1>
        <p className="mt-2 text-[17px] text-white/75">The tool that turns a phone call into a yes. Go through this once, then it's unlocked for good.</p>
        <div className="mt-5 flex gap-1.5">
          {[...TUTORIAL, null].map((_, k) => <span key={k} className={`h-1.5 flex-1 rounded-full ${k <= step ? "bg-[#9C7434]" : "bg-white/15"}`} />)}
        </div>
      </div>

      {!quiz ? (
        <div className="mt-4 rounded-3xl bg-white p-6 ring-1 ring-[#ebe5da] md:p-8">
          <p className="text-[15px] font-semibold text-[#9C7434]">Step {step + 1} of {TUTORIAL.length}</p>
          <h2 className="font-display mt-1 text-[26px] font-semibold">{cur.t}</h2>
          <p className="mt-3 text-[17px] leading-relaxed text-stone-700">{cur.body}</p>
          <div className="mt-4 flex gap-3 rounded-2xl bg-[#FBF3E4] p-4 text-[16px] leading-relaxed ring-1 ring-[#E8D3A8]">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-[#9C7434]" /><span>{cur.tip}</span>
          </div>
          {step === 0 && (
            <a href={linkUrl(slug)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-[16px] font-semibold text-[#9C7434] underline">
              <Eye className="size-4" /> Preview your page in a new tab
            </a>
          )}
          <div className="mt-6 flex justify-between">
            <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className="rounded-xl px-4 py-3 text-[16px] text-stone-600 disabled:opacity-30">Back</button>
            <button type="button" onClick={() => setStep(step + 1)} data-testid="tutorial-next" className="flex items-center gap-2 rounded-xl bg-[#0A0A0A] px-5 py-3 text-[16px] font-semibold text-white">
              {step === TUTORIAL.length - 1 ? "Quick check" : "Next"} <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-3xl bg-white p-6 ring-1 ring-[#ebe5da] md:p-8">
          <h2 className="font-display text-[26px] font-semibold">Quick check</h2>
          <p className="mt-1 text-[16px] text-stone-600">Get all {WHY_QUIZ.length} right to unlock your link.</p>
          <div className="mt-5 space-y-6">
            {WHY_QUIZ.map((q, i) => (
              <fieldset key={q.q} data-testid={`quiz-${i}`}>
                <legend className="text-[17px] font-semibold">{i + 1}. {q.q}</legend>
                <div className="mt-2 grid gap-2">
                  {q.options.map((o, k) => (
                    <button key={o} type="button" onClick={() => { const a = [...answers]; a[i] = k; setAnswers(a); setWrong([]); }}
                      className={`rounded-xl px-4 py-3 text-left text-[16px] ring-1 ${answers[i] === k ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white ring-stone-300"}`}>
                      {o}
                    </button>
                  ))}
                </div>
                {wrong.includes(q.q) && <p className="mt-2 text-[15px] text-red-700">Not quite. {q.why}</p>}
              </fieldset>
            ))}
          </div>
          <div className="mt-6 flex justify-between">
            <button type="button" onClick={() => setStep(step - 1)} className="rounded-xl px-4 py-3 text-[16px] text-stone-600">Back</button>
            <button type="button" disabled={busy || answers.includes(-1)} onClick={submit} data-testid="quiz-submit" className="flex items-center gap-2 rounded-xl bg-[#9C7434] px-5 py-3 text-[16px] font-semibold text-white disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Unlock my link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- page ----------
export function WhyToolPage() {
  const me = useQuery(api.hubMe.me);
  const tut = useQuery(api.whyLinks.tutorial);
  const [agentName, setAgentName] = useState<string | undefined>(undefined);
  const data = useQuery(api.whyLinks.mine, tut?.done ? { agentName } : "skip");
  const preview = useQuery(api.whyLinks.mine, tut && !tut.done ? { agentName } : "skip");
  const team = useQuery(api.whyLinks.team, me?.isStaff ? {} : "skip");
  const create = useMutation(api.whyLinks.create);
  const setChannel = useMutation(api.whyLinks.setChannel);
  const [name, setName] = useState("");
  const [path, setPath] = useState<WhyPath>("sell");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<{ url: string; img: string } | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 15_000); return () => clearInterval(t); }, []);

  const agentFirst = (data?.agentName ?? me?.agentName ?? "").split(" ")[0];
  const slug = data?.slug ?? preview?.slug ?? "";

  const message = (url: string) =>
    `Hi ${name.trim() || "there"}, it's ${agentFirst} with SpaceMatch. Here's the page I mentioned. It takes 2 minutes and shows how we'd handle ${path === "buy" ? "your search" : path === "both" ? "your sale and your next purchase" : "your sale"}: ${url}`;

  const make = async (channel: "text" | "email" | "copy" | "qr" | "present") => {
    if (!name.trim()) { toast.error("Add their first name first"); return; }
    setBusy(true);
    // Safari blocks window.open after an await, so open the tab first for "present".
    const tab = channel === "present" ? window.open("about:blank", "_blank") : null;
    try {
      const r = await create({ agentName, prospectName: name.trim(), path, channel });
      const url = linkUrl(r.slug, r.token);
      if (channel === "text") {
        window.location.href = `sms:${phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(message(url))}`;
      } else if (channel === "email") {
        const subject = `${name.trim()}, here's how SpaceMatch would ${path === "buy" ? "help you buy" : path === "both" ? "handle your move" : "sell your home"}`;
        window.location.href = `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message(url))}`;
      } else if (channel === "copy") {
        await navigator.clipboard.writeText(message(url)).catch(() => {});
        toast.success("Copied. Paste it into your text or email.");
      } else if (channel === "qr") {
        setQr({ url, img: await QRCode.toDataURL(url, { width: 640, margin: 1 }) });
      } else if (tab) {
        tab.location.href = url;
      }
      setName(""); setPhone(""); setEmail("");
    } catch (e) {
      tab?.close();
      const m = String((e as Error).message ?? e);
      toast.error(/Uncaught Error: ([^\n]+)/.exec(m)?.[1] ?? "Couldn't create the link");
    } finally { setBusy(false); }
  };

  const live = useMemo(() => (data?.links ?? []).filter(l => l.lastSeenAt && Date.now() - l.lastSeenAt < LIVE_MS), [data]);

  if (!me || !tut) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="size-6 animate-spin text-stone-400" /></div>;

  const picker = me.isStaff && me.agents.length > 0 && (
    <label className="block">
      <span className="text-[15px] font-semibold text-stone-700">Send as</span>
      <select value={agentName ?? data?.agentName ?? preview?.agentName ?? ""} onChange={e => setAgentName(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-[16px]" aria-label="Send as">
        {me.agents.map(n => <option key={n}>{n}</option>)}
      </select>
    </label>
  );

  if (!tut.done) return <div className="py-2"><Tutorial slug={slug || "michael-kang"} onDone={() => {}} /></div>;

  const inputCls = "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-[17px] outline-none focus:border-[#9C7434] focus:ring-2 focus:ring-[#9C7434]/20";

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-2" data-testid="why-tool">
      <div className="rounded-3xl bg-[#0A0A0A] p-6 text-white md:p-8">
        <p className="text-[15px] font-semibold text-[#D9BC8C]">On a call right now?</p>
        <h1 className="font-display mt-1 text-[30px] font-semibold leading-tight md:text-[38px]">Send your Why SpaceMatch link</h1>
        <p className="mt-2 text-[17px] text-white/75">Your photo, your story and the SpaceMatch difference, personalized for them. You'll see the moment they open it.</p>
      </div>

      {live.length > 0 && (
        <div className="space-y-2" data-testid="live-now">
          {live.map(l => (
            <div key={l.token} className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
              <span className="relative flex size-3"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex size-3 rounded-full bg-emerald-500" /></span>
              <p className="text-[16px]"><b>{l.prospectName}</b> is viewing now · <span className="font-semibold text-emerald-800">{SECTION_NAMES[l.section ?? "intro"] ?? l.section}</span></p>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-3xl bg-white p-5 ring-1 ring-[#ebe5da] md:p-7">
        <div className="grid gap-4">
          {picker}
          <label className="block">
            <span className="text-[15px] font-semibold text-stone-700">Their first name</span>
            <input className={`${inputCls} mt-1`} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jane" aria-label="Their first name" maxLength={40} />
          </label>
          <div>
            <span className="text-[15px] font-semibold text-stone-700">They're…</span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {PATHS.map(({ k, l, icon: Icon }) => (
                <button key={k} type="button" onClick={() => setPath(k)} data-testid={`tool-path-${k}`}
                  className={`flex flex-col items-center gap-1 rounded-xl py-3 text-[16px] font-semibold ring-2 ${path === k ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white ring-stone-200"}`}>
                  <Icon className={`size-5 ${path === k ? "text-[#D9BC8C]" : "text-[#9C7434]"}`} />{l}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Their mobile (optional)" type="tel" aria-label="Their mobile" />
            <input className={inputCls} value={email} onChange={e => setEmail(e.target.value)} placeholder="Their email (optional)" type="email" aria-label="Their email" />
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <button type="button" disabled={busy} onClick={() => make("text")} className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-[#9C7434] py-3.5 text-[17px] font-semibold text-white md:col-span-1"><MessageSquare className="size-5" /> Text</button>
            <button type="button" disabled={busy} onClick={() => make("email")} className="flex items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] py-3.5 text-[16px] font-semibold text-white"><Mail className="size-5" /> Email</button>
            <button type="button" disabled={busy} onClick={() => make("copy")} data-testid="why-copy" className="flex items-center justify-center gap-2 rounded-xl bg-stone-100 py-3.5 text-[16px] font-semibold"><Copy className="size-5" /> Copy</button>
            <button type="button" disabled={busy} onClick={() => make("qr")} className="flex items-center justify-center gap-2 rounded-xl bg-stone-100 py-3.5 text-[16px] font-semibold"><QrCode className="size-5" /> QR</button>
            <button type="button" disabled={busy} onClick={() => make("present")} className="flex items-center justify-center gap-2 rounded-xl bg-stone-100 py-3.5 text-[16px] font-semibold"><MonitorPlay className="size-5" /> Show</button>
          </div>
          <p className="text-[14px] text-stone-500">Text and Email open your own phone or mail app with the message ready. Show opens it on your screen for in-person or screen-share.</p>
        </div>
      </section>

      <section>
        <h2 className="font-display mb-3 text-[24px] font-semibold">Links you've sent</h2>
        {!data ? <Loader2 className="size-5 animate-spin text-stone-400" /> : data.links.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-[16px] text-stone-600 ring-1 ring-[#ebe5da]">Nothing sent yet. Your next call is the perfect time.</p>
        ) : (
          <ul className="space-y-2" data-testid="why-links">
            {data.links.map(l => {
              const isLive = l.lastSeenAt && Date.now() - l.lastSeenAt < LIVE_MS;
              return (
                <li key={l.token} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[17px] font-semibold">{l.prospectName || "No name"}</span>
                    <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[14px] text-stone-700">{PATHS.find(x => x.k === (l.chosenPath ?? l.path))?.l}</span>
                    {l.requestedAt ? <span className="rounded-full bg-[#9C7434] px-2.5 py-0.5 text-[14px] font-semibold text-white">Asked for a plan</span>
                      : isLive ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[14px] font-semibold text-emerald-800">● Viewing now</span>
                        : l.opens > 0 ? <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[14px] text-sky-800">Opened {l.opens}× · {ago(l.lastSeenAt ?? l.createdAt)}</span>
                          : <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[14px] text-stone-500">Not opened yet</span>}
                    <span className="ml-auto text-[14px] text-stone-500">Sent {ago(l.createdAt)} · {l.channel}</span>
                  </div>
                  {(l.sections.length > 0 || l.actions.length > 0) && (
                    <div className="mt-2 text-[15px] leading-relaxed text-stone-600">
                      {l.sections.length > 0 && <p><b className="text-stone-800">Saw:</b> {l.sections.map(s => SECTION_NAMES[s] ?? s).join(" · ")}</p>}
                      {l.actions.length > 0 && <p><b className="text-stone-800">Did:</b> {l.actions.join(" · ")}</p>}
                    </div>
                  )}
                  <div className="mt-2 flex gap-3 text-[14px]">
                    <button type="button" onClick={async () => { await navigator.clipboard.writeText(linkUrl(data.slug, l.token)).catch(() => {}); setChannel({ token: l.token, channel: l.channel }); toast.success("Link copied"); }} className="flex items-center gap-1 font-semibold text-[#9C7434]"><Copy className="size-3.5" /> Copy link</button>
                    {l.requestedAt && <Link to="/inbox" className="flex items-center gap-1 font-semibold text-[#9C7434]"><Send className="size-3.5" /> Open in Inbox</Link>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]">
          <h3 className="text-[18px] font-semibold">What to say</h3>
          <ul className="mt-2 space-y-2 text-[16px] leading-relaxed text-stone-700">
            <li>"I'm texting you something now. Open it while we talk."</li>
            <li>"Tap the switch at the top. That's the difference."</li>
            <li>"Drag the photo. Same room, same day."</li>
            <li>"Tap Try the live demo. That's what you'd see every day."</li>
            <li>"Which of these matters most to you?"</li>
          </ul>
        </div>
        <div className="rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]">
          <h3 className="text-[18px] font-semibold">Your everyday link</h3>
          <p className="mt-1 text-[15px] text-stone-600">For your email signature, Instagram bio or business card. It isn't tracked per person.</p>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200">
            <span className="min-w-0 flex-1 truncate text-[15px]" data-testid="generic-link">{slug ? linkUrl(slug) : ""}</span>
            <button type="button" onClick={() => { navigator.clipboard.writeText(linkUrl(slug)).catch(() => {}); toast.success("Copied"); }} className="rounded-lg bg-white px-3 py-1.5 text-[14px] font-semibold ring-1 ring-stone-300">Copy</button>
          </div>
          <a href={linkUrl(slug)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#9C7434]"><Eye className="size-4" /> Preview my page</a>
        </div>
      </section>

      {team && (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]" data-testid="why-team">
          <h3 className="flex items-center gap-2 text-[18px] font-semibold"><Users className="size-5 text-[#9C7434]" /> Team adoption · last 30 days</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead><tr className="text-left text-stone-500"><th className="py-1.5 pr-3 font-semibold">Agent</th><th className="pr-3 font-semibold">Tutorial</th><th className="pr-3 font-semibold">Sent</th><th className="pr-3 font-semibold">Opened</th><th className="font-semibold">Asked</th></tr></thead>
              <tbody>
                {team.map(r => (
                  <tr key={r.name} className="border-t border-stone-100">
                    <td className="py-1.5 pr-3">{r.name}</td>
                    <td className="pr-3">{r.tutorialAt ? <Check className="size-4 text-emerald-600" /> : <span className="text-stone-400">Not yet</span>}</td>
                    <td className="pr-3">{r.sent}</td><td className="pr-3">{r.opened}</td><td>{r.requests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Dialog open={!!qr} onOpenChange={o => !o && setQr(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Scan to open</DialogTitle></DialogHeader>
          {qr && <img src={qr.img} alt="QR code for the link" className="w-full rounded-xl" />}
          <p className="break-all text-[14px] text-stone-500">{qr?.url}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
