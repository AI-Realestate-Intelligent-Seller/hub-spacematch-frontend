import { BadgeCheck, Contact, EyeOff, Globe, Loader2, Lock, Mail, MessageSquare, Pencil, Phone, Plus, Search, SearchX, Star, Store, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, FieldError, LoadError, errorBorder } from "@/components/hub/FormState";
import { apiErrorMessage, fieldErrors, useApiData } from "@/lib/apiData";
import { check, fieldRules, orNull, typeEmail, typePhone } from "@/lib/formRules";
import { smsHref, telHref } from "@/lib/hub";
import { type Vendor, vendorsApi } from "@/lib/vendorsApi";
import { z } from "zod";

export const CATEGORIES = [
  "Lenders", "Attorneys", "Title & closing", "Inspectors", "Contractors", "Maintenance & handyman",
  "Listing prep & media", "Movers & storage", "Property management", "Insurance", "Marketing & print", "Team support", "Other",
];

const SUBS: Record<string, string[]> = {
  Lenders: ["Conventional / FHA / VA", "First-time buyer programs", "Jumbo", "Non-QM / bank statement", "Commercial / SBA", "Hard money / bridge", "DSCR / investor"],
  Attorneys: ["Residential closing", "Commercial", "Landlord-tenant / eviction", "Estate / probate"],
  Inspectors: ["Home", "Radon", "Sewer scope", "Mold", "Termite", "Roof", "Commercial"],
  Contractors: ["General", "Plumbing", "Electrical", "Roofing", "HVAC", "Painting", "Flooring", "Kitchen & bath"],
};

function useVendors() { return useApiData("vendors:list", () => vendorsApi.list(), { pollMs: 120_000 }); }

const empty = { name: "", company: "", category: "Lenders", subcategory: "", description: "", phone: "", email: "", website: "", address: "", areas: "", languages: "", perk: "", private: false };
type Draft = typeof empty;
const inputCls = "mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[15px] font-normal outline-none focus:border-[#9C7434] focus:ring-2 focus:ring-[#9C7434]/20";

/** Same rules as the backend (backend/src/modules/vendors/vendor.validation.ts). */
const vendorSchema = z
  .object({
    name: z.string().trim().min(1, "Add the contact name.").min(2, "Name is too short.").max(120, "Name is too long (120 characters max).").refine(v => /\p{L}/u.test(v), "Name needs letters."),
    company: fieldRules.text(120, "Company"),
    category: z.enum(CATEGORIES as [string, ...string[]], { error: "Pick a category." }),
    subcategory: fieldRules.text(80, "Type"),
    description: fieldRules.text(2000, "Description"),
    phone: fieldRules.phone,
    email: fieldRules.email,
    website: fieldRules.website,
    address: fieldRules.text(200, "Address"),
    areas: fieldRules.text(200, "Areas served"),
    languages: fieldRules.text(200, "Languages"),
    perk: fieldRules.text(200, "Team perk"),
    private: z.boolean(),
  })
  .refine(v => !!(v.phone.trim() || v.email.trim() || v.website.trim()), { message: "Add a phone, email or website so agents can reach them.", path: ["phone"] });

