import { AlertCircle, Building2, ChevronRight, Eye, MessageSquareWarning, Plus, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { check, digitsOnly, newListingSchema, orNull, priceToCents, typeName, typePhone, typePrice } from "@/lib/listingForms";
import { apiErrorMessage, fieldErrors, listingsApi, useListingsData } from "@/lib/listingsApi";

export const inputCls = "w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-[16px] outline-none focus:border-[#9C7434] focus:ring-2 focus:ring-[#9C7434]/20";
export const errMsg = apiErrorMessage;
const errCls = "border-red-400! focus:border-red-500! focus:ring-red-500/20!";

/** Red message under a field. */
export const FieldError = ({ msg }: { msg?: string }) => (msg ? <span role="alert" className="mt-1 block text-xs font-normal text-red-600">{msg}</span> : null);
/** Input classes, red when the field has an error. */
export const fieldCls = (err?: string, extra = "") => `${inputCls} ${err ? errCls : ""} ${extra}`;
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
  const nav = useNavigate();
  const agents = useListingsData(staff ? "listings:agents" : null, () => listingsApi.agents());
  const [f, setF] = useState({ address: "", mlsNumber: "", price: "", sellerName: "", sellerEmail: "", sellerPhone: "", agentUserId: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const live = (next: typeof f) => check(newListingSchema, next);
  const set = (k: keyof typeof f, filter: (v: string) => string = v => v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const next = { ...f, [k]: filter(e.target.value) };
    setF(next);
    // Once a field has been left (or submit tried), re-check it as the person types.
    if (touched[k]) setErrors(err => ({ ...err, [k]: live(next)[k] ?? "" }));
  };
  // Only check a field on leaving it once something was typed (an error appearing above the
  // button mid-click would push it down and the click would miss).
  const blur = (k: keyof typeof f) => () => {
    if (!f[k]) return;
    setTouched(t => ({ ...t, [k]: true }));
    setErrors(err => ({ ...err, [k]: live(f)[k] ?? "" }));
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = live(f);
    setErrors(errs);
    setTouched(Object.fromEntries(Object.keys(f).map(k => [k, true])));
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const l = await listingsApi.create({
        address: f.address.trim(),
        mlsNumber: orNull(f.mlsNumber),
        priceCents: priceToCents(f.price),
        sellerName: f.sellerName.trim(),
        sellerEmail: orNull(f.sellerEmail),
        sellerPhone: orNull(f.sellerPhone),
        agentUserId: f.agentUserId || null,
      });
      toast.success("Listing created. Share the seller link next.");
      nav(`/listings/${l._id}`);
    } catch (err) {
      const fe = fieldErrors(err);
      if (fe.priceCents) fe.price = fe.priceCents;
      setErrors(fe);
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <form onSubmit={submit} noValidate onClick={e => e.stopPropagation()} className="max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[#F7F5F1] p-5 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl">New listing</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X className="size-5" /></button>
        </div>
        <p className="mb-4 text-sm text-stone-600">One minute. This builds your seller's live launch page.</p>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Property address *<input className={fieldCls(errors.address)} value={f.address} onChange={set("address")} onBlur={blur("address")} maxLength={200} placeholder="1234 N Main St, Chicago, IL 60614" aria-invalid={!!errors.address} autoComplete="street-address" /><FieldError msg={errors.address} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">MLS #<input className={fieldCls(errors.mlsNumber)} value={f.mlsNumber} onChange={set("mlsNumber", v => digitsOnly(v, 10))} onBlur={blur("mlsNumber")} inputMode="numeric" placeholder="If you have it" aria-invalid={!!errors.mlsNumber} /><FieldError msg={errors.mlsNumber} /></label>
            <label className="block text-sm font-medium">List price<input className={fieldCls(errors.price)} value={f.price} onChange={set("price", typePrice)} onBlur={blur("price")} inputMode="numeric" placeholder="$549,000" aria-invalid={!!errors.price} /><FieldError msg={errors.price} /></label>
          </div>
          <label className="block text-sm font-medium">Seller name *<input className={fieldCls(errors.sellerName)} value={f.sellerName} onChange={set("sellerName", typeName)} onBlur={blur("sellerName")} maxLength={120} aria-invalid={!!errors.sellerName} autoComplete="off" /><FieldError msg={errors.sellerName} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">Seller mobile<input className={fieldCls(errors.sellerPhone)} value={f.sellerPhone} onChange={set("sellerPhone", typePhone)} onBlur={blur("sellerPhone")} type="tel" inputMode="tel" placeholder="(312) 555-0100" aria-invalid={!!errors.sellerPhone} /><FieldError msg={errors.sellerPhone} /></label>
            <label className="block text-sm font-medium">Seller email<input className={fieldCls(errors.sellerEmail)} value={f.sellerEmail} onChange={set("sellerEmail", v => v.replace(/\s/g, ""))} onBlur={blur("sellerEmail")} type="email" maxLength={200} aria-invalid={!!errors.sellerEmail} /><FieldError msg={errors.sellerEmail} /></label>
          </div>
          {staff && (
            <label className="block text-sm font-medium">Listing agent
              <select className={fieldCls(errors.agentUserId)} value={f.agentUserId} onChange={set("agentUserId")}>
                <option value="">Me</option>
                {agents.data?.items.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
              <FieldError msg={errors.agentUserId} />
            </label>
          )}
        </div>
        <button disabled={busy} className="mt-5 w-full rounded-xl bg-[#0A0A0A] py-3 font-semibold text-white disabled:opacity-60">{busy ? "Creating…" : "Create listing"}</button>
      </form>
    </div>
  );
}

function Unmatched() {
  const inbox = useListingsData("listings:inbox", () => listingsApi.showingInbox(), { pollMs: 60_000 });
  const data = useListingsData("listings:list:all", () => listingsApi.list("all"));
  const rows = inbox.data?.items;
  if (!rows?.length) return null;
  return (
    <section className="mt-8 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <h3 className="flex items-center gap-2 font-semibold"><AlertCircle className="size-4 text-amber-700" /> ShowingTime emails that matched no listing</h3>
      <p className="mt-1 text-sm text-stone-600">Usually the listing isn't in the Hub yet, or its MLS # is missing. Pick the listing to file it.</p>
      <ul className="mt-3 space-y-2">
        {rows.map(r => (
          <li key={r._id} className="flex flex-col gap-2 rounded-xl bg-white p-3 text-sm sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1"><div className="truncate font-medium">{r.subject}</div><div className="text-xs text-stone-500">MLS {r.mls ?? "–"} · {ago(r.createdAt)}</div></div>
            <select className="rounded-lg border border-stone-200 px-2 py-1.5" defaultValue="" onChange={e => e.target.value && listingsApi.assignInbox(r._id, e.target.value).then(() => toast.success("Filed")).catch(err => toast.error(errMsg(err)))}>
              <option value="">File under…</option>
              {data.data?.items.map(l => <option key={l._id} value={l._id}>{l.address}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Placeholder cards (same layout as the real ones) while listings load. */
function ListingCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2" role="status" aria-busy="true" aria-label="Loading listings" data-testid="listings-skeleton">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex animate-pulse gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/5">
          <div className="size-20 shrink-0 rounded-xl bg-stone-200" />
          <div className="min-w-0 flex-1 space-y-2.5 py-1">
            <div className="flex items-start justify-between gap-2">
              <div className="h-4 w-2/5 rounded bg-stone-200" />
              <div className="h-5 w-16 rounded-full bg-stone-200" />
            </div>
            <div className="h-3 w-1/3 rounded bg-stone-200" />
            <div className="h-1.5 w-full rounded-full bg-stone-100" />
            <div className="flex gap-1.5">
              <div className="h-4 w-20 rounded-full bg-stone-100" />
              <div className="h-4 w-24 rounded-full bg-stone-100" />
            </div>
          </div>
        </div>
      ))}
      <span className="sr-only">Loading listings…</span>
    </div>
  );
}

export function ListingsPage() {
  const [scope, setScope] = useState<"mine" | "all">("all");
  const { data, error, reload } = useListingsData(`listings:list:${scope}`, () => listingsApi.list(scope), { pollMs: 60_000 });
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

      {data === undefined && error ? (
        <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
          Couldn't load your listings. {errMsg(error)} <button type="button" onClick={() => void reload()} className="ml-1 font-semibold underline">Try again</button>
        </div>
      ) : data === undefined ? (
        <ListingCardsSkeleton />
      ) : data.items.length === 0 ? (
        <div className="mt-8 rounded-3xl border-2 border-dashed border-stone-200 p-10 text-center">
          <Building2 className="mx-auto size-10 text-[#9C7434]" />
          <h3 className="mt-3 font-display text-xl">No listings yet</h3>
          <p className="mt-1 text-sm text-stone-600">Create one the day you sign the listing agreement so the seller can follow the launch from day one.</p>
          <button onClick={() => setOpen(true)} className="mt-4 rounded-full bg-[#9C7434] px-5 py-2.5 text-sm font-semibold text-white">Create the first listing</button>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {data.items.map(l => (
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
