import { useQuery } from "convex/react";
import {
  ArrowRight,
  BookUser,
  Building2,
  ClipboardList,
  FileBarChart,
  FileText,
  Inbox,
  Search,
  User,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { DOCS, TEAM, TOOLS, toolHref } from "@/lib/hub";
import { PLAYBOOKS } from "@/lib/playbooks";
import { SCRIPTS, TEMPLATES } from "@/lib/templates";
import { api } from "../../../convex/_generated/api";
import { formatAddress } from "../../../convex/address";
import { FORMS } from "../../../convex/formDefs";

type Hit = {
  kind: string;
  title: string;
  sub: string;
  go: () => void;
  score: number;
  icon: React.ComponentType<{ className?: string }>;
};

// Keyword shortcuts — the "ask box" works without AI.
const INTENTS: { re: RegExp; title: string; sub: string; to: string }[] = [
  {
    re: /\b(all tools|every tool|tools? list|list of tools|what tools|all (the )?pages|menu|everything)\b/i,
    title: "All tools",
    sub: "Every Hub tool, grouped by what it's for",
    to: "/tools",
  },
  {
    re: /\b(market (myself|me)|brand myself|get my name out|farm(ing)?|self.?promo)/i,
    title: "Market myself",
    sub: "Seller lists, postcards, Reels, your pitch link, in order",
    to: "/do/market",
  },
  {
    re: /\b(listing appointment|listing appt|listing presentation|appointment prep)/i,
    title: "Listing appointment",
    sub: "CMA, intake, pre-listing package, net sheet, deck, in order",
    to: "/do/appointment",
  },
  {
    re: /\b(signature|sig ?line|sign.?off|email (footer|handle|sig)|gmail sig)/i,
    title: "Email signature",
    sub: "Make your own SpaceMatch and Real signature with your photo, cell and social links",
    to: "/signature",
  },
  {
    re: /\b(muse|meta ai|ai coach|coach|chatgpt|ai assistant|ask ai|role.?play|practice)/i,
    title: "Muse coach",
    sub: "Our playbooks inside Meta's Muse: ask it anything on the go",
    to: "/muse",
  },
  {
    re: /\b(guide|help me|where (do|is|can)|which tool|what (do|should) i use|how does (the )?hub|tour|new here|start here|lost)/i,
    title: "Hub Guide",
    sub: "Which tool to use for every situation",
    to: "/guide",
  },
  {
    re: /\b(cma|comps?|value|worth|pric)/i,
    title: "Request a CMA",
    sub: "Type the address, get a branded PDF",
    to: "/new",
  },
  {
    re: /\b(lease|rent(al)? (analysis|cma)|rent comps)/i,
    title: "Request a lease CMA",
    sub: "Rental price analysis",
    to: "/lease",
  },
  {
    re: /(100 ?%|\b(rental build|apartment build|apartments?\b|renter|locator|full month|pays? (a |one )?month|(doesn.?t|don.?t|not|never|won.?t) pay|no commission))/i,
    title: "100% commission rentals",
    sub: "Chicago buildings that pay a full month's rent or more, and the ones that don't pay",
    to: "/commission-rentals",
  },
  {
    re: /\b(lender|loan|mortgage|pre.?approv)/i,
    title: "Find a lender",
    sub: "Vendors › Lenders",
    to: "/resources?cat=Lenders",
  },
  {
    re: /\b(attorney|lawyer|closing attorney)/i,
    title: "Find an attorney",
    sub: "Vendors › Attorneys",
    to: "/resources?cat=Attorneys",
  },
  {
    re: /\b(inspect)/i,
    title: "Find an inspector",
    sub: "Vendors › Inspectors",
    to: "/resources?cat=Inspectors",
  },
  {
    re: /\b(contractor|plumb|electric|roof|handyman|repair|paint)/i,
    title: "Find a contractor",
    sub: "Vendors › Contractors & maintenance",
    to: "/resources?cat=Contractors",
  },
  {
    re: /\b(photo|video|stag|media|giraffe)/i,
    title: "Listing prep & media",
    sub: "Vendors › Listing prep & media",
    to: "/resources?cat=Listing%20prep%20%26%20media",
  },
  {
    re: /\b(sign(?!ature|.?off)|rider|flyer|business card|mailer|reel|post)/i,
    title: "Marketing request",
    sub: "Signs, flyers, posts — goes to Cris",
    to: "/forms?open=marketing-request",
  },
  {
    re: /\b(tc|contract to close|under contract|deadline)/i,
    title: "TC request",
    sub: "Open a contract-to-close file",
    to: "/forms?open=tc-request",
  },
  {
    re: /\b(open house)/i,
    title: "Open house sign-in (QR)",
    sub: "Print or show the QR code",
    to: "/forms?open=open-house-signin",
  },
  {
    re: /\b(commission|deal sheet|split)/i,
    title: "Deal / commission sheet",
    sub: "Submit a firm deal",
    to: "/forms?open=deal-sheet",
  },
  {
    re: /\b(buyer.?s? guide|seller.?s? guide|client guide|guide for (my )?(buyer|seller)|buyer packet|seller packet)/i,
    title: "Buyer & Seller guides",
    sub: "17-page guides branded with your name & photo",
    to: "/presentations?guide=buyer",
  },
  {
    re: /\b(my videos?|upload (a |my )?videos?|film(ing)?|record(ing)? (a )?video|vidchops?|editor|raw clips?|video upload)/i,
    title: "My videos",
    sub: "Upload raw clips for our editor · tutorial & ideas",
    to: "/my-videos",
  },
  {
    re: /\b(reel studio|reels?|edit (my )?video|video edit(ing)?|tiktok|shorts|captions?)/i,
    title: "Reel Studio",
    sub: "Order an edited Reel from your clips · from $12",
    to: "/reels",
  },
  {
    re: /\b(email|e-?mail template|newsletter|drip|smart plan|rent vs|rent or (buy|own)|renters?|move.?up|past clients?|sphere|nurture)/i,
    title: "Emails",
    sub: "Ready-made emails per client group · rent vs own · move-up",
    to: "/emails",
  },
  {
    re: /\b(net ?sheet|walk.?away|seller net|proceeds|closing costs?|transfer tax)/i,
    title: "Seller net sheet",
    sub: "What the seller walks away with",
    to: "/net-sheet",
  },
  {
    re: /\b(seller lists?|owner lists?|farm list|mailing list|likely sellers?|zip ?codes?|homeowner list|list of (home)?owners|mail (a|the|my) (building|neighborhood|area)|whole building|condo building)/i,
    title: "Seller lists",
    sub: "Owners most likely to sell, by ZIP or by building · no listing needed",
    to: "/seller-lists",
  },
  {
    re: /\b(mailer|mailing|postcard|direct mail|farm|farming|atn|qr code)/i,
    title: "Seller mailers",
    sub: "Branded jumbo postcards with tracked QR codes",
    to: "/mailers",
  },
  {
    re: /\b(presentation|deck|pitch|pre.?listing|listing appointment)/i,
    title: "Listing presentation",
    sub: "Download your branded deck",
    to: "/presentations",
  },
  {
    re: /\b(listing|seller|launch|portal|showing|feedback|zillow)/i,
    title: "Seller Launch Portal",
    sub: "Your listings and sellers' live pages",
    to: "/listings",
  },
  {
    re: /\b(playbook|how (do|to)|training|academy|certif|quiz|learn)/i,
    title: "SpaceMatch Academy",
    sub: "7 tracks, drills, certification checks and your progress",
    to: "/training",
  },
  {
    re: /\b(script|text|email template|follow.?up message)/i,
    title: "Scripts & emails",
    sub: "Copy-ready texts and emails",
    to: "/templates?tab=scripts",
  },
  {
    re: /\b(bug|broken|fix|idea|suggest|feature|add.?on|improve|not working)/i,
    title: "Suggest a fix or add-on",
    sub: "Tell Michael what to fix or add to the Hub",
    to: "/feedback",
  },
  {
    re: /\b(lead|new client)/i,
    title: "My inbox",
    sub: "Leads and form answers",
    to: "/inbox",
  },
];

const norm = (s: string) => s.toLowerCase();

function score(q: string, ...fields: (string | undefined)[]) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  const hay = norm(fields.filter(Boolean).join(" "));
  let s = 0;
  for (const w of words) {
    if (!hay.includes(w)) return 0;
    s += norm(fields[0] ?? "").includes(w) ? 3 : 1;
  }
  return s;
}

