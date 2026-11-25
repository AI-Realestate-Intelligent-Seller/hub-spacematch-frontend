import { Copy, Loader2, Mail, MessageSquare, Send, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { EmptyState, FieldError, LoadError, Skeleton, errorBorder } from "@/components/hub/FormState";
import { btnDark, btnLight, Card, H2, input, label, PageHead, Stat } from "@/components/hub/mm";
import { apiErrorMessage, fieldErrors, useApiData } from "@/lib/apiData";
import { typeName } from "@/lib/formRules";
import { marketMeApi } from "@/lib/marketApi";
import { mailLink, smsLink } from "@/lib/marketMe";

const toastErr = (e: unknown) => toast.error(apiErrorMessage(e));
const GOOGLE_HOSTS = ["g.page", "search.google.com", "www.google.com", "google.com", "maps.app.goo.gl", "goo.gl", "maps.google.com", "g.co"];
/** Same rule as the backend: empty, or a Google review link. */
const checkReviewUrl = (v: string) => {
  const t = v.trim();
  if (!t) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return GOOGLE_HOSTS.includes(u.hostname.toLowerCase()) ? "" : "That doesn't look like a Google review link. It should start with g.page or search.google.com.";
  } catch {
    return "That doesn't look like a Google review link. It should start with g.page or search.google.com.";
  }
};
const checkClient = (v: string) => {
  const t = v.trim();
  if (!t) return "Type the client's name first.";
  if (t.length < 2) return "Name is too short.";
  return "";
};

