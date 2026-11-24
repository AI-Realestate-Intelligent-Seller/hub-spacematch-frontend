// Growth Score card (Michael 2026-11-02): the agent's real online presence scored against the
// playbook's SPACE formula, with the 3 biggest fixes. Staff can open any agent + see the ranking.
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  RefreshCw,
  Star,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "../../../convex/_generated/api";
import {
  type Fix,
  GBP_MANAGER_EMAIL,
  PROFILES,
  type ProfileKey,
} from "../../../convex/growthScoreDefs";

const errMsg = (e: unknown) =>
  String(e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? "Something went wrong";
const COLOR = { red: "#c0392b", yellow: "#b7860b", green: "#1e8449" } as const;
const ago = (t: number | null) => {
  if (!t) return "never";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)} days ago`;
};

function Ring({ total, color }: { total: number; color: keyof typeof COLOR }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 120 120"
      className="size-32 shrink-0"
      role="img"
      aria-label={`Growth Score ${total}`}
    >
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="10"
      />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={COLOR[color]}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${(total / 100) * c} ${c}`}
        transform="rotate(-90 60 60)"
      />
      <text
        x="60"
        y="66"
        textAnchor="middle"
        className="fill-white"
        style={{ font: "700 34px 'Playfair Display', serif" }}
        data-testid="score-total"
      >
        {total}
      </text>
      <text
        x="60"
        y="86"
        textAnchor="middle"
        style={{ font: "600 11px Mada, sans-serif", fill: "#D9BC8C" }}
      >
        of 100
      </text>
    </svg>
  );
}

function CopyEmail() {
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard
          .writeText(GBP_MANAGER_EMAIL)
          .then(() => toast.success("Copied"))
      }
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A0A0A] px-3 py-2 text-sm font-semibold text-white"
      data-testid="copy-manager-email"
    >
      <Copy className="size-4" /> {GBP_MANAGER_EMAIL}
    </button>
  );
}

