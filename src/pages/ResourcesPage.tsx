import { useMutation, useQuery } from "convex/react";
import { BadgeCheck, Contact, EyeOff, Globe, Lock, Mail, MessageSquare, Pencil, Phone, Plus, Search, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { smsHref, telHref } from "@/lib/hub";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

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

type Vendor = NonNullable<ReturnType<typeof useVendors>>["vendors"][number];
function useVendors() { return useQuery(api.vendors.list); }

const empty = { name: "", company: "", category: "Lenders", subcategory: "", description: "", phone: "", email: "", website: "", address: "", areas: "", languages: "", perk: "", private: false };
type Draft = typeof empty;
const inputCls = "mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[15px]";

function VendorForm({ initial, id, onClose }: { initial: Draft; id?: Id<"vendors">; onClose: () => void }) {
  const add = useMutation(api.vendors.add);
  const update = useMutation(api.vendors.update);
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...d, subcategory: d.subcategory || undefined };
      if (id) await update({ id, ...body }); else await add(body);
      toast.success(id ? "Saved" : "Vendor added — the whole team can see it now");
      onClose();
    } catch (x) {
      toast.error(String((x as Error).message).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? "Could not save");
    } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90svh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-['Playfair_Display'] text-xl">{id ? "Edit vendor" : "Add a vendor"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid grid-cols-2 gap-3 text-sm font-medium">
          <label className="col-span-2">Contact name *<input required value={d.name} onChange={set("name")} className={inputCls} /></label>
          <label className="col-span-2">Company<input value={d.company} onChange={set("company")} className={inputCls} /></label>
          <label>Category<select value={d.category} onChange={set("category")} className={inputCls}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
          <label>Type{SUBS[d.category] ? (
            <select value={d.subcategory} onChange={set("subcategory")} className={inputCls}><option value="">—</option>{SUBS[d.category].map(c => <option key={c}>{c}</option>)}</select>
          ) : <input value={d.subcategory} onChange={set("subcategory")} className={inputCls} placeholder="e.g. Staging" />}</label>
          <label>Phone<input value={d.phone} onChange={set("phone")} inputMode="tel" className={inputCls} /></label>
          <label>Email<input value={d.email} onChange={set("email")} type="email" className={inputCls} /></label>
          <label className="col-span-2">Website<input value={d.website} onChange={set("website")} className={inputCls} placeholder="https://" /></label>
          <label className="col-span-2">What they do / why you recommend them<textarea value={d.description} onChange={set("description")} className={`${inputCls} min-h-[70px]`} /></label>
          <label>Areas served<input value={d.areas} onChange={set("areas")} className={inputCls} placeholder="Chicago, North Shore" /></label>
          <label>Languages<input value={d.languages} onChange={set("languages")} className={inputCls} placeholder="English, Spanish" /></label>
          <label className="col-span-2">Team perk / discount<input value={d.perk} onChange={set("perk")} className={inputCls} placeholder="e.g. 10% off for SpaceMatch clients" /></label>
          <label className="col-span-2 flex items-center gap-2 font-normal"><input type="checkbox" checked={d.private} onChange={e => setD({ ...d, private: e.target.checked })} /> Keep private (only I can see it)</label>
          <button disabled={busy} className="col-span-2 rounded-xl bg-[#0A0A0A] py-3 font-semibold text-white disabled:opacity-60">{id ? "Save" : "Add vendor"}</button>
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
  const moderate = useMutation(api.vendors.moderate);
  const rate = useMutation(api.vendors.rate);
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
        {v.rating !== null && <div className="flex items-center gap-0.5 text-sm font-semibold"><Star className="size-4 fill-[#9C7434] text-[#9C7434]" />{v.rating.toFixed(1)}<span className="text-xs text-stone-400 font-normal">({v.ratingCount})</span></div>}
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
            <button key={n} type="button" onClick={() => rate({ id: v._id, rating: n }).then(() => toast.success("Thanks for rating"))} aria-label={`Rate ${n}`}>
              <Star className={`size-5 ${(v.myRating ?? 0) >= n ? "fill-[#D9BC8C] text-[#D9BC8C]" : "text-stone-300"}`} />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-stone-400">
        <span>Added by {v.addedByName}</span>
        {(own || isAdmin) && <button type="button" onClick={onEdit} className="ml-auto inline-flex items-center gap-0.5 hover:text-stone-700"><Pencil className="size-3" />Edit</button>}
        {isAdmin && <button type="button" onClick={() => moderate({ id: v._id, preferred: !v.preferred })} className="inline-flex items-center gap-0.5 hover:text-stone-700"><BadgeCheck className="size-3" />{v.preferred ? "Unprefer" : "Preferred"}</button>}
        {isAdmin && !v.private && <button type="button" onClick={() => moderate({ id: v._id, onWebsite: v.onWebsite === false })} className="inline-flex items-center gap-0.5 hover:text-stone-700" title="Show on spacematchinc.com Trusted Local Pros"><Globe className="size-3" />{v.onWebsite === false ? "Add to website" : "On website ✓"}</button>}
        {isAdmin && <button type="button" onClick={() => moderate({ id: v._id, hidden: !v.hidden })} className="inline-flex items-center gap-0.5 hover:text-stone-700"><EyeOff className="size-3" />{v.hidden ? "Show" : "Hide"}</button>}
        {(own || isAdmin) && <button type="button" onClick={() => confirm(`Remove ${v.name}?`) && moderate({ id: v._id, remove: true })} className="inline-flex items-center gap-0.5 hover:text-red-600"><Trash2 className="size-3" /></button>}
      </div>
    </div>
  );
}

export function ResourcesPage() {
  const data = useVendors();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id?: Id<"vendors">; d: Draft } | null>(null);
  const cat = params.get("cat") ?? "All";
  const focus = params.get("v");
  const vendors = data?.vendors ?? [];

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
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, type, area, language…" className="w-full bg-transparent outline-none" />
      </div>
      <div className="-mx-4 px-4 flex gap-2 overflow-x-auto pb-1">
        {["All", ...CATEGORIES].map(c => (
          <button key={c} type="button" onClick={() => setParams(c === "All" ? {} : { cat: c })} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ring-1 ${cat === c ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white text-stone-600 ring-stone-200"}`}>
            {c}{c !== "All" && counts[c] ? <span className="opacity-60"> {counts[c]}</span> : null}
          </button>
        ))}
      </div>
      {data === undefined ? <div className="text-sm text-stone-500">Loading…</div> : shown.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-sm text-stone-500 ring-1 ring-[#ebe5da]">No vendors here yet. Be the first — tap <b>Add vendor</b>.</div>
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
