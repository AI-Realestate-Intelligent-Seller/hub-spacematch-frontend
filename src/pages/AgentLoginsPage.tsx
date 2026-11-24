import { useAction, useQuery } from "convex/react";
import { Copy, KeyRound, Loader2, MessageSquare, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";

const ago = (t: number | null) => {
  if (!t) return "Never signed in";
  const d = Math.floor((Date.now() - t) / 864e5);
  return d <= 0 ? "Signed in today" : d === 1 ? "Signed in yesterday" : `Signed in ${d} days ago`;
};
const errMsg = (e: unknown) => String(e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? "Couldn't reset. Try again.";

// Admins + ops: create or reset an agent's Hub login and text them a temporary password.
export function AgentLoginsPage() {
  const rows = useQuery(api.hubLogins.list);
  const reset = useAction(api.hubLogins.reset);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [shown, setShown] = useState<{ email: string; name: string; password: string } | null>(null);

  if (rows === undefined) return <div className="py-16 text-center text-stone-500">Loading…</div>;
  if (rows === null) return <div className="py-16 text-center text-stone-600">Agent logins are for admins and ops.</div>;

  const list = rows.filter(r => `${r.name} ${r.email}`.toLowerCase().includes(q.toLowerCase()));
  const go = async (email: string, name: string) => {
    setBusy(email);
    try {
      const r = await reset({ email });
      setShown({ email: r.email, name, password: r.password });
      toast.success(r.created ? "Login created" : "Password reset");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  const msg = shown
    ? `Hi ${shown.name.split(" ")[0]}, your SpaceMatch Agent Hub login: ${location.origin}/login\nEmail: ${shown.email}\nTemporary password: ${shown.password}\nYou'll stay signed in on your phone.`
    : "";
  const missing = rows.filter(r => !r.hasLogin).length;

  return (
    <div className="space-y-5" data-testid="logins-page">
      <div>
        <h1 className="font-['Playfair_Display'] text-3xl font-bold">Agent logins</h1>
        <p className="mt-1 text-[15px] text-stone-600">
          Agent forgot their password or never got the code? Tap <b>Reset</b>, then text them the temporary password. No email needed.
          {missing ? ` ${missing} ${missing === 1 ? "person has" : "people have"} no login yet.` : ""}
        </p>
        <p className="mt-1 text-[14px] text-stone-500">New agent? Add them on <a href="/team" className="font-semibold text-[#9C7434] underline">Team roster</a>: that creates their login too.</p>
      </div>

      {shown && (
        <div className="rounded-2xl bg-[#0A0A0A] p-4 text-white" data-testid="temp-password">
          <div className="text-sm text-white/60">Temporary password for {shown.name}</div>
          <div className="mt-1 font-mono text-2xl font-semibold tracking-wide text-[#D9BC8C]">{shown.password}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => navigator.clipboard.writeText(msg).then(() => toast.success("Copied"))} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold">
              <Copy className="size-4" /> Copy text message
            </button>
            <a href={`sms:?&body=${encodeURIComponent(msg)}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[#9C7434] px-3 py-2 text-sm font-semibold">
              <MessageSquare className="size-4" /> Text it
            </a>
            <button type="button" onClick={() => setShown(null)} className="ml-auto rounded-lg px-3 py-2 text-sm text-white/60">Done</button>
          </div>
          <p className="mt-2 text-xs text-white/50">Shown once. Reset again if it gets lost.</p>
        </div>
      )}

      <label className="flex items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-[#ebe5da]">
        <Search className="size-4 text-stone-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find an agent" className="h-11 flex-1 bg-transparent outline-none" />
      </label>

      <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe5da]">
        {list.map(r => (
          <li key={r.email} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-semibold">{r.name}</div>
              <div className="truncate text-sm text-stone-500">{r.email}</div>
              <div className="text-sm">{r.hasLogin ? <span className="text-stone-500">{ago(r.lastSignIn)}</span> : <span className="font-semibold text-red-700">No login yet</span>}</div>
            </div>
            <button
              type="button"
              disabled={busy === r.email}
              onClick={() => go(r.email, r.name.replace(" (guest)", ""))}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${r.hasLogin ? "bg-[#F7F5F1]" : "bg-[#0A0A0A] text-white"}`}
              data-testid={`reset-${r.email}`}
            >
              {busy === r.email ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              {r.hasLogin ? "Reset" : "Create"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