export function GoogleConnectDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const invited = useMutation(api.growthScore.gbpInvited);
  const [noProfile, setNoProfile] = useState(false);
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        data-testid="gbp-dialog"
      >
        <DialogHeader>
          <DialogTitle>Connect your Google reviews</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setNoProfile(false)}
            className={`rounded-full px-3 py-1.5 font-semibold ${!noProfile ? "bg-[#0A0A0A] text-white" : "bg-stone-100"}`}
          >
            I have a Business Profile
          </button>
          <button
            type="button"
            onClick={() => setNoProfile(true)}
            className={`rounded-full px-3 py-1.5 font-semibold ${noProfile ? "bg-[#0A0A0A] text-white" : "bg-stone-100"}`}
          >
            I don't have one yet
          </button>
        </div>
        {!noProfile ? (
          <ol className="space-y-4 text-[15px]">
            <li>
              <b>1. Open your profile.</b> Sign in with the Google account that
              owns it.
              <a
                href="https://business.google.com/locations"
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex w-fit items-center gap-1.5 rounded-lg bg-[#9C7434] px-3 py-2 text-sm font-semibold text-white"
              >
                Open Google Business Profile <ExternalLink className="size-4" />
              </a>
            </li>
            <li>
              <b>2. Go to managers.</b> Tap the <b>⋮</b> menu →{" "}
              <b>Business Profile settings</b> → <b>People and access</b> →{" "}
              <b>Add</b>.
              <div className="mt-1 text-sm text-stone-600">
                On a phone: search Google for “my business”, then ⋮ → Business
                Profile settings → People and access.
              </div>
            </li>
            <li>
              <b>3. Add the team as Manager.</b> Paste this email, pick{" "}
              <b>Manager</b>, tap <b>Invite</b>.
              <div className="mt-2">
                <CopyEmail />
              </div>
              <div className="mt-1 text-sm text-stone-600">
                Manager can read reviews. It can't remove you or delete anything
                you own.
              </div>
            </li>
            <li>
              <b>4. Tell us you sent it.</b> The office accepts it, and your
              reviews show up on your score within a day.
              <button
                type="button"
                data-testid="gbp-sent"
                onClick={() =>
                  invited({})
                    .then(() => {
                      toast.success(
                        "Thanks! We'll accept it and check your reviews.",
                      );
                      onClose();
                    })
                    .catch(e => toast.error(errMsg(e)))
                }
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#0A0A0A] px-3 py-2 text-sm font-semibold text-white"
              >
                <Check className="size-4" /> I sent the invite
              </button>
            </li>
          </ol>
        ) : (
          <ol className="space-y-3 text-[15px]">
            <li>
              <b>1. Create it</b> (10 min):{" "}
              <a
                href="https://business.google.com/create"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#7a5a26] underline"
              >
                business.google.com/create
              </a>
            </li>
            <li>
              <b>2. Business name:</b> your name as clients know you (e.g. “Jane
              Doe – SpaceMatch Realtor”). <b>Category:</b> Real Estate Agent.
            </li>
            <li>
              <b>3. Location:</b> choose “I deliver goods and services to my
              customers”, hide the address, and add your service areas (your
              niche neighborhoods first).
            </li>
            <li>
              <b>4. Add</b> your phone, spacematchinc.com, your headshot (same
              file as everywhere else) and 5+ photos.
            </li>
            <li>
              <b>5. Verify</b> when Google asks (usually a short video). Then
              come back here and use “I have a Business Profile”.
            </li>
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

type CardData = NonNullable<ReturnType<typeof useCard>>;
function useCard(agentEmail?: string) {
  const c = useQuery(api.growthScore.myCard, agentEmail ? { agentEmail } : {});
  return c && !c.none ? c : null;
}

function ProfilesForm({ c, onDone }: { c: CardData; onDone: () => void }) {
  const save = useMutation(api.growthScore.saveProfile);
  const [niche, setNiche] = useState(c.niche);
  const [ig, setIg] = useState(c.instagram ? `@${c.instagram}` : "");
  const [yt, setYt] = useState(c.youtube);
  const [z, setZ] = useState(
    c.zillowReviews == null ? "" : String(c.zillowReviews),
  );
  const [links, setLinks] = useState<Partial<Record<ProfileKey, string>>>(
    c.links,
  );
  const [busy, setBusy] = useState(false);
  const urlProfiles = PROFILES.filter(
    p => !["instagram", "youtube", "google"].includes(p.key),
  );
  const submit = async () => {
    setBusy(true);
    try {
      await save({
        ...(c.isSelf ? {} : { agentEmail: c.email }),
        niche,
        instagram: ig,
        youtube: yt,
        links,
        zillowReviews: z === "" ? null : Number(z),
      });
      toast.success("Saved. Checking your profiles now…");
      onDone();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const field =
    "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-[15px] focus:border-[#9C7434] focus:outline-none";
  return (
    <div className="space-y-4" data-testid="profiles-form">
      <label className="block text-sm font-semibold">
        Your one sentence: “I help ___ in ___ do ___.”
        <input
          className={field}
          value={niche}
          onChange={e => setNiche(e.target.value)}
          placeholder="I help first-time buyers in Avondale get into a 2-flat"
          data-testid="pf-niche"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-semibold">
          Instagram handle
          <input
            className={field}
            value={ig}
            onChange={e => setIg(e.target.value)}
            placeholder="@yourname"
            data-testid="pf-instagram"
          />
        </label>
        <label className="block text-sm font-semibold">
          YouTube channel
          <input
            className={field}
            value={yt}
            onChange={e => setYt(e.target.value)}
            placeholder="@yourchannel"
            data-testid="pf-youtube"
          />
        </label>
        <label className="block text-sm font-semibold">
          Zillow reviews (count)
          <input
            className={field}
            inputMode="numeric"
            value={z}
            onChange={e => setZ(e.target.value.replace(/\D/g, ""))}
            placeholder="0"
            data-testid="pf-zillow-count"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {urlProfiles.map(p => (
          <label key={p.key} className="block text-sm font-semibold">
            {p.label}
            <input
              className={field}
              value={links[p.key] ?? ""}
              onChange={e => setLinks({ ...links, [p.key]: e.target.value })}
              placeholder={p.hint}
              data-testid={`pf-${p.key}`}
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="rounded-lg bg-[#9C7434] px-5 py-2.5 font-semibold text-white disabled:opacity-60"
        data-testid="pf-save"
      >
        {busy ? "Saving…" : "Save and check my score"}
      </button>
    </div>
  );
}

function FixCard({
  f,
  i,
  onGoogle,
}: {
  f: Fix;
  i: number;
  onGoogle: () => void;
}) {
  return (
    <div
      className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da]"
      data-testid={`fix-${f.id}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0A0A0A] text-sm font-bold text-white">
          {i + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h4 className="text-[17px] font-semibold">{f.title}</h4>
            <span className="text-sm font-semibold text-[#c0392b]">
              +{f.lost} pts
            </span>
          </div>
          <p className="mt-0.5 text-[15px] text-stone-600">{f.why}</p>
          <ul className="mt-2 space-y-1 text-[15px]">
            {f.steps.map(s => (
              <li key={s} className="flex gap-2">
                <span className="text-[#9C7434]">›</span>
                <span className="break-words">{s}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {f.id === "gbp_connect" && (
              <button
                type="button"
                onClick={onGoogle}
                className="rounded-lg bg-[#9C7434] px-3 py-1.5 text-sm font-semibold text-white"
                data-testid="fix-connect-google"
              >
                Connect my Google reviews
              </button>
            )}
            {f.playbookItem && (
              <a
                href={`#growth-item-${f.playbookItem}`}
                className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-semibold text-stone-800"
              >
                Playbook step
              </a>
            )}
            {f.hubLink && (
              <Link
                to={f.hubLink.to}
                className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-semibold text-stone-800"
              >
                {f.hubLink.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GrowthScoreCard({ agentEmail }: { agentEmail?: string }) {
  const raw = useQuery(
    api.growthScore.myCard,
    agentEmail ? { agentEmail } : {},
  );
  const recheck = useMutation(api.growthScore.recheck);
  const [edit, setEdit] = useState(false);
  const [google, setGoogle] = useState(false);
  useEffect(() => setEdit(false), [agentEmail]);
  if (raw === undefined)
    return <div className="h-48 animate-pulse rounded-2xl bg-stone-100" />;
  if (!raw || raw.none) return null;
  const c = raw;
  const s = c.score;
  const first = !c.niche && !c.instagram && !Object.keys(c.links).length;
  const doRecheck = () =>
    recheck(c.isSelf ? {} : { agentEmail: c.email })
      .then(() => toast.success("Checking…"))
      .catch(e => toast.error(errMsg(e)));
  const g = c.signals?.google;

  return (
    <section className="space-y-4" data-testid="growth-score">
      <div className="overflow-hidden rounded-2xl bg-[#0A0A0A] text-white">
        <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:p-6">
          {s ? (
            <Ring total={s.total} color={s.color} />
          ) : (
            <div className="flex size-32 shrink-0 items-center justify-center rounded-full ring-[10px] ring-white/15 text-center text-sm text-[#e7e1d6]">
              {c.checking ? "Checking…" : "No score yet"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#D9BC8C]">
              {c.isSelf ? "Your Growth Score" : `${c.name}'s Growth Score`}
            </div>
            <h2 className="font-['Playfair_Display'] text-2xl font-bold">
              {s
                ? s.color === "green"
                  ? "Strong. Keep the cadence."
                  : s.color === "yellow"
                    ? "Getting there. Fix the top 3."
                    : "Start with fix #1 below."
                : "See how you show up online"}
            </h2>
            <p className="mt-1 text-[15px] text-[#e7e1d6]">
              Checked from your real Instagram, YouTube, Google reviews, profile
              links and Lofty, against the playbook's SPACE formula. Followers
              don't count.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-[#e7e1d6]">
                {c.checking ? "Checking now…" : `Checked ${ago(c.checkedAt)}`}
              </span>
              {s && s.measured < 100 && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[#e7e1d6]">
                  based on {s.measured} of 100 points we could check
                </span>
              )}
              {!first && (
                <button
                  type="button"
                  onClick={doRecheck}
                  disabled={c.checking}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20 disabled:opacity-50"
                  data-testid="score-recheck"
                >
                  <RefreshCw
                    className={`size-4 ${c.checking ? "animate-spin" : ""}`}
                  />{" "}
                  Recheck
                </button>
              )}
            </div>
          </div>
        </div>
        {s && (
          <div className="grid gap-px bg-white/10 sm:grid-cols-5">
            {s.parts.map(p => {
              const pct = p.got === null || !p.max ? 0 : (p.got / p.max) * 100;
              const col =
                p.got === null
                  ? "#6b665d"
                  : pct >= 75
                    ? COLOR.green
                    : pct >= 50
                      ? COLOR.yellow
                      : COLOR.red;
              return (
                <div
                  key={p.key}
                  className="bg-[#0A0A0A] p-4"
                  data-testid={`part-${p.key}`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-['Playfair_Display'] text-2xl font-bold text-[#D9BC8C]">
                      {p.key}
                    </span>
                    <span className="text-sm font-semibold">
                      {p.got === null ? "–" : `${Math.round(p.got)}/${p.max}`}
                    </span>
                  </div>
                  <div className="text-sm font-semibold">{p.label}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: col }}
                    />
                  </div>
                  <ul className="mt-2 space-y-0.5 text-[13px] leading-snug text-[#cfc8bb]">
                    {p.detail.map(d => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {c.signals?.notes?.length ? (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />{" "}
          {c.signals.notes.join(" · ")}
        </div>
      ) : null}

      {first ? (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]">
          <h3 className="text-lg font-semibold">Get your score in 3 minutes</h3>
          <p className="mb-4 text-[15px] text-stone-600">
            Add your handles and profile links once. The Hub re-checks them
            every Monday.
          </p>
          <ProfilesForm c={c} onDone={() => setEdit(false)} />
        </div>
      ) : (
        <>
          {s && s.fixes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">
                {c.isSelf ? "Your" : "Their"} top {Math.min(3, s.fixes.length)}{" "}
                fixes
              </h3>
              {s.fixes.slice(0, 3).map((f, i) => (
                <FixCard
                  key={f.id}
                  f={f}
                  i={i}
                  onGoogle={() => setGoogle(true)}
                />
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {c.isSelf && !(g && g.ok) && (
              <button
                type="button"
                onClick={() => setGoogle(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#9C7434] px-4 py-2 font-semibold text-white"
                data-testid="connect-google"
              >
                <Star className="size-4" /> Connect my Google reviews
              </button>
            )}
            {c.gbpClickedAt && !(g && g.ok) && (
              <span className="self-center text-sm text-stone-600">
                Invite sent {ago(c.gbpClickedAt)}. Waiting for the office to
                accept.
              </span>
            )}
          </div>
          <div className="rounded-2xl bg-white ring-1 ring-[#ebe5da]">
            <button
              type="button"
              onClick={() => setEdit(!edit)}
              className="flex w-full items-center justify-between p-4 text-left"
              data-testid="toggle-profiles"
            >
              <span className="text-lg font-semibold">My profiles</span>
              <ChevronDown
                className={`size-5 transition ${edit ? "rotate-180" : ""}`}
              />
            </button>
            {edit && (
              <div className="border-t border-stone-100 p-4">
                <ProfilesForm c={c} onDone={() => setEdit(false)} />
              </div>
            )}
          </div>
        </>
      )}
      <GoogleConnectDialog open={google} onClose={() => setGoogle(false)} />
    </section>
  );
}

// Staff: everyone's score, click to open their card.
export function TeamScores({
  onOpen,
  selected,
}: {
  onOpen: (email: string) => void;
  selected?: string;
}) {
  const t = useQuery(api.growthScore.team);
  const set = useMutation(api.growthScore.staffSet);
  if (!t) return null;
  const scored = t.list.filter(r => r.total !== null);
  const avg = scored.length
    ? Math.round(scored.reduce((a, r) => a + (r.total ?? 0), 0) / scored.length)
    : null;
  const waiting = t.list.filter(r => !r.gbp);
  return (
    <section
      className="rounded-2xl bg-white ring-1 ring-[#ebe5da]"
      data-testid="team-scores"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 p-4">
        <h2 className="text-lg font-semibold">Team Growth Scores</h2>
        <span className="text-sm text-stone-600">
          Only staff see this. Agents see their own card.
        </span>
        <span className="ml-auto text-sm font-semibold">
          {avg === null ? "No scores yet" : `Average ${avg}`}
        </span>
      </div>
      {(t.gbp.invites > 0 || t.gbp.unmatched.length > 0) && (
        <div className="space-y-2 border-b border-stone-100 bg-[#F7F5F1] p-4 text-sm">
          {t.gbp.invites > 0 && (
            <div>
              <b>{t.gbp.invites} Google Business Profile invite(s)</b> waiting.
              Open team@spacematchinc.com, find “invited you to manage”, tap
              Accept.
            </div>
          )}
          {t.gbp.unmatched.map(l => (
            <div key={l.id} className="flex flex-wrap items-center gap-2">
              <span>
                New profile <b>{l.title}</b>: whose is it?
              </span>
              <select
                className="rounded-md border border-stone-300 px-2 py-1"
                defaultValue=""
                onChange={e =>
                  e.target.value &&
                  set({ agentEmail: e.target.value, gbpLocation: l.id })
                    .then(() => toast.success("Matched"))
                    .catch(err => toast.error(errMsg(err)))
                }
              >
                <option value="">Pick agent…</option>
                {waiting.map(r => (
                  <option key={r.email} value={r.email}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
      <div className="divide-y divide-stone-100">
        {t.list.map((r, i) => (
          <button
            type="button"
            key={r.email}
            onClick={() => onOpen(r.email)}
            className={`grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 p-3 text-left hover:bg-[#F7F5F1] sm:grid-cols-[28px_180px_1fr_auto] ${selected === r.email ? "bg-[#F7F5F1]" : ""}`}
            data-testid={`team-row-${r.email}`}
          >
            <span className="text-sm text-stone-500">
              {r.total === null ? "–" : i + 1}
            </span>
            <span className="font-semibold">{r.name}</span>
            <span className="order-4 col-span-3 truncate text-sm text-stone-600 sm:order-none sm:col-span-1">
              {r.total === null
                ? r.setUp
                  ? "Checking soon"
                  : "Hasn't filled in My profiles"
                : (r.topFix ?? "No fixes")}
              {r.zillowReviews !== null && !r.zillowVerified && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => {
                    e.stopPropagation();
                    void set({
                      agentEmail: r.email,
                      zillowVerified: true,
                    }).then(() => toast.success("Zillow count verified"));
                  }}
                  onKeyDown={() => {}}
                  className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs font-semibold text-stone-700"
                >
                  verify Zillow {r.zillowReviews}
                </span>
              )}
            </span>
            <span className="text-right">
              <span
                className="text-lg font-bold"
                style={{ color: r.color ? COLOR[r.color] : "#a8a29e" }}
              >
                {r.total ?? "–"}
              </span>
              {r.prev !== null && r.total !== null && (
                <span className="ml-1 text-xs text-stone-500">
                  {r.total - r.prev >= 0 ? "+" : ""}
                  {r.total - r.prev}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