export function GlobalSearch({ big = false }: { big?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const vendors = useQuery(api.vendors.list);
  const rentals = useQuery(api.commissionBuildings.list);
  const requests = useQuery(api.cma.list);
  const inbox = useQuery(api.forms.inbox, {});

  const hits = useMemo<Hit[]>(() => {
    if (q.trim().length < 2) return [];
    const out: Hit[] = [];
    for (const it of INTENTS)
      if (it.re.test(q))
        out.push({
          kind: "Do it",
          title: it.title,
          sub: it.sub,
          go: () => nav(it.to),
          score: 100,
          icon: ArrowRight,
        });
    for (const f of FORMS) {
      const s = score(q, f.title, f.blurb, f.group);
      if (s)
        out.push({
          kind: "Form",
          title: f.title,
          sub: `${f.group} · ${f.blurb}`,
          go: () => nav(`/forms?open=${f.id}`),
          score: s + 2,
          icon: ClipboardList,
        });
    }
    for (const v of vendors?.vendors ?? []) {
      const s = score(
        q,
        v.name,
        v.company,
        v.category,
        v.subcategory,
        v.description,
        v.areas,
        v.languages,
      );
      if (s)
        out.push({
          kind: "Vendor",
          title: v.company ? `${v.name} · ${v.company}` : v.name,
          sub: `${v.category}${v.phone ? ` · ${v.phone}` : ""}`,
          go: () => nav(`/resources?v=${v._id}`),
          score: s + (v.preferred ? 2 : 1),
          icon: BookUser,
        });
    }
    for (const b of rentals?.buildings ?? []) {
      const s = score(q, b.name, b.address, b.neighborhood, b.manager);
      if (s)
        out.push({
          kind: "100% rental",
          title: b.name,
          sub: b.status === "no_pay"
            ? `Doesn't pay: ${b.noPayReason === "under" ? `${b.commissionPct}% of a month's rent` : b.noPayReason === "unpaid" ? "didn't pay on a deal" : "no broker commission"} · ${b.address.split(",")[0]}${b.verified ? " · Confirmed" : ""}`
            : `${b.commissionPct}% of a month's rent · ${b.address.split(",")[0]}${b.verified ? " · Verified" : ""}`,
          go: () => nav(`/commission-rentals?b=${b._id}`),
          score: s + (b.verified ? 1 : 0),
          icon: Building2,
        });
    }
    for (const t of TOOLS) {
      const s = score(q, t.name, t.note, t.tags);
      if (s)
        out.push({
          kind: "Tool",
          title: t.name,
          sub: t.note,
          go: () => window.open(toolHref(t), "_blank"),
          score: s,
          icon: Wrench,
        });
    }
    for (const d of DOCS) {
      const s = score(q, d.name, d.note, d.tags);
      if (s)
        out.push({
          kind: "Doc",
          title: d.name,
          sub: d.note,
          go: () =>
            d.href.startsWith("/")
              ? nav(d.href)
              : window.open(d.href, "_blank"),
          score: s,
          icon: FileText,
        });
    }
    for (const p of PLAYBOOKS) {
      const s = score(q, p.title, p.summary, p.tags);
      if (s)
        out.push({
          kind: "Playbook",
          title: p.title,
          sub: p.summary,
          go: () => nav(`/playbooks/${p.id}`),
          score: s + 2,
          icon: FileText,
        });
    }
    for (const t of TEMPLATES) {
      const s = score(q, t.title, t.note, t.section);
      if (s)
        out.push({
          kind: "Template",
          title: t.title,
          sub: t.section,
          go: () => window.open(t.href, "_blank"),
          score: s,
          icon: FileText,
        });
    }
    for (const x of SCRIPTS) {
      const s = score(q, x.title, x.use, x.group);
      if (s)
        out.push({
          kind: "Script",
          title: x.title,
          sub: x.use,
          go: () =>
            nav(`/templates?tab=scripts&q=${encodeURIComponent(x.title)}`),
          score: s,
          icon: FileText,
        });
    }
    for (const p of TEAM) {
      const s = score(q, p.name, p.role, p.does);
      if (s)
        out.push({
          kind: "Team",
          title: p.name,
          sub: `${p.role} · ${p.does}`,
          go: () => nav("/home#team"),
          score: s,
          icon: User,
        });
    }
    for (const r of requests ?? []) {
      const s = score(q, `${r.street} ${r.city}`, r.clientName, r.agentName);
      if (s)
        out.push({
          kind: "CMA",
          title: formatAddress(r),
          sub: `${r.clientName} · ${r.status}`,
          go: () => nav("/requests"),
          score: s,
          icon: FileBarChart,
        });
    }
    for (const r of inbox?.rows ?? []) {
      const s = score(
        q,
        r.contactName,
        r.contactEmail,
        r.contactPhone,
        r.propertyAddress,
        r.formTitle,
      );
      if (s)
        out.push({
          kind: "Contact",
          title: r.contactName,
          sub: `${r.formTitle}${r.contactPhone ? ` · ${r.contactPhone}` : ""}`,
          go: () => nav(`/inbox?open=${r._id}`),
          score: s,
          icon: Inbox,
        });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 9);
  }, [q, vendors, rentals, requests, inbox, nav]);

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-3 rounded-2xl bg-white shadow-[0_16px_40px_rgba(0,0,0,.14)] ring-1 ring-black/5 ${big ? "px-5 py-4" : "px-4 py-3"}`}
      >
        <Search className="size-5 text-[#9C7434] shrink-0" />
        <input
          value={q}
          onChange={e => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          onKeyDown={e => {
            if (e.key === "Enter" && hits[0]) hits[0].go();
          }}
          placeholder="Search forms, vendors, docs, clients… or type “CMA”, “lender”, “signs”"
          className={`w-full bg-transparent outline-none placeholder:text-stone-400 text-[#0A0A0A] ${big ? "text-lg" : "text-base"}`}
          aria-label="Search the hub"
        />
      </div>
      {open && hits.length > 0 && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
          {hits.map((h, i) => (
            <button
              key={i}
              type="button"
              data-testid="search-hit"
              onMouseDown={h.go}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#F7F5F1] border-b last:border-0 border-stone-100"
            >
              <h.icon className="size-4 text-[#9C7434] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[#0A0A0A]">
                  {h.title}
                </div>
                <div className="truncate text-xs text-stone-500">{h.sub}</div>
              </div>
              <span className="rounded-full bg-[#F7F5F1] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                {h.kind}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && q.trim().length >= 2 && hits.length === 0 && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 rounded-2xl bg-white p-4 text-sm text-stone-500 shadow-xl">
          Nothing found for “{q}”. Try a client name, a vendor type or a form
          name.
        </div>
      )}
    </div>
  );
}
