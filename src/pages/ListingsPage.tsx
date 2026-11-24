import { useMutation, useQuery } from "convex/react";
import { AlertCircle, Building2, ChevronRight, Eye, MessageSquareWarning, Plus, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { AGENTS } from "@/lib/agents";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const inputCls = "w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-[16px] outline-none focus:border-[#9C7434] focus:ring-2 focus:ring-[#9C7434]/20";
export const errMsg = (e: unknown) => String((e as Error)?.message ?? e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? "Something went wrong";
export const ago = (t?: number) => {
  if (!t) return "";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 14 ? `${d}d ago` : new Date(t).toLocaleDateString();
};

const statusTone: Record<string, string> = {
  Preparing: "bg-stone-100 text-stone-700",
  "Coming soon": "bg-amber-100 text-amber-800",
  Active: "bg-emerald-100 text-emerald-800",
  "Under contract": "bg-sky-100 text-sky-800",
  Closed: "bg-[#0A0A0A] text-[#D9BC8C]",
  Withdrawn: "bg-stone-200 text-stone-500",
};
export const StatusChip = ({ s }: { s: string }) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone[s] ?? "bg-stone-100"}`}>{s}</span>;

function NewListing({ staff, onClose }: { staff: boolean; onClose: () => void }) {
  const create = useMutation(api.listings.create);
  const nav = useNavigate();
  const [f, setF] = useState({ address: "", mlsNumber: "", price: "", sellerName: "", sellerEmail: "", sellerPhone: "", agentName: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const id = await create({ ...f, agentName: f.agentName || undefined });
      toast.success("Listing created. Share the seller link next.");
      nav(`/listings/${id}`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[#F7F5F1] p-5 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl">New listing</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X className="size-5" /></button>
        </div>
        <p className="mb-4 text-sm text-stone-600">One minute. This builds your seller's live launch page.</p>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Property address *<input className={inputCls} value={f.address} onChange={set("address")} placeholder="1234 N Main St, Chicago, IL 60614" required /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">MLS #<input className={inputCls} value={f.mlsNumber} onChange={set("mlsNumber")} inputMode="numeric" placeholder="If you have it" /></label>
            <label className="block text-sm font-medium">List price<input className={inputCls} value={f.price} onChange={set("price")} placeholder="$549,000" /></label>
          </div>
          <label className="block text-sm font-medium">Seller name *<input className={inputCls} value={f.sellerName} onChange={set("sellerName")} required /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">Seller mobile<input className={inputCls} value={f.sellerPhone} onChange={set("sellerPhone")} type="tel" /></label>
            <label className="block text-sm font-medium">Seller email<input className={inputCls} value={f.sellerEmail} onChange={set("sellerEmail")} type="email" /></label>
          </div>
          {staff && (
            <label className="block text-sm font-medium">Listing agent
              <select className={inputCls} value={f.agentName} onChange={set("agentName")}>
                <option value="">Me</option>
                {AGENTS.map(a => <option key={a.name}>{a.name}</option>)}
              </select>
            </label>
          )}
        </div>
        <button disabled={busy} className="mt-5 w-full rounded-xl bg-[#0A0A0A] py-3 font-semibold text-white disabled:opacity-60">{busy ? "Creating…" : "Create listing"}</button>
      </form>
    </div>
  );
}

function Unmatched() {
  const rows = useQuery(api.listings.unmatchedShowings);
  const data = useQuery(api.listings.list, { scope: "all" });
  const assign = useMutation(api.listings.assignUnmatched);
  if (!rows?.length) return null;
  return (
    <section className="mt-8 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <h3 className="flex items-center gap-2 font-semibold"><AlertCircle className="size-4 text-amber-700" /> ShowingTime emails that matched no listing</h3>
      <p className="mt-1 text-sm text-stone-600">Usually the listing isn't in the Hub yet, or its MLS # is missing. Pick the listing to file it.</p>
      <ul className="mt-3 space-y-2">
        {rows.map(r => (
          <li key={r._id} className="flex flex-col gap-2 rounded-xl bg-white p-3 text-sm sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1"><div className="truncate font-medium">{r.subject}</div><div className="text-xs text-stone-500">MLS {r.mls ?? "–"} · {ago(r.createdAt)}</div></div>
            <select className="rounded-lg border border-stone-200 px-2 py-1.5" defaultValue="" onChange={e => e.target.value && assign({ inboxId: r._id, listingId: e.target.value as Id<"listings"> }).then(() => toast.success("Filed")).catch(err => toast.error(errMsg(err)))}>
              <option value="">File under…</option>
              {data?.rows.map(l => <option key={l._id} value={l._id}>{l.address}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ListingsPage() {
  const [scope, setScope] = useState<"mine" | "all">("all");
  const data = useQuery(api.listings.list, { scope });
  const [open, setOpen] = useState(false);
  const staff = !!data?.me.staff;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#9C7434]">Seller Launch Portal</p>
          <h1 className="font-display text-3xl">Listings</h1>
          <p className="mt-1 max-w-xl text-sm text-stone-600">Each listing gets a private live page for the seller: launch steps, showings, feedback and weekly numbers.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-[#0A0A0A] px-5 py-2.5 text-sm font-semibold text-white"><Plus className="size-4" /> New listing</button>
      </div>

      {staff && (
        <div className="mt-4 inline-flex rounded-full bg-stone-100 p-1 text-sm">
          {(["all", "mine"] as const).map(s => (
            <button key={s} onClick={() => setScope(s)} className={`rounded-full px-4 py-1.5 ${scope === s ? "bg-white font-semibold shadow-sm" : "text-stone-600"}`}>{s === "all" ? "Whole team" : "Mine"}</button>
          ))}
        </div>
      )}

      {data === undefined ? (
        <div className="mt-6 h-24 animate-pulse rounded-2xl bg-stone-100" />
      ) : data.rows.length === 0 ? (
        <div className="mt-8 rounded-3xl border-2 border-dashed border-stone-200 p-10 text-center">
          <Building2 className="mx-auto size-10 text-[#9C7434]" />
          <h3 className="mt-3 font-display text-xl">No listings yet</h3>
          <p className="mt-1 text-sm text-stone-600">Create one the day you sign the listing agreement so the seller can follow the launch from day one.</p>
          <button onClick={() => setOpen(true)} className="mt-4 rounded-full bg-[#9C7434] px-5 py-2.5 text-sm font-semibold text-white">Create the first listing</button>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {data.rows.map(l => (
            <Link key={l._id} to={`/listings/${l._id}`} className="group flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/5 transition hover:shadow-md">
              <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-[#0A0A0A]">
                {l.photoUrl ? <img src={l.photoUrl} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center"><Building2 className="size-7 text-[#D9BC8C]" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate font-semibold">{l.address.split(",")[0]}</div>
                  <StatusChip s={l.status} />
                </div>
                <div className="truncate text-xs text-stone-500">{l.sellerName} · {l.agentName}</div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100"><div className="h-full bg-[#9C7434]" style={{ width: `${(l.stepsDone / l.stepsTotal) * 100}%` }} /></div>
                  <span className="text-[11px] text-stone-500">{l.stepsDone}/{l.stepsTotal}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  {l.pending > 0 && <span className="flex items-center gap-1 rounded-full bg-[#9C7434] px-2 py-0.5 font-semibold text-white"><MessageSquareWarning className="size-3" /> {l.pending} to review</span>}
                  {l.adsRunning > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">{l.adsRunning} ad{l.adsRunning === 1 ? "" : "s"} running</span>}
                  {(l.status === "Active" || l.status === "Coming soon") && !l.numbersThisWeek && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Numbers due</span>}
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">{l.showings} showings</span>
                  {l.sellerLastSeenAt && <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-stone-600"><Eye className="size-3" /> seller {ago(l.sellerLastSeenAt)}</span>}
                </div>
              </div>
              <ChevronRight className="mt-7 size-4 shrink-0 text-stone-300 group-hover:text-[#9C7434]" />
            </Link>
          ))}
        </div>
      )}

      {staff && <Unmatched />}
      {open && <NewListing staff={staff} onClose={() => setOpen(false)} />}
    </div>
  );
}