function VendorForm({ initial, id, onClose }: { initial: Draft; id?: string; onClose: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // Fields the person has typed in. Leaving an untouched field shows no error (otherwise the
  // message pushes the button down mid-click and the first click misses).
  const [edited, setEdited] = useState<Partial<Record<keyof Draft, boolean>>>({});
  const filters: Partial<Record<keyof Draft, (v: string) => string>> = { phone: typePhone, email: typeEmail, website: v => v.trim() };
  const update = (next: Draft, k: keyof Draft) => {
    setD(next);
    setEdited(x => (x[k] ? x : { ...x, [k]: true }));
    // Re-check a field that already shows an error as the person fixes it.
    if (errors[k] || (k === "email" || k === "website" ? errors.phone : false)) {
      const e = check(vendorSchema, next);
      setErrors(err => ({ ...err, [k]: e[k] ?? "", phone: e.phone ?? "" }));
    }
  };
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    update({ ...d, [k]: (filters[k] ?? (v => v))(e.target.value), ...(k === "category" ? { subcategory: "" } : {}) }, k);
  const blur = (k: keyof Draft) => () => {
    if (edited[k]) setErrors(err => ({ ...err, [k]: check(vendorSchema, d)[k] ?? "" }));
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = check(vendorSchema, d);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const body = {
        name: d.name.trim(), company: orNull(d.company), category: d.category, subcategory: orNull(d.subcategory), description: orNull(d.description),
        phone: orNull(d.phone), email: orNull(d.email), website: orNull(d.website), address: orNull(d.address), areas: orNull(d.areas),
        languages: orNull(d.languages), perk: orNull(d.perk), private: d.private,
      };
      if (id) await vendorsApi.update(id, body); else await vendorsApi.add(body);
      toast.success(id ? "Saved" : d.private ? "Vendor added. Only you can see it." : "Vendor added. The whole team can see it now.");
      onClose();
    } catch (x) {
      setErrors(fieldErrors(x));
      toast.error(apiErrorMessage(x));
    } finally { setBusy(false); }
  };
  const field = (k: keyof Draft, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, wide = false) => (
    <label className={wide ? "col-span-2" : ""}>{label}
      <input value={d[k] as string} onChange={set(k)} onBlur={blur(k)} aria-invalid={!!errors[k]} className={`${inputCls} ${errorBorder(errors[k])}`} {...extra} />
      <FieldError msg={errors[k]} />
    </label>
  );
  return (
    <Dialog open onOpenChange={o => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg max-h-[90svh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-['Playfair_Display'] text-xl">{id ? "Edit vendor" : "Add a vendor"}</DialogTitle></DialogHeader>
        <form onSubmit={save} noValidate className="grid grid-cols-2 gap-3 text-sm font-medium" data-testid="vendor-form">
          {field("name", "Contact name *", { maxLength: 120, autoComplete: "off" }, true)}
          {field("company", "Company", { maxLength: 120 }, true)}
          <label>Category *<select value={d.category} onChange={set("category")} className={inputCls}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select><FieldError msg={errors.category} /></label>
          <label>Type{SUBS[d.category] ? (
            <select value={d.subcategory} onChange={set("subcategory")} className={inputCls}><option value="">—</option>{SUBS[d.category].map(c => <option key={c}>{c}</option>)}</select>
          ) : <input value={d.subcategory} onChange={set("subcategory")} onBlur={blur("subcategory")} maxLength={80} className={`${inputCls} ${errorBorder(errors.subcategory)}`} placeholder="e.g. Staging" />}<FieldError msg={errors.subcategory} /></label>
          {field("phone", "Phone", { inputMode: "tel", type: "tel", placeholder: "(312) 555-0100" })}
          {field("email", "Email", { type: "email", maxLength: 200 })}
          {field("website", "Website", { placeholder: "acme.com", maxLength: 300, inputMode: "url" }, true)}
          <p className="col-span-2 -mt-1 text-xs font-normal text-stone-500">Add at least one: phone, email or website.</p>
          <label className="col-span-2">What they do / why you recommend them
            <textarea value={d.description} onChange={set("description")} onBlur={blur("description")} maxLength={2000} className={`${inputCls} min-h-[70px] ${errorBorder(errors.description)}`} />
            <span className="mt-0.5 block text-right text-[11px] font-normal text-stone-400">{d.description.length}/2000</span>
            <FieldError msg={errors.description} />
          </label>
          {field("areas", "Areas served", { placeholder: "Chicago, North Shore", maxLength: 200 })}
          {field("languages", "Languages", { placeholder: "English, Spanish", maxLength: 200 })}
          {field("perk", "Team perk / discount", { placeholder: "e.g. 10% off for SpaceMatch clients", maxLength: 200 }, true)}
          <label className="col-span-2 flex items-center gap-2 font-normal"><input type="checkbox" checked={d.private} onChange={e => setD({ ...d, private: e.target.checked })} className="size-4 accent-[#9C7434]" /> Keep private (only I can see it)</label>
          <button disabled={busy} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] py-3 font-semibold text-white disabled:opacity-60">
            {busy && <Loader2 className="size-4 animate-spin" />}{busy ? "Saving…" : id ? "Save" : "Add vendor"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function vcard(v: Vendor) {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${v.name}`, v.company ? `ORG:${v.company}` : "", v.phone ? `TEL;TYPE=CELL:${v.phone}` : "", v.email ? `EMAIL:${v.email}` : "", v.website ? `URL:${v.website}` : "", `NOTE:${[v.category, v.subcategory, v.description].filter(Boolean).join(" · ")} (via SpaceMatch)`, "END:VCARD"].filter(Boolean);
  const blob = new Blob([lines.join("\r\n")], { type: "text/vcard" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${v.name.replace(/[^\w]+/g, "_")}.vcf`;
  a.click();
}

function VendorCard({ v, isAdmin, myEmail, onEdit, highlight }: { v: Vendor; isAdmin: boolean; myEmail: string; onEdit: () => void; highlight: boolean }) {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); } catch (e) { toast.error(apiErrorMessage(e)); } finally { setBusy(false); }
  };
  const moderate = ({ id, remove, ...patch }: { id: string; preferred?: boolean; hidden?: boolean; onWebsite?: boolean; remove?: boolean }) =>
    run(() => (remove ? vendorsApi.remove(id) : vendorsApi.moderate(id, patch)), remove ? "Vendor removed" : "Saved");
  const share = `${v.name}${v.company ? ` (${v.company})` : ""} — ${v.category}${v.phone ? `, ${v.phone}` : ""}${v.email ? `, ${v.email}` : ""}. Recommended by SpaceMatch.`;
  const own = v.addedByEmail === myEmail;
  return (
    <div id={v._id} className={`rounded-2xl bg-white p-4 ring-1 ${highlight ? "ring-2 ring-[#9C7434]" : "ring-[#ebe5da]"} ${v.hidden ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-lg font-bold text-[#1F1E1B]">{v.company || v.name}</span>
            {v.preferred && <span className="inline-flex items-center gap-0.5 rounded-full bg-[#9C7434] px-2 py-0.5 text-xs font-bold text-white"><BadgeCheck className="size-3.5" />Preferred</span>}
            {v.private && <Lock className="size-3.5 text-stone-400" />}
          </div>
          {v.company && <div className="text-sm text-stone-600">{v.name}</div>}
          <div className="text-sm text-[#2B2A27] font-semibold mt-0.5">{v.category}{v.subcategory ? ` · ${v.subcategory}` : ""}</div>
        </div>
        {v.rating != null && <div className="flex items-center gap-0.5 text-sm font-semibold"><Star className="size-4 fill-[#9C7434] text-[#9C7434]" />{v.rating.toFixed(1)}<span className="text-xs text-stone-400 font-normal">({v.ratingCount})</span></div>}
      </div>
      {v.description && <p className="mt-2 text-[15px] text-[#3A3833] leading-relaxed">{v.description}</p>}
      {(v.phone || v.email) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
          {v.phone && <a href={telHref(v.phone)} className="inline-flex items-center gap-1.5 font-semibold text-[#1F1E1B] hover:text-[#9C7434]" data-testid="vendor-phone"><Phone className="size-4 text-[#9C7434]" />{v.phone}</a>}
          {v.email && <a href={`mailto:${v.email}`} className="inline-flex min-w-0 items-center gap-1.5 text-[#3A3833] hover:text-[#9C7434]"><Mail className="size-4 shrink-0 text-[#9C7434]" /><span className="truncate">{v.email}</span></a>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
        {v.areas && <span>📍 {v.areas}</span>}
        {v.languages && <span>🗣 {v.languages}</span>}
        {v.perk && <span className="text-emerald-700 font-medium">★ {v.perk}</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {v.phone && <a href={telHref(v.phone)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#F7F5F1] px-3.5 py-2.5 text-sm font-semibold text-[#2B2A27] ring-1 ring-[#E6E1D8]"><Phone className="size-4" />Call</a>}
        {v.phone && <a href={smsHref(v.phone)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#F7F5F1] px-3.5 py-2.5 text-sm font-semibold text-[#2B2A27] ring-1 ring-[#E6E1D8]"><MessageSquare className="size-4" />Text</a>}
        {v.email && <a href={`mailto:${v.email}`} className="inline-flex items-center gap-1.5 rounded-xl bg-[#F7F5F1] px-3.5 py-2.5 text-sm font-semibold text-[#2B2A27] ring-1 ring-[#E6E1D8]"><Mail className="size-4" />Email</a>}
        {v.website && <a href={v.website.startsWith("http") ? v.website : `https://${v.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-[#F7F5F1] px-3.5 py-2.5 text-sm font-semibold text-[#2B2A27] ring-1 ring-[#E6E1D8]"><Globe className="size-4" />Website</a>}
        <button type="button" onClick={() => vcard(v)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#F7F5F1] px-3.5 py-2.5 text-sm font-semibold text-[#2B2A27] ring-1 ring-[#E6E1D8]" title="Save contact card"><Contact className="size-4" />Save contact</button>
        <a href={`sms:?&body=${encodeURIComponent(share)}`} className="inline-flex items-center gap-1.5 rounded-xl bg-[#9C7434] px-3.5 py-2.5 text-sm font-semibold text-white">Send to client</a>
        <div className="ml-auto flex items-center gap-1 pt-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" disabled={busy} onClick={() => run(() => vendorsApi.rate(v._id, n), "Thanks for rating")} aria-label={`Rate ${n}`} aria-pressed={(v.myRating ?? 0) >= n} className="disabled:opacity-50">
              <Star className={`size-5 ${(v.myRating ?? 0) >= n ? "fill-[#D9BC8C] text-[#D9BC8C]" : "text-stone-300"}`} />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-stone-400">
        <span>Added by {v.addedByName}</span>
        {(own || isAdmin) && <button type="button" onClick={onEdit} className="ml-auto inline-flex items-center gap-0.5 hover:text-stone-700"><Pencil className="size-3" />Edit</button>}
        {busy && <Loader2 className="size-3 animate-spin" />}
        {isAdmin && <button type="button" disabled={busy} onClick={() => moderate({ id: v._id, preferred: !v.preferred })} className="inline-flex items-center gap-0.5 hover:text-stone-700"><BadgeCheck className="size-3" />{v.preferred ? "Unprefer" : "Preferred"}</button>}
        {isAdmin && !v.private && <button type="button" disabled={busy} onClick={() => moderate({ id: v._id, onWebsite: v.onWebsite === false })} className="inline-flex items-center gap-0.5 hover:text-stone-700" title="Show on spacematchinc.com Trusted Local Pros"><Globe className="size-3" />{v.onWebsite === false ? "Add to website" : "On website ✓"}</button>}
        {isAdmin && <button type="button" disabled={busy} onClick={() => moderate({ id: v._id, hidden: !v.hidden })} className="inline-flex items-center gap-0.5 hover:text-stone-700"><EyeOff className="size-3" />{v.hidden ? "Show" : "Hide"}</button>}
        {(own || isAdmin) && <button type="button" disabled={busy} aria-label={`Remove ${v.name}`} onClick={() => confirm(`Remove ${v.name}?`) && moderate({ id: v._id, remove: true })} className="inline-flex items-center gap-0.5 hover:text-red-600"><Trash2 className="size-3" /></button>}
      </div>
    </div>
  );
}

export function ResourcesPage() {
  const { data, error, reload } = useVendors();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id?: string; d: Draft } | null>(null);
  const cat = params.get("cat") ?? "All";
  const focus = params.get("v");
  const vendors = data?.items ?? [];

  useEffect(() => { if (focus) setTimeout(() => document.getElementById(focus)?.scrollIntoView({ behavior: "smooth", block: "center" }), 300); }, [focus, data]);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return vendors
      .filter(v => cat === "All" || v.category === cat || (cat === "Contractors" && v.category === "Maintenance & handyman"))
      .filter(v => { const hay = [v.name, v.company, v.category, v.subcategory, v.description, v.areas, v.languages].join(" ").toLowerCase(); return words.every(w => hay.includes(w)); })
      .sort((a, b) => Number(b.preferred) - Number(a.preferred) || (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name));
  }, [vendors, q, cat]);

  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map(c => [c, vendors.filter(v => v.category === c).length])), [vendors]);

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <h1 className="font-['Playfair_Display'] text-3xl font-bold text-[#0A0A0A]">Vendors & resources</h1>
          <p className="text-stone-500 mt-1">Lenders, attorneys, inspectors, contractors and more — recommended by the team.</p>
        </div>
        <button type="button" onClick={() => setEditing({ d: { ...empty, category: cat !== "All" ? cat : "Lenders" } })} className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#9C7434] px-4 py-2.5 text-sm font-semibold text-white">
          <Plus className="size-4" />Add vendor
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-stone-200">
        <Search className="size-4 text-stone-400" />
        <input value={q} onChange={e => setQ(e.target.value.slice(0, 100))} placeholder="Search name, type, area, language…" aria-label="Search vendors" className="w-full bg-transparent outline-none" />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {["All", ...CATEGORIES].map(c => (
          <button key={c} type="button" onClick={() => setParams(c === "All" ? {} : { cat: c })} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ring-1 ${cat === c ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white text-stone-600 ring-stone-200"}`}>
            {c}{c !== "All" && counts[c] ? <span className="opacity-60"> {counts[c]}</span> : null}
          </button>
        ))}
      </div>
      {data === undefined && !error ? (
        <div role="status" aria-label="Loading vendors" aria-busy="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da]" aria-hidden="true">
              <Skeleton className="h-6 w-2/3 bg-stone-200" />
              <Skeleton className="h-4 w-1/2 bg-stone-200" />
              <Skeleton className="h-4 w-full bg-stone-200" />
              <Skeleton className="h-4 w-4/5 bg-stone-200" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-10 w-16 rounded-xl bg-stone-200" />
                <Skeleton className="h-10 w-16 rounded-xl bg-stone-200" />
              </div>
            </div>
          ))}
        </div>
      ) : data === undefined ? (
        <LoadError error={error} onRetry={() => void reload()} what="vendors" />
      ) : vendors.length === 0 ? (
        <EmptyState icon={<Store className="size-8" />} title="No vendors yet"
          action={<button type="button" onClick={() => setEditing({ d: { ...empty } })} className="inline-flex items-center gap-1.5 rounded-xl bg-[#9C7434] px-4 py-2.5 text-sm font-semibold text-white"><Plus className="size-4" />Add the first vendor</button>}>
          Add the lenders, inspectors and contractors you trust. The whole team sees them unless you keep one private.
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState icon={<SearchX className="size-8" />} title={q ? `No vendors match “${q}”` : `No ${cat} yet`}
          action={<div className="flex justify-center gap-2">
            {(q || cat !== "All") && <button type="button" onClick={() => { setQ(""); setParams({}); }} className="rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 ring-stone-300">Show all vendors</button>}
            <button type="button" onClick={() => setEditing({ d: { ...empty, category: cat !== "All" ? cat : "Lenders" } })} className="inline-flex items-center gap-1.5 rounded-xl bg-[#9C7434] px-4 py-2.5 text-sm font-semibold text-white"><Plus className="size-4" />Add vendor</button>
          </div>}>
          {q ? "Try another word, or check the spelling." : "Be the first to add one in this category."}
        </EmptyState>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map(v => (
            <VendorCard key={v._id} v={v} isAdmin={!!data?.viewer.isAdmin} myEmail={data?.viewer.email ?? ""} highlight={focus === v._id}
              onEdit={() => setEditing({ id: v._id, d: { ...empty, ...Object.fromEntries(Object.entries(v).filter(([k]) => k in empty).map(([k, val]) => [k, val ?? ""])) } as Draft })} />
          ))}
        </div>
      )}
      <p className="text-xs text-stone-500 leading-relaxed">
        Always give clients at least two or three options and let them choose — RESPA prohibits paying or receiving referral fees or kickbacks for settlement-service referrals (lenders, title, inspectors). "Preferred" means team-recommended, not a paid relationship.
      </p>
      {editing && <VendorForm initial={editing.d} id={editing.id} onClose={() => setEditing(null)} />}
    </div>
  );
}
