import { useMutation, useQuery } from "convex/react";
import { ArrowRight, Check, Grid2x2, LifeBuoy, MessageSquare, PenLine, Phone, RefreshCw, Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { DeskTile } from "@/components/hub/DeskTile";
import { GetHelpDialog } from "@/components/hub/GetHelpDialog";
import { GlobalSearch } from "@/components/hub/GlobalSearch";
import { InstallCard } from "@/components/hub/InstallCard";
import { ToolSetupCard } from "@/components/hub/ToolSetupCard";
import { MOMENTS, myTools } from "@/lib/catalog";
import { smsHref, TOOLS, telHref, toolHref } from "@/lib/hub";
import { AnnouncementsPreview } from "@/pages/AnnouncementsPage";
import { api } from "../../convex/_generated/api";
import { formatAddress } from "../../convex/address";

// Today = the one-screen Home (Michael 2026-10-29, #team-app-design 1793285849.414399):
// search → (Start here for new agents) → 4 big actions → who to call today → tools.
// Everything else lives in the Clients / Listings / Marketing / Learn tabs.

function greeting() {
  const h = Number(
    new Date().toLocaleString("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Chicago",
    }),
  );
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 60
    ? `${m} min ago`
    : m < 1440
      ? `${Math.round(m / 60)} h ago`
      : `${Math.round(m / 1440)} d ago`;
};

const LOFTY_LEAD = (id: string) =>
  `https://crm.lofty.com/admin/home/lead/detail/${id}`;
const when = (t: number) => {
  const d = new Date(t);
  const today = new Date();
  const tmr = new Date(Date.now() + 864e5);
  const same = (x: Date) =>
    x.toLocaleDateString("en-US", { timeZone: "America/Chicago" }) ===
    d.toLocaleDateString("en-US", { timeZone: "America/Chicago" });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
  if (same(today)) return `Today ${time}`;
  if (same(tmr)) return `Tomorrow ${time}`;
  return (
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/Chicago",
    }) + ` ${time}`
  );
};
const daysAgo = (t?: number) =>
  t ? `${Math.max(1, Math.round((Date.now() - t) / 864e5))} d` : "never";


type Row = {
  key: string;
  title: string;
  sub: string;
  to?: string;
  href?: string;
  hot?: boolean;
  phone?: string;
  action?: React.ReactNode;
  doneable?: boolean;
};

