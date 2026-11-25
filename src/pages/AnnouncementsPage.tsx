import { Bell, BellOff, ExternalLink, Loader2, Megaphone, Pin, PinOff, Send, Share2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { EmptyState, FieldError, LoadError, Skeleton, errorBorder } from "@/components/hub/FormState";
import { announcementsApi } from "@/lib/announcementsApi";
import { apiErrorMessage, fieldErrors, useApiData } from "@/lib/apiData";
import { check, fieldRules, orNull } from "@/lib/formRules";
import { z } from "zod";

const useAnnouncements = () => useApiData("announcements", () => announcementsApi.list(), { pollMs: 120_000 });
const MAX_BODY = 4000;
/** Same rules as the backend (announcement.validation.ts). */
const postSchema = z.object({
  title: fieldRules.text(140, "Headline"),
  body: z.string().trim().min(1, "Write something first.").max(MAX_BODY, `The announcement is too long (${MAX_BODY} characters max).`),
  link: fieldRules.website,
});

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d ago` : new Date(t).toLocaleDateString();
};

const b64ToBytes = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};

function usePush(vapidKey: string | null | undefined) {
  const subscribe = announcementsApi.subscribe;
  const unsubscribe = ({ endpoint }: { endpoint: string }) => announcementsApi.unsubscribe(endpoint);
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.getRegistration().then(r => r?.pushManager.getSubscription()).then(s => setOn(!!s)).catch(() => setOn(false));
  }, [supported]);
  const enable = async () => {
    if (!vapidKey) return toast.error("Notifications aren't set up yet.");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return toast.error("Notifications are blocked. Allow them in your phone settings.");
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(vapidKey) });
    const j = sub.toJSON();
    await subscribe({ endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "" }).catch(e => { toast.error(apiErrorMessage(e)); throw e; });
    setOn(true);
    toast.success("Notifications on for this phone.");
  };
  const disable = async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await unsubscribe({ endpoint: sub.endpoint }); await sub.unsubscribe(); }
    setOn(false);
  };
  return { supported, on, enable, disable };
}

function Composer({ initial }: { initial: { title: string; body: string } }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [link, setLink] = useState("");
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputCls = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[#9C7434] focus:ring-2 focus:ring-[#9C7434]/15";
  const recheck = (next: { title: string; body: string; link: string }) => {
    if (!Object.values(errors).some(Boolean)) return;
    const e = check(postSchema, next);
    setErrors(x => Object.fromEntries(Object.keys(x).map(k => [k, e[k] ?? ""])));
  };
  const submit = async () => {
    const errs = check(postSchema, { title, body, link });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await announcementsApi.post({ title: orNull(title), body: body.trim(), link: orNull(link), pinned, notify: true });
      setTitle(""); setBody(""); setLink(""); setPinned(false); setErrors({});
      toast.success("Posted. The whole team sees it now.");
    } catch (e) {
      setErrors(fieldErrors(e));
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da] space-y-3">
      <div className="flex items-center gap-2 font-semibold"><Megaphone className="size-4 text-[#9C7434]" /> New announcement</div>
      <div>
        <input value={title} maxLength={140} aria-label="Headline" aria-invalid={!!errors.title} onChange={e => { setTitle(e.target.value); recheck({ title: e.target.value, body, link }); }} placeholder="Headline (optional)" className={`${inputCls} ${errorBorder(errors.title)}`} />
        <FieldError msg={errors.title} />
      </div>
      <div>
        <textarea value={body} maxLength={MAX_BODY} aria-label="Announcement" aria-invalid={!!errors.body} onChange={e => { setBody(e.target.value); recheck({ title, body: e.target.value, link }); }} rows={5} placeholder="Paste the WhatsApp post or write the announcement…" className={`${inputCls} ${errorBorder(errors.body)}`} />
        <div className="flex items-start justify-between gap-3"><FieldError msg={errors.body} /><span className="ml-auto mt-0.5 text-xs text-stone-400">{body.length}/{MAX_BODY}</span></div>
      </div>
      <div>
        <input value={link} maxLength={300} inputMode="url" aria-label="Link" aria-invalid={!!errors.link} onChange={e => { setLink(e.target.value.trim()); recheck({ title, body, link: e.target.value.trim() }); }} placeholder="Link (optional), e.g. spacematchinc.com/news" className={`${inputCls} ${errorBorder(errors.link)}`} />
        <FieldError msg={errors.link} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} /> Pin to top</label>
        <button type="button" disabled={busy} onClick={submit} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[#9C7434] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {busy ? "Posting…" : "Post to the team"}
        </button>
      </div>
    </section>
  );
}

export function AnnouncementsPage() {
  const { data, error, reload } = useAnnouncements();
  const [busyId, setBusyId] = useState<string | null>(null);
  const run = (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusyId(id);
    fn().then(() => toast.success(ok)).catch(e => toast.error(apiErrorMessage(e))).finally(() => setBusyId(null));
  };
  const setPin = ({ id, pinned }: { id: string; pinned: boolean }) => run(id, () => announcementsApi.setPinned(id, pinned), pinned ? "Pinned to the top" : "Unpinned");
  const remove = ({ id }: { id: string }) => run(id, () => announcementsApi.remove(id), "Announcement deleted");
  const [params] = useSearchParams();
  const push = usePush(data?.vapidKey);
  const shared = [params.get("text"), params.get("url")].filter(Boolean).join("\n");
  const initial = { title: params.get("title") ?? "", body: shared };
  const isIOS = typeof navigator !== "undefined" && /iphone|ipad/i.test(navigator.userAgent);
  const standalone = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-['Playfair_Display'] text-3xl font-bold">Announcements</h1>
          <p className="text-sm text-stone-500 mt-1">Important team news in one place, so nobody has to scroll WhatsApp.</p>
        </div>
        {push.supported && push.on !== null && (
          push.on
            ? <button type="button" onClick={push.disable} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-[#ebe5da]"><BellOff className="size-4" /> Notifications on</button>
            : <button type="button" onClick={push.enable} className="inline-flex items-center gap-2 rounded-xl bg-[#0A0A0A] px-3 py-2 text-sm font-semibold text-white"><Bell className="size-4" /> Turn on notifications</button>
        )}
      </div>
      {isIOS && !standalone && (
        <p className="rounded-xl bg-[#F7F5F1] p-3 text-sm text-stone-600">On iPhone, add the Hub to your Home Screen first (Share → Add to Home Screen), then open it from the icon to turn on notifications.</p>
      )}
      {data?.canPost && <Composer key={shared} initial={initial} />}
      {data?.canPost && (
        <p className="flex items-start gap-2 text-xs text-stone-500"><Share2 className="mt-0.5 size-3.5 shrink-0" /> From WhatsApp on Android: long-press a message → Share → SpaceMatch. On iPhone: copy it and paste it here.</p>
      )}
      {data === undefined && (error ? <LoadError error={error} onRetry={() => void reload()} what="announcements" /> : <Skeleton rows={3} className="h-28" />)}
      {data && data.rows.length === 0 && (
        <EmptyState icon={<Megaphone className="size-8" />} title="No announcements yet">
          {data.canPost ? "Post the first one above. The whole team sees it here and on Home." : "Team news from leaders and ops shows up here."}
        </EmptyState>
      )}
      <div className="space-y-3">
        {data?.rows.map(a => (
          <article key={a._id} className={`rounded-2xl bg-white p-4 ring-1 ${a.pinned ? "ring-[#9C7434]" : "ring-[#ebe5da]"}`}>
            <div className="flex items-center gap-2 text-xs text-stone-500">
              {a.pinned && <span className="inline-flex items-center gap-1 rounded-full bg-[#9C7434]/10 px-2 py-0.5 font-semibold text-[#9C7434]"><Pin className="size-3" /> Pinned</span>}
              <span className="font-semibold text-stone-700">{a.authorName}</span><span>· {ago(a.createdAt)}</span>
              {data.canPost && (
                <span className="ml-auto flex gap-1">
                  {busyId === a._id && <Loader2 className="size-4 animate-spin self-center text-stone-400" />}
                  <button type="button" disabled={busyId === a._id} aria-label={a.pinned ? "Unpin" : "Pin"} onClick={() => setPin({ id: a._id, pinned: !a.pinned })} className="rounded-lg p-1.5 hover:bg-[#F7F5F1] disabled:opacity-50">{a.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}</button>
                  <button type="button" disabled={busyId === a._id} aria-label="Delete" onClick={() => { if (confirm("Delete this announcement?")) remove({ id: a._id }); }} className="rounded-lg p-1.5 hover:bg-[#F7F5F1] disabled:opacity-50"><Trash2 className="size-4" /></button>
                </span>
              )}
            </div>
            {a.title && <h2 className="mt-2 font-semibold text-[17px]">{a.title}</h2>}
            <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-stone-700">{a.body}</p>
            {a.link && <a href={a.link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#9C7434]">Open link <ExternalLink className="size-3.5" /></a>}
          </article>
        ))}
      </div>
    </div>
  );
}

export function AnnouncementsPreview() {
  const { data } = useAnnouncements();
  const rows = (data?.rows ?? []).slice(0, 2);
  // Hidden until there's a post (Michael 2026-10-18): an empty box looks unfinished.
  if (!data || rows.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#9C7434]">Announcements</h2>
        <Link to="/announcements" className="text-sm font-semibold text-[#9C7434]">{data.canPost ? "Post / see all" : "See all"}</Link>
      </div>
      {rows.length === 0 ? (
        <Link to="/announcements" className="block rounded-2xl bg-white p-4 text-sm text-stone-500 ring-1 ring-[#ebe5da]">No announcements yet. Tap to post the first one.</Link>
      ) : (
        <div className="rounded-2xl bg-white ring-1 ring-[#ebe5da] divide-y divide-stone-100">
          {rows.map(a => (
            <Link key={a._id} to="/announcements" className="block p-4 hover:bg-[#F7F5F1]">
              <div className="flex items-center gap-2 text-xs text-stone-500">{a.pinned && <Pin className="size-3 text-[#9C7434]" />}<span className="font-semibold text-stone-700">{a.authorName}</span> · {ago(a.createdAt)}</div>
              <div className="mt-1 line-clamp-2 text-[15px]">{a.title ? <b>{a.title} </b> : null}{a.body}</div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