// /reviews — per-agent Google review requests (Michael 11-22 "agent specific especially google reviews").
// Every client sees the Google button (Google bans review gating); a private note box sits beside it.
const ago = (t: number) => {
  const d = Math.round((Date.now() - t) / 864e5);
  return d < 1 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

export function ReviewsPage() {
  const settings = useApiData("market-me:settings", () => marketMeApi.settings());
  const reviews = useApiData("market-me:reviews", () => marketMeApi.reviews(), { pollMs: 60_000 });
  const s = settings.data;
  const data = reviews.data;
  const [params] = useSearchParams();
  const [url, setUrl] = useState<string | null>(null);
  const [client, setClient] = useState(typeName(params.get("client") ?? "", 60));
  const [clientErr, setClientErr] = useState("");
  const [urlErr, setUrlErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (s && url === null) setUrl(s.reviewUrl);
  }, [s, url]);
  if (!s || !data) {
    const error = settings.error ?? reviews.error;
    return (
      <div className="mx-auto max-w-2xl space-y-4 pb-6" data-testid="reviews-page">
        <PageHead title="Google reviews" sub="Send a client your review link. You see who opened it and who tapped Google." />
        {error ? <LoadError error={error} onRetry={() => { void settings.reload(); void reviews.reload(); }} what="your reviews" /> : <Skeleton rows={3} className="h-32" />}
      </div>
    );
  }
  const agentFirst = s.name.split(" ")[0];
  const saveUrl = async () => {
    const e = checkReviewUrl(url ?? "");
    setUrlErr(e);
    if (e) return;
    setSaving(true);
    try {
      const saved = await marketMeApi.saveSettings({ reviewUrl: (url ?? "").trim() });
      setUrl(saved.reviewUrl);
      toast.success(saved.reviewUrl ? "Saved. The Google button now opens your page." : "Saved. The Google button opens the SpaceMatch page.");
    } catch (x) {
      setUrlErr(fieldErrors(x).reviewUrl ?? "");
      toastErr(x);
    } finally {
      setSaving(false);
    }
  };

  const send = async (channel: "text" | "email" | "copy") => {
    const e = checkClient(client);
    setClientErr(e);
    if (e) return;
    setBusy(true);
    try {
      const { token } = await marketMeApi.createReview(client.trim(), channel);
      const link = `${window.location.origin}/r/${token}`;
      const first = client.trim().split(/\s+/)[0];
      const msg = `Hi ${first}, thank you for trusting me with your move! Would you leave me a quick Google review? It takes about a minute: ${link} – ${agentFirst}`;
      if (channel === "text") window.location.href = smsLink(msg);
      else if (channel === "email") window.location.href = mailLink("Would you leave me a quick review?", msg);
      else {
        await navigator.clipboard.writeText(msg).catch(() => {});
        toast.success("Message with the link copied");
      }
      setClient("");
    } catch (e) {
      setClientErr(fieldErrors(e).clientName ?? "");
      toastErr(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6" data-testid="reviews-page">
      <PageHead title="Google reviews" sub="Send a client your review link. You see who opened it and who tapped Google." />

      <Card testid="review-send">
        <H2>Send a review request</H2>
        <label className={label} htmlFor="rv-client">Client's name</label>
        <input id="rv-client" className={`${input} ${errorBorder(clientErr)}`} maxLength={60} aria-invalid={!!clientErr} value={client} onChange={e => { setClient(typeName(e.target.value, 60)); if (clientErr) setClientErr(""); }} placeholder="e.g. Jordan Price" data-testid="rv-client" />
        <FieldError msg={clientErr} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button type="button" disabled={busy} className={`${btnDark} disabled:opacity-60`} onClick={() => send("text")} data-testid="rv-text">{busy ? <Loader2 className="size-[18px] animate-spin" /> : <MessageSquare className="size-[18px]" />} Text</button>
          <button type="button" disabled={busy} className={`${btnLight} disabled:opacity-60`} onClick={() => send("email")} data-testid="rv-email"><Mail className="size-[18px]" /> Email</button>
          <button type="button" disabled={busy} className={`${btnLight} disabled:opacity-60`} onClick={() => send("copy")} data-testid="rv-copy"><Copy className="size-[18px]" /> Copy</button>
        </div>
        <p className="mt-3 text-[15px] leading-snug text-stone-700">
          The client sees your name and photo and one big Google button, plus an optional private box to tell you what could be better.
          Every client gets the Google button: Google doesn't allow sending only happy clients there.
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-2" data-testid="rv-stats">
        <Stat n={data.sent} label="Sent" />
        <Stat n={data.opened} label="Opened" />
        <Stat n={data.clicked} label="Tapped Google" />
      </div>
      {data.mentions && (
        <p className="text-[15px] text-stone-700">
          Reviews on the SpaceMatch Google page that name you: <b className="text-[#0A0A0A]">{data.mentions.count}</b> of {data.mentions.total} (checked monthly).
        </p>
      )}

      <Card testid="review-link">
        <H2>Where the Google button goes</H2>
        <p className="mb-3 text-[16px] leading-snug text-stone-700">
          {s.reviewUrl ? (
            <>Your own Google Business Profile.</>
          ) : (
            <>The SpaceMatch Google page, and the client is asked to mention you by name. Have your own Google Business Profile? Paste its review link below.</>
          )}
        </p>
        <label className={label} htmlFor="rv-url">Your Google review link (optional)</label>
        <input id="rv-url" type="url" maxLength={500} className={`${input} ${errorBorder(urlErr)}`} aria-invalid={!!urlErr} value={url ?? ""} onChange={e => { setUrl(e.target.value.trim()); if (urlErr) setUrlErr(""); }} onBlur={() => url && setUrlErr(checkReviewUrl(url))} placeholder="https://g.page/r/…/review" data-testid="rv-url" />
        <FieldError msg={urlErr} />
        <p className="mt-1.5 text-[15px] text-stone-700">Find it in Google: Business Profile → <b>Ask for reviews</b> → copy the link. Leave it empty to use the SpaceMatch page.</p>
        <button type="button" disabled={saving} className={`${btnDark} mt-3 disabled:opacity-60`} data-testid="rv-save-url" onClick={saveUrl}>
          {saving && <Loader2 className="size-[18px] animate-spin" />}{saving ? "Saving…" : "Save link"}
        </button>
      </Card>

      <Card testid="review-list">
        <H2>Your requests</H2>
        {data.rows.length === 0 ? (
          <EmptyState icon={<Send className="size-8" />} title="No review requests yet">
            Type a client's name above and tap Text, Email or Copy. You'll see here when they open it and tap Google.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-stone-100">
            {data.rows.map(r => (
              <li key={r._id} className="py-3" data-testid="rv-row">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex-1 text-[17px] font-semibold text-[#0A0A0A]">{r.clientName}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[14px] font-bold ${r.clicked ? "bg-[#9C7434] text-white" : r.opened ? "bg-[#F7F5F1] text-[#0A0A0A]" : "bg-stone-100 text-stone-700"}`}>
                    {r.clicked ? (<><Star className="-mt-0.5 mr-1 inline size-3.5" />Tapped Google</>) : r.opened ? "Opened" : "Not opened yet"}
                  </span>
                </div>
                <div className="text-[15px] text-stone-700">Sent by {r.channel} {ago(r.createdAt)}</div>
                {r.note && <div className="mt-1.5 rounded-xl bg-amber-50 p-3 text-[16px] text-amber-950 ring-1 ring-amber-200">Private note: {r.note}</div>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {s.isStaff && data.team.length > 0 && (
        <Card testid="review-team">
          <H2>Team (staff only)</H2>
          <table className="w-full text-left text-[16px]">
            <thead>
              <tr className="text-stone-700"><th className="py-1.5">Agent</th><th>Sent</th><th>Opened</th><th>Google</th><th>Named</th></tr>
            </thead>
            <tbody>
              {data.team.map(t => (
                <tr key={t.agentName} className="border-t border-stone-100"><td className="py-2 font-semibold">{t.agentName}</td><td>{t.sent}</td><td>{t.opened}</td><td>{t.clicked}</td><td>{t.mentions}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