// "Done" hides a call for the rest of the day on this phone (no Lofty write, no credits).
const dayStamp = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
function useDoneToday() {
  const k = `hub-done-${dayStamp()}`;
  const [done, setDone] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(k) ?? "[]");
    } catch {
      return [];
    }
  });
  const mark = (key: string) => {
    const next = [...done, key];
    setDone(next);
    try {
      localStorage.setItem(k, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  };
  const undo = (key: string) => {
    const next = done.filter(x => x !== key);
    setDone(next);
    try {
      localStorage.setItem(k, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  };
  return { done, mark, undo };
}

function RowLine({ r, onDone }: { r: Row; onDone?: () => void }) {
  const inner = (
    <>
      <span
        className={`size-2.5 shrink-0 rounded-full ${r.hot ? "bg-[#c2410c]" : "bg-[#D9BC8C]"}`}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold">{r.title}</span>
        <span className="block truncate text-sm text-stone-600">{r.sub}</span>
      </span>
    </>
  );
  const main = r.to ? (
    <Link to={r.to} className="flex min-w-0 flex-1 items-center gap-3">
      {inner}
    </Link>
  ) : r.href ? (
    <a href={r.href} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3">
      {inner}
    </a>
  ) : (
    <span className="flex min-w-0 flex-1 items-center gap-3">{inner}</span>
  );
  return (
    <div className="flex items-center gap-2 px-4 py-3" data-testid="today-row">
      {main}
      {r.action ?? (
        <span className="flex shrink-0 items-center gap-1.5">
          {r.phone && (
            <a href={telHref(r.phone)} aria-label={`Call ${r.title}`} className="grid size-9 place-items-center rounded-lg bg-[#0A0A0A] text-white">
              <Phone className="size-4" />
            </a>
          )}
          {r.phone && (
            <a href={smsHref(r.phone)} aria-label={`Text ${r.title}`} className="grid size-9 place-items-center rounded-lg bg-[#F7F5F1]">
              <MessageSquare className="size-4" />
            </a>
          )}
          {onDone ? (
            <button type="button" onClick={onDone} aria-label={`Done with ${r.title}`} className="grid size-9 place-items-center rounded-lg bg-[#F7F5F1] text-[#7a5a26]">
              <Check className="size-4" />
            </button>
          ) : (
            !r.phone && <ArrowRight className="size-4 text-stone-400" />
          )}
        </span>
      )}
    </div>
  );
}

function Label({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 bg-[#F7F5F1] px-4 py-2 text-sm font-semibold text-stone-700">
      <span className="flex-1">{children}</span>
      {right}
    </div>
  );
}

// 3 steps for new agents; disappears once all three are done (or hidden).
function StartHere() {
  const tools = useQuery(api.toolSetup.mine);
  const tut = useQuery(api.whyLinks.tutorial);
  const [hidden, setHidden] = useState(() => localStorage.getItem("hub-start-hidden") === "1");
  const [open, setOpen] = useState<"phone" | "tools" | null>(null);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const [phoneDone, setPhoneDone] = useState(
    () => standalone || localStorage.getItem("hub-install-dismissed") === "1",
  );
  if (tools === undefined || tut === undefined || hidden) return null;
  const setupTools = TOOLS.filter(t => t.setup);
  const toolsDone = setupTools.every(t => tools.includes(t.name));
  const steps = [
    { id: "phone" as const, title: "Put the Hub on your phone", sub: "Opens full-screen like an app", done: phoneDone },
    { id: "tools" as const, title: "Log in to your daily tools once", sub: `${setupTools.filter(t => tools.includes(t.name)).length} of ${setupTools.length} done`, done: toolsDone },
    { id: "why" as const, title: "Take the 3-minute Why SpaceMatch tutorial", sub: "Unlocks your personal pitch page", done: tut.done },
  ];
  const n = steps.filter(s => s.done).length;
  if (n === steps.length) return null;
  return (
    <section className="overflow-hidden rounded-2xl bg-[#0A0A0A] text-white" data-testid="start-here">
      <div className="flex items-center gap-3 px-4 pt-4">
        <div className="flex-1">
          <div className="font-['Playfair_Display'] text-xl font-semibold">Start here</div>
          <div className="text-sm text-white/65">{n} of 3 done · takes about 10 minutes</div>
        </div>
        <button
          type="button"
          aria-label="Hide Start here"
          onClick={() => {
            localStorage.setItem("hub-start-hidden", "1");
            setHidden(true);
          }}
          className="p-1 text-white/50"
        >
          <X className="size-4" />
        </button>
      </div>
      <ol className="mt-2">
        {steps.map((s, i) => (
          <li key={s.id} className="border-t border-white/10">
            {s.id === "why" ? (
              <Link to="/why" className="flex items-center gap-3 px-4 py-3">
                <StepDot i={i} done={s.done} />
                <StepText title={s.title} sub={s.sub} done={s.done} />
                <ArrowRight className="size-4 text-[#D9BC8C]" />
              </Link>
            ) : (
              <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <StepDot i={i} done={s.done} />
                <StepText title={s.title} sub={s.sub} done={s.done} />
                <ArrowRight className={`size-4 text-[#D9BC8C] transition-transform ${open === s.id ? "rotate-90" : ""}`} />
              </button>
            )}
            {open === s.id && s.id === "phone" && (
              <div className="space-y-2 px-4 pb-4">
                <InstallCard />
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem("hub-install-dismissed", "1");
                    setPhoneDone(true);
                    setOpen(null);
                  }}
                  className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold"
                >
                  <Smartphone className="mr-1 -mt-0.5 inline size-4" /> It's on my phone
                </button>
              </div>
            )}
            {open === s.id && s.id === "tools" && (
              <div className="px-4 pb-4 text-[#0A0A0A]">
                <ToolSetupCard />
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
const StepDot = ({ i, done }: { i: number; done: boolean }) => (
  <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? "bg-[#9C7434] text-white" : "ring-2 ring-[#D9BC8C] text-[#D9BC8C]"}`}>
    {done ? <Check className="size-4" /> : i + 1}
  </span>
);
const StepText = ({ title, sub, done }: { title: string; sub: string; done: boolean }) => (
  <span className="min-w-0 flex-1">
    <span className={`block text-[16px] font-semibold ${done ? "text-white/50 line-through" : ""}`}>{title}</span>
    <span className="block text-sm text-white/60">{sub}</span>
  </span>
);

// Change id + copy when something new ships; a new id shows the card again for everyone.
const NEW_THIS_WEEK = { id: "signature-2026-11", to: "/signature", title: "Make your email signature", sub: "Your photo, cell and social links with the SpaceMatch and Real logos. Copy it into Gmail in 2 minutes" };

const APPS_ORDERED = [...TOOLS.filter(t => t.setup), ...TOOLS.filter(t => !t.setup)];
const APP_LABEL: Record<string, string> = {
  "Lofty CRM": "Lofty", "reZEN (Real)": "reZEN", "ShowingTime": "Showings", "spacematchinc.com": "Website", "Team Drive": "Drive",
};

export function HomePage() {
  const me = useQuery(api.hubMe.me);
  const quota = useQuery(api.cma.quota, {});
  const counts = useQuery(api.forms.counts);
  const requests = useQuery(api.cma.list);
  const help = useQuery(api.help.list);
  const decide = useMutation(api.cma.decideApproval);
  const refresh = useMutation(api.hubToday.requestRefresh);
  const [viewAs, setViewAs] = useState<string | undefined>(undefined);
  const today = useQuery(api.hubToday.mine, { agentName: viewAs });
  const [helpOpen, setHelpOpen] = useState(false);
  const [allApps, setAllApps] = useState(false);
  const [mine] = useState(() => myTools());
  const [newHidden, setNewHidden] = useState(() => {
    try { return localStorage.getItem(`hub-new-${NEW_THIS_WEEK.id}`) === "1"; } catch { return false; }
  });
  const { done, mark, undo } = useDoneToday();
  const first = me?.firstName ?? "";
  const todayAgent = today?.agentName ?? null;

  // Auto-refresh Today from Lofty on open and when the app comes back to the foreground
  // (Michael 2026-10-18). Server keeps the 10-min cooldown; the manual button stays.
  const lastAuto = useRef(0);
  useEffect(() => {
    if (!todayAgent || !today) return;
    const maybe = () => {
      if (document.visibilityState !== "visible") return;
      const stale = Date.now() - (today.updatedAt || 0) > 10 * 60_000;
      if (!stale || today.refreshing || Date.now() - lastAuto.current < 60_000) return;
      lastAuto.current = Date.now();
      refresh({ agentName: viewAs }).catch(() => {});
    };
    maybe();
    document.addEventListener("visibilitychange", maybe);
    window.addEventListener("focus", maybe);
    return () => {
      document.removeEventListener("visibilitychange", maybe);
      window.removeEventListener("focus", maybe);
    };
  }, [todayAgent, today?.updatedAt, today?.refreshing, viewAs]);

  const recent = (requests ?? []).filter(r => Date.now() - r._creationTime < 21 * 86400000);
  const forAgent = recent.filter(r => !todayAgent || !me?.isAdmin || r.agentName === todayAgent);
  const ready = forAgent.filter(r => r.status === "ready").slice(0, 3);
  const needs = forAgent.filter(r => r.status === "needs_info");
  const approvals = quota?.isAdmin ? (requests ?? []).filter(r => r.status === "approval") : [];
  const left = quota?.agentName ? Math.max(0, quota.agentCap - quota.agentUsed) : null;
  const showAgent = (name: string) => (me?.agentName === name ? "" : ` · ${name}`);
  // Help asks: only fresh ones (3 days) or urgent; older ones live on the Help page.
  const helpToMe = (help?.toMe ?? []).filter(
    r => r.status !== "done" && (r.urgency === "now" || Date.now() - r.createdAt < 3 * 864e5),
  );
  const myOpenHelp = (help?.mine ?? []).filter(r => r.status !== "done").length;

  const now: Row[] = [
    ...(counts?.newLeads ?? []).map(l => ({
      key: l._id,
      title: `${l.contactName}`,
      sub: `Sent ${l.formTitle} · ${ago(l._creationTime)}`,
      to: `/inbox?open=${l._id}`,
      phone: l.contactPhone,
      hot: true,
    })),
    ...helpToMe.slice(0, 3).map(r => ({
      key: r._id,
      title: `${r.fromName} needs help: ${r.topic}`,
      sub: `${r.urgency === "now" ? "Urgent · " : ""}${me?.isAdmin ? `to ${r.toName} · ` : ""}${ago(r.createdAt)}`,
      to: "/help",
      hot: r.urgency === "now",
    })),
    ...approvals.map(r => ({
      key: r._id,
      title: `Extra CMA · ${r.agentName}`,
      sub: `${formatAddress(r)}`,
      action: (
        <span className="flex shrink-0 gap-1.5">
          <button type="button" className="rounded-lg bg-[#0A0A0A] px-3 py-2 text-sm font-semibold text-white" onClick={() => decide({ id: r._id, approve: true }).then(() => toast.success("Approved"))}>
            Approve
          </button>
          <button type="button" className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-semibold" onClick={() => decide({ id: r._id, approve: false }).then(() => toast("Declined"))}>
            No
          </button>
        </span>
      ),
    })),
    ...needs.map(r => ({
      key: r._id,
      title: `CMA needs info · ${formatAddress(r)}`,
      sub: `${r.statusNote ?? "Open to add details"}${showAgent(r.agentName)}`,
      to: `/requests/${r._id}/edit`,
      hot: true,
    })),
  ];

  // Who to call: appointments today → new leads → follow-ups due → quiet hot leads. Top 5.
  const d = today?.data;
  const calls: Row[] = [
    ...(d?.appointments ?? []).map(x => ({
      key: `ap${x.id}`,
      title: x.name,
      sub: `${when(x.at)} · ${x.what}`,
      href: LOFTY_LEAD(x.leadId),
      phone: x.phone,
    })),
    ...(d?.newLeads ?? []).map(l => ({
      key: `nl${l.leadId}`,
      title: l.name,
      sub: `New lead${l.source ? ` · ${l.source}` : ""}${l.at ? ` · ${ago(l.at)}` : ""}`,
      href: LOFTY_LEAD(l.leadId),
      phone: l.phone,
      hot: true,
    })),
    ...(d?.followUps ?? []).map(x => ({
      key: `fu${x.id}`,
      title: x.name,
      sub: `${x.overdue ? "Overdue follow-up" : `Follow-up due ${when(x.at)}`}${x.what && x.what !== x.type ? ` · ${x.what}` : ""}`,
      href: LOFTY_LEAD(x.leadId),
      phone: x.phone,
      hot: x.overdue,
    })),
    ...(d?.quiet ?? []).map(l => ({
      key: `q${l.leadId}`,
      title: l.name,
      sub: `Hot lead, no touch in ${daysAgo(l.at)}`,
      href: LOFTY_LEAD(l.leadId),
      phone: l.phone,
    })),
  ];
  const seen = new Set<string>();
  const open = calls.filter(c => {
    const id = c.href ?? c.key;
    if (done.includes(c.key) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const top = open.slice(0, 5);
  const doneCount = calls.filter(c => done.includes(c.key)).length;
  const [lastDone, setLastDone] = useState<string | null>(null);

  const cmaReady: Row[] = ready.map(r => ({
    key: r._id,
    title: `CMA ready · ${formatAddress(r)}`,
    sub: `For ${r.clientName}${showAgent(r.agentName)} · PDF + workbook`,
    to: "/requests",
  }));

  return (
    <div className="space-y-5">
      {/* Greeting + search */}
      <section className="relative -mx-4 -mt-5 lg:-mx-6">
        <div
          className="bg-cover bg-center px-5 pt-6 pb-12 text-white md:px-10 md:pt-9 md:pb-14"
          style={{
            backgroundImage:
              "linear-gradient(90deg,rgba(10,10,10,.94),rgba(10,10,10,.78) 60%,rgba(10,10,10,.5)),url(/hero.jpg)",
          }}
        >
          <h1 className="font-['Playfair_Display'] text-[28px] font-bold leading-tight md:text-4xl">
            {greeting()}
            {first ? `, ${first}` : ""}.
          </h1>
          <p className="mt-1 text-[15px] text-[#ddd6ca]">
            {top.length
              ? `${open.length} ${open.length === 1 ? "person" : "people"} to reach today. Start at the top.`
              : "Search for anything: a form, a vendor, a listing, a doc."}
          </p>
        </div>
        <div className="absolute inset-x-4 -bottom-7 md:inset-x-10">
          <GlobalSearch big />
        </div>
      </section>
      <div className="pt-3" />

      {me?.isShared && (
        <div className="rounded-2xl bg-amber-50 p-4 text-[15px] leading-relaxed text-amber-950 ring-1 ring-amber-200" data-testid="shared-banner">
          <b>You're signed in as the shared team@ account.</b> Each agent needs their own @spacematchinc.com login so CMA limits, Today and help requests track the right person.
        </div>
      )}

      <StartHere />

      {/* Today */}
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="font-['Playfair_Display'] text-2xl font-semibold text-[#0A0A0A]">Today</h2>
          {me?.isStaff && me.agents.length > 0 && (
            <select
              aria-label="View Today as"
              value={viewAs ?? todayAgent ?? ""}
              onChange={e => setViewAs(e.target.value || undefined)}
              className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm"
            >
              {me.agents.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          )}
          {todayAgent && (
            <button
              type="button"
              onClick={() =>
                refresh({ agentName: viewAs })
                  .then(r => (r.started ? toast("Pulling your day from Lofty…") : toast("Up to date (refreshes every 10 min max)")))
                  .catch(() => toast.error("Couldn't refresh"))
              }
              className="ml-auto inline-flex items-center gap-1.5 text-sm text-stone-500"
              data-testid="lofty-updated"
            >
              <RefreshCw className={`size-3.5 ${today?.refreshing ? "animate-spin" : ""}`} />
              {today?.refreshing ? "Updating…" : today?.updatedAt ? `Lofty ${ago(today.updatedAt)}` : "Load from Lofty"}
            </button>
          )}
        </div>
        <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe5da]" data-testid="today">
          {today?.error && <div className="bg-amber-50 px-4 py-2 text-sm text-amber-800">{today.error}</div>}
          {now.length > 0 && (
            <div data-testid="today-now">
              <Label>Needs you now</Label>
              {now.map(r => <RowLine key={r.key} r={r} />)}
            </div>
          )}
          {todayAgent && d && (
            <div data-testid="today-calls">
              <Label
                right={
                  lastDone ? (
                    <button type="button" onClick={() => { undo(lastDone); setLastDone(null); }} className="text-xs font-semibold text-[#7a5a26]">Undo</button>
                  ) : doneCount ? (
                    <span className="text-xs font-normal text-stone-500">{doneCount} done</span>
                  ) : undefined
                }
              >
                Call these {top.length > 1 ? top.length : ""} today
              </Label>
              {top.length === 0 ? (
                <div className="px-4 py-4 text-[15px] text-stone-600">
                  {doneCount ? `All done. Nice work: ${doneCount} reached today.` : "Nobody waiting on you in Lofty right now."}
                </div>
              ) : (
                top.map(r => <RowLine key={r.key} r={r} onDone={() => { mark(r.key); setLastDone(r.key); }} />)
              )}
              {open.length > 5 && (
                <a href="https://crm.lofty.com" target="_blank" rel="noreferrer" className="block px-4 py-2.5 text-sm font-semibold text-[#7a5a26]">
                  Done with these? See the rest in Lofty →
                </a>
              )}
            </div>
          )}
          {todayAgent && !d && !today?.error && (
            <div className="px-4 py-4 text-[15px] text-stone-600">
              Your Lofty day loads here. {today?.refreshing ? "Pulling it now…" : "Tap Load from Lofty."}
            </div>
          )}
          {!todayAgent && now.length === 0 && (
            <div className="px-4 py-4 text-[15px] text-stone-600">Nothing needs you right now.</div>
          )}
          {cmaReady.length > 0 && (
            <div>
              <Label>CMAs ready</Label>
              {cmaReady.map(r => <RowLine key={r.key} r={r} />)}
            </div>
          )}
        </div>
      </section>

      {/* What are you working on? (Michael 11-22: tools by moment, big buttons) */}
      <section data-testid="moments">
        <h2 className="mb-2 font-['Playfair_Display'] text-2xl font-semibold text-[#0A0A0A]">What are you working on?</h2>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
          {MOMENTS.map(m => (
            <Link key={m.id} to={`/do/${m.id}`} data-testid={`moment-${m.id}`} className="flex min-h-[108px] flex-col justify-between rounded-2xl bg-[#0A0A0A] p-3.5 text-white hover:bg-[#1c1a17]">
              <m.icon className="size-6 text-[#D9BC8C]" />
              <span>
                <span className="mt-2 block text-[18px] font-bold leading-tight">{m.label}</span>
                <span className="mt-0.5 block text-[15px] leading-snug text-stone-300">{m.sub}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* My tools = this phone's 4 most-opened tools (defaults until used) + All tools + Get help */}
      <section data-testid="my-tools">
        <h2 className="mb-2 text-[18px] font-bold text-[#0A0A0A]">My tools</h2>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {mine.map(t => (
            <Link key={t.to} to={t.to} data-testid={`mytool${t.to.replace(/\//g, "-")}`} className="flex min-h-[60px] items-center gap-2.5 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-[#ddd6ca] hover:bg-[#FBFAF7]">
              <t.icon className="size-6 shrink-0 text-[#9C7434]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold leading-tight text-[#0A0A0A]">{t.name}</span>
                {t.to === "/new" && left !== null && <span className="block text-[14px] leading-tight text-stone-700">{left} of {quota?.agentCap} left</span>}
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <Link to="/tools" data-testid="act-all-tools" className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-[#9C7434] px-3 text-[17px] font-bold text-white hover:bg-[#8a662c]">
            <Grid2x2 className="size-5" /> All tools
          </Link>
          <button type="button" onClick={() => setHelpOpen(true)} data-testid="act-help" className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-white px-3 text-[17px] font-bold text-[#0A0A0A] ring-2 ring-[#0A0A0A]">
            <LifeBuoy className="size-5" /> Get help{myOpenHelp ? ` (${myOpenHelp})` : ""}
          </button>
        </div>
      </section>

      {/* One "New this week" card instead of permanent promo cards; closing it hides it on this phone. */}
      {!newHidden && (
        <div className="flex items-center gap-3 rounded-2xl bg-[#FBF4E6] p-4 ring-2 ring-[#D9BC8C]" data-testid="new-this-week">
          <Link to={NEW_THIS_WEEK.to} data-testid="act-signature" className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#9C7434]"><PenLine className="size-5 text-white" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-[#7a5a26]">New this week</span>
              <span className="block text-[17px] font-semibold leading-tight text-[#0A0A0A]">{NEW_THIS_WEEK.title}</span>
              <span className="mt-0.5 block text-[15px] leading-snug text-stone-700">{NEW_THIS_WEEK.sub}</span>
            </span>
          </Link>
          <button
            type="button"
            aria-label="Close New this week"
            onClick={() => {
              try { localStorage.setItem(`hub-new-${NEW_THIS_WEEK.id}`, "1"); } catch { /* private mode */ }
              setNewHidden(true);
            }}
            className="grid size-10 shrink-0 place-items-center rounded-lg text-stone-600"
          >
            <X className="size-5" />
          </button>
        </div>
      )}

      <DeskTile />
      <AnnouncementsPreview />

      {/* Tools: one tap into the apps they use daily */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[18px] font-bold text-[#0A0A0A]">Your apps</h2>
          <button type="button" onClick={() => setAllApps(v => !v)} className="text-[15px] font-semibold text-[#7a5a26] hover:underline">
            {allApps ? "Show less" : `All apps (${TOOLS.length})`}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-x-2 gap-y-4 rounded-2xl bg-white px-3 py-4 ring-1 ring-[#ebe5da] lg:grid-cols-8" data-testid="your-apps">
          {(allApps ? APPS_ORDERED : APPS_ORDERED.slice(0, 8)).map(t => (
            <a key={t.name} href={toolHref(t)} target="_blank" rel="noreferrer" title={t.note} className="group flex min-w-0 flex-col items-center gap-1.5 text-center">
              <span className="flex size-12 items-center justify-center rounded-[14px] bg-white shadow-sm ring-1 ring-black/5 transition group-hover:-translate-y-0.5 group-hover:shadow">
                <img src={t.icon} alt="" className="size-8 object-contain" loading="lazy" />
              </span>
              <span className="w-full truncate text-xs font-medium text-stone-700">{APP_LABEL[t.name] ?? t.name}</span>
            </a>
          ))}
        </div>
      </section>

      {helpOpen && <GetHelpDialog onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
