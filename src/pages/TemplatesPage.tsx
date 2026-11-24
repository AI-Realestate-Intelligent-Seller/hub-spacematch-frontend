import { ArrowRight, BadgeCheck, Building2, Check, Copy, ExternalLink, FileSignature, FolderOpen, Home, Info, KeyRound, ListChecks, Megaphone, MessageSquareText, Presentation, Search, ShieldCheck, Sparkles, Star, Store, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DOCS } from "@/lib/hub";
import { SCRIPTS, TEMPLATES, TEMPLATE_LIBRARY_URL, TEMPLATE_SECTIONS_META, type Script, type Template } from "@/lib/templates";

const ICONS: Record<string, LucideIcon> = { Home, Users, FileSignature, ShieldCheck, KeyRound, Building2, Store, ListChecks, Megaphone, BadgeCheck };
const KIND: Record<Template["kind"], string> = {
  PDF: "bg-red-50 text-red-700 ring-red-100",
  Doc: "bg-sky-50 text-sky-700 ring-sky-100",
  Sheet: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Slides: "bg-amber-50 text-amber-700 ring-amber-100",
};
const FAV_KEY = "hub.templateFavs";
const readFavs = (): string[] => { try { return JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]"); } catch { return []; } };

const linkProps = (h: string) => (h.startsWith("/") ? {} : { target: "_blank", rel: "noreferrer" });

function KindBadge({ k }: { k: Template["kind"] }) {
  return <span className={`inline-flex w-12 shrink-0 justify-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${KIND[k]}`}>{k}</span>;
}

function Row({ t, fav, onFav }: { t: Template; fav: boolean; onFav: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#F7F5F1]">
      <KindBadge k={t.kind} />
      <a href={t.href} {...linkProps(t.href)} className="min-w-0 flex-1" data-testid="template-row">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-semibold text-[15px] leading-snug">{t.title}</span>
          {t.new && <span className="rounded-full bg-[#9C7434] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">New</span>}
        </div>
        <div className="text-xs text-stone-500">{t.note} <span className="text-stone-400">· {t.source}</span></div>
      </a>
      <button type="button" onClick={onFav} aria-label={fav ? "Remove from favorites" : "Add to favorites"} className="rounded-full p-1.5 hover:bg-white">
        <Star className={`size-4 ${fav ? "fill-[#D9BC8C] text-[#9C7434]" : "text-stone-300"}`} />
      </button>
      <a href={t.href} {...linkProps(t.href)} aria-label="Open" className="hidden sm:block"><ExternalLink className="size-4 text-stone-400" /></a>
    </div>
  );
}

function ScriptCard({ s }: { s: Script }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(s.body); setDone(true); toast.success("Copied. Replace the {braces} before sending."); setTimeout(() => setDone(false), 1800); }
    catch { toast.error("Could not copy. Long-press the text to copy."); }
  };
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[15px]">{s.title}</div>
          <div className="text-xs text-stone-500">{s.use}</div>
        </div>
        <button type="button" onClick={copy} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0A0A0A] px-3 py-2 text-xs font-semibold text-white" data-testid="copy-script">
          {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{done ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-3 whitespace-pre-wrap rounded-xl bg-[#F7F5F1] p-3 text-[13.5px] leading-relaxed text-stone-700 select-text">{s.body}</p>
    </div>
  );
}

export function TemplatesPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "scripts" ? "scripts" : "docs";
  const [q, setQ] = useState(() => params.get("q") ?? "");
  const [sec, setSec] = useState<string>(() => params.get("sec") ?? "all");
  const [favs, setFavs] = useState<string[]>(readFavs);
  const toggleFav = (href: string) => {
    const next = favs.includes(href) ? favs.filter(f => f !== href) : [...favs, href];
    setFavs(next); localStorage.setItem(FAV_KEY, JSON.stringify(next));
  };
  const s = q.trim().toLowerCase();
  const list = useMemo(() => TEMPLATES.filter(t => (sec === "all" || t.sectionId === sec) && (!s || `${t.title} ${t.note} ${t.section} ${t.group} ${t.source}`.toLowerCase().includes(s))), [s, sec]);
  const scripts = useMemo(() => SCRIPTS.filter(x => !s || `${x.title} ${x.use} ${x.body} ${x.group}`.toLowerCase().includes(s)), [s]);
  const popular = TEMPLATES.filter(t => t.popular);
  const favList = TEMPLATES.filter(t => favs.includes(t.href));
  const newCount = TEMPLATES.filter(t => t.new && t.source === "SpaceMatch").length; const realCount = TEMPLATES.filter(t => t.source.startsWith("Real Broker")).length;
  const browsing = !s && sec === "all";
  const setTab = (t: string) => { const p = new URLSearchParams(params); if (t === "docs") p.delete("tab"); else p.set("tab", t); setParams(p, { replace: true }); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-['Playfair_Display'] text-3xl">Templates</h1>
          <p className="text-sm text-stone-500">{TEMPLATES.length} forms & documents · {newCount} SpaceMatch originals · {realCount} Real Broker forms · {SCRIPTS.length} scripts & emails</p>
        </div>
        <a href={TEMPLATE_LIBRARY_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold ring-1 ring-[#ebe5da]">
          <FolderOpen className="size-4 text-[#9C7434]" /> Drive folder
        </a>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1 ring-1 ring-[#ebe5da]">
        {[["docs", "Forms & documents", FileSignature], ["scripts", "Scripts & emails", MessageSquareText]].map(([id, label, Icon]) => {
          const I = Icon as LucideIcon;
          return (
            <button key={id as string} type="button" onClick={() => setTab(id as string)} className={`inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold ${tab === id ? "bg-[#0A0A0A] text-white" : "text-stone-600"}`} data-testid={`tab-${id}`}>
              <I className="size-4" />{label as string}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={tab === "docs" ? "Search (e.g. radon, lease, LOI, buyer agreement)" : "Search scripts (e.g. expired, price, review)"} className="w-full rounded-2xl border border-stone-200 bg-white py-3 pl-10 pr-10 text-[15px]" />
        {q && <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Clear"><X className="size-4 text-stone-400" /></button>}
      </div>

      {tab === "scripts" ? (
        <div className="space-y-6">
          <p className="text-sm text-stone-500">Tap Copy, paste into Lofty, text or email, and replace the {"{braces}"}. Always add one personal line.</p>
          {[...new Set(scripts.map(x => x.group))].map(g => (
            <section key={g}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#9C7434]">{g}</h2>
              <div className="grid gap-3 md:grid-cols-2">{scripts.filter(x => x.group === g).map(x => <ScriptCard key={x.id} s={x} />)}</div>
            </section>
          ))}
          {scripts.length === 0 && <p className="text-sm text-stone-500">No scripts match.</p>}
        </div>
      ) : (
        <>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button type="button" onClick={() => setSec("all")} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${sec === "all" ? "bg-[#9C7434] text-white" : "bg-white ring-1 ring-[#ebe5da] text-stone-700"}`}>All</button>
            {TEMPLATE_SECTIONS_META.map(m => {
              const I = ICONS[m.icon] ?? FileSignature;
              const n = TEMPLATES.filter(t => t.sectionId === m.id).length;
              return (
                <button key={m.id} type="button" onClick={() => setSec(m.id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm ${sec === m.id ? "bg-[#9C7434] text-white" : "bg-white ring-1 ring-[#ebe5da] text-stone-700"}`}>
                  <I className="size-3.5" />{m.label}<span className={sec === m.id ? "text-white/70" : "text-stone-400"}>{n}</span>
                </button>
              );
            })}
          </div>

          {browsing && (
            <>
              <div className="flex gap-3 rounded-2xl bg-[#F7F5F1] p-4 ring-1 ring-[#ebe5da]">
                <Info className="mt-0.5 size-5 shrink-0 text-[#9C7434]" />
                <p className="text-sm text-stone-700"><b>Real Broker forms are here now</b>: listing, lease, buyer and tenant agreements, ABA, referral-fee and wire fraud disclosures, from our dotloop library with Real's brokerage info already filled in (search <b>“Real Broker”</b>). For e-signing, start them in dotloop as usual. Dual agency consent is built into the listing and rep agreements (Right to Sell ¶14, Right to Lease ¶15, Buyer/Tenant Rep ¶12). For a standalone form, ask our IL broker, Jani Burke. Open any form, then <b>File → Make a copy</b> or download before filling in.</p>
              </div>

              <Link to="/presentations" className="flex items-center gap-3 rounded-2xl bg-[#0A0A0A] p-4 text-white hover:opacity-95">
                <Presentation className="size-6 text-[#D9BC8C]" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[15px]">Listing decks &amp; client guides</div>
                  <div className="text-xs text-white/70">Pre-listing package, appointment deck, Buyer’s Guide and Seller’s Guide, all branded with your name and photo</div>
                </div>
                <ArrowRight className="size-4 text-white/70" />
              </Link>

              {favList.length > 0 && (
                <section>
                  <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#9C7434]"><Star className="size-3.5 fill-[#D9BC8C]" /> Your favorites</h2>
                  <div className="rounded-2xl bg-white ring-1 ring-[#ebe5da] divide-y divide-stone-100">{favList.map(t => <Row key={t.href} t={t} fav onFav={() => toggleFav(t.href)} />)}</div>
                </section>
              )}

              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#9C7434]"><Sparkles className="size-3.5" /> Most used</h2>
                <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
                  {popular.map(t => (
                    <a key={t.href} href={t.href} {...linkProps(t.href)} className="flex w-56 shrink-0 snap-start flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da] hover:ring-[#9C7434]">
                      <div className="flex items-center justify-between"><KindBadge k={t.kind} />{t.new && <span className="text-[10px] font-bold uppercase text-[#9C7434]">New</span>}</div>
                      <div className="font-semibold text-[14px] leading-snug">{t.title}</div>
                      <div className="mt-auto text-[11px] text-stone-400">{t.section}</div>
                    </a>
                  ))}
                </div>
              </section>
            </>
          )}

          {TEMPLATE_SECTIONS_META.filter(m => list.some(t => t.sectionId === m.id)).map(m => {
            const I = ICONS[m.icon] ?? FileSignature;
            const inSec = list.filter(t => t.sectionId === m.id);
            const groups = [...new Set(inSec.map(t => t.group))];
            return (
              <section key={m.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe5da]" data-testid={`section-${m.id}`}>
                <header className="flex items-center gap-3 border-b border-stone-100 bg-[#0A0A0A] px-4 py-3 text-white">
                  <span className="grid size-9 place-items-center rounded-xl bg-white/10"><I className="size-5 text-[#D9BC8C]" /></span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-['Playfair_Display'] text-lg leading-tight">{m.label}</h2>
                    <p className="text-xs text-white/60">{m.blurb}</p>
                  </div>
                  <span className="text-xs text-white/60">{inSec.length}</span>
                </header>
                {groups.map(g => (
                  <div key={g}>
                    <div className="bg-[#F7F5F1] px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-500">{g}</div>
                    <div className="divide-y divide-stone-100">{inSec.filter(t => t.group === g).map(t => <Row key={t.href} t={t} fav={favs.includes(t.href)} onFav={() => toggleFav(t.href)} />)}</div>
                  </div>
                ))}
              </section>
            );
          })}
          {list.length === 0 && <p className="text-sm text-stone-500">No templates match. Try the Scripts & emails tab.</p>}
        </>
      )}

      {/* Team docs moved here from Home (Michael 2026-10-29 Home simplification) */}
      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe5da]" data-testid="team-docs">
        <h2 className="bg-[#F7F5F1] px-4 py-2 text-sm font-semibold text-stone-700">Team docs</h2>
        <div className="divide-y divide-stone-100">
          {DOCS.filter(x => !x.href.startsWith("/")).map(d => (
            <a key={d.name} href={d.href} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 hover:bg-[#FBFAF7]">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{d.name}</span>
                <span className="block text-xs text-stone-500">{d.note}</span>
              </span>
              <ExternalLink className="size-4 text-stone-400" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
