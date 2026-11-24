import { useQuery } from "convex/react";
import { ChevronRight, ExternalLink, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { CATALOG, canSee } from "@/lib/catalog";
import { TOOLS, toolHref } from "@/lib/hub";
import { api } from "../../convex/_generated/api";

// /tools — "All tools", grouped (Michael 2026-11-22: "is there a all tools button and tools categorized?").
const norm = (s: string) => s.toLowerCase();

export function ToolsPage() {
  const me = useQuery(api.hubMe.me);
  const [q, setQ] = useState("");
  const words = norm(q).split(/\s+/).filter(Boolean);
  const hit = (text: string) => words.every(w => norm(text).includes(w));

  const groups = useMemo(
    () =>
      CATALOG.map(g => ({
        ...g,
        tools: g.tools.filter(t => canSee(t, me) && hit(`${t.name} ${t.what} ${t.keys ?? ""} ${g.title}`)),
      })).filter(g => g.tools.length > 0),
    [me, q],
  );
  const apps = TOOLS.filter(t => hit(`${t.name} ${t.note} ${t.tags ?? ""} outside apps`));
  const total = groups.reduce((n, g) => n + g.tools.length, 0) + apps.length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-6" data-testid="tools-page">
      <header>
        <h1 className="font-['Playfair_Display'] text-3xl font-semibold text-[#0A0A0A]">All tools</h1>
        <p className="mt-1 text-[17px] text-stone-700">Everything in the Hub, grouped by what it's for.</p>
        <label className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-[#0A0A0A] bg-white px-4 py-3">
          <Search className="size-5 shrink-0 text-stone-600" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder='Filter: try "postcard" or "lender"'
            className="min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-stone-500"
            data-testid="tools-filter"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear filter" className="text-stone-600">
              <X className="size-5" />
            </button>
          )}
        </label>
        {/* Jump links to each group */}
        {!q && (
          <nav className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" aria-label="Tool groups">
            {[...groups.map(g => ({ id: g.id, t: g.title })), { id: "apps", t: "Outside apps" }].map(g => (
              <a key={g.id} href={`#g-${g.id}`} className="shrink-0 rounded-full bg-white px-4 py-2 text-[15px] font-semibold text-[#0A0A0A] ring-1 ring-[#ddd6ca]">
                {g.t}
              </a>
            ))}
          </nav>
        )}
      </header>

      {total === 0 && (
        <div className="rounded-2xl bg-white p-5 text-[17px] text-stone-700 ring-1 ring-[#ebe5da]" data-testid="tools-empty">
          Nothing matches "{q}". Try another word, or{" "}
          <Link to="/help" className="font-semibold text-[#7a5a26] underline">ask for help</Link>.
        </div>
      )}

      {groups.map(g => (
        <section key={g.id} id={`g-${g.id}`} className="scroll-mt-24" data-testid="tools-group">
          <h2 className="text-[20px] font-bold text-[#0A0A0A]">{g.title}</h2>
          <p className="mb-2 text-[16px] text-stone-700">{g.blurb}</p>
          <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe5da]">
            {g.tools.map(t => (
              <Link key={t.to} to={t.to} className="flex min-h-[64px] items-center gap-3 px-4 py-3 hover:bg-[#FBFAF7]" data-testid="tools-item">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#0A0A0A]">
                  <t.icon className="size-5 text-[#D9BC8C]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold leading-tight text-[#0A0A0A]">{t.name}</span>
                  <span className="mt-0.5 block text-[15px] leading-snug text-stone-700">{t.what}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-stone-600" />
              </Link>
            ))}
          </div>
        </section>
      ))}

      {apps.length > 0 && (
        <section id="g-apps" className="scroll-mt-24" data-testid="tools-group">
          <h2 className="text-[20px] font-bold text-[#0A0A0A]">Outside apps</h2>
          <p className="mb-2 text-[16px] text-stone-700">Opens the app or website in a new tab</p>
          <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe5da]">
            {apps.map(t => (
              <a key={t.name} href={toolHref(t)} target="_blank" rel="noreferrer" className="flex min-h-[64px] items-center gap-3 px-4 py-3 hover:bg-[#FBFAF7]">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-black/10">
                  <img src={t.icon} alt="" className="size-7 object-contain" loading="lazy" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold leading-tight text-[#0A0A0A]">{t.name}</span>
                  <span className="mt-0.5 block text-[15px] leading-snug text-stone-700">{t.note}</span>
                </span>
                <ExternalLink className="size-5 shrink-0 text-stone-600" />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
