import { hasConvexDeployment } from "@/auth/convexClient";
import { useCurrentUser, useSession } from "@/auth/session";
import { useMutation, useQuery } from "convex/react";
import {
  FileBarChart,
  KeyRound,
  LifeBuoy,
  Lightbulb,
  LogOut,
  Megaphone,
  Settings,
  Type,
  Clapperboard,
  ListChecks,
  BarChart3,
  Headset,
  ChevronLeft,
  Inbox,
  Grid2x2,
  PenLine, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import { useApiData } from "@/lib/apiData";
import { adOrdersApi } from "@/lib/listingsApi";
import { areaOf } from "../lib/adoptionAreas";
import { AREAS, areaFor } from "../lib/areas";
import { recordToolUse } from "../lib/catalog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// 5 areas (Michael 2026-10-29): Today · Clients · Listings · Marketing · Learn.
// Pages inside an area show as chips under the header with a one-line purpose.
const NAV = AREAS;

function useInboxBadge() {
  const c = useQuery(api.forms.counts);
  return c?.newCount ?? 0;
}

// Adoption scoreboard: one tiny ping per Hub area per 30 min (no AI, no credits).
const lastPing = new Map<string, number>();
function useAdoptionPing(path: string) {
  const ping = useMutation(api.adoption.ping);
  useEffect(() => {
    if (!hasConvexDeployment) return;
    const send = () => {
      const area = areaOf(path);
      if (!area || document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - (lastPing.get(area) ?? 0) < 30 * 60e3) return;
      lastPing.set(area, now);
      ping({ area }).catch(() => lastPing.delete(area));
    };
    send();
    document.addEventListener("visibilitychange", send);
    return () => document.removeEventListener("visibilitychange", send);
  }, [path, ping]);
}

function UserMenu() {
  const user = useCurrentUser(); // new backend session
  const me = useQuery(api.hubMe.me);
  const adPending = useApiData("ad-orders:config", () => adOrdersApi.config(), { pollMs: 120_000 }).data?.pending ?? 0; // new backend
  const reelConfirm = useQuery(api.reelOrders.config)?.toConfirm ?? 0;
  const listConfirm = useQuery(api.sellerLists.config, {})?.toConfirm ?? 0;
  const { signOut } = useSession(); // new backend: clears the session cookie
  const [large, setLarge] = useState(() => document.documentElement.classList.contains("text-large"));
  const toggleLarge = () => {
    const next = !large;
    document.documentElement.classList.toggle("text-large", next);
    try { localStorage.setItem("hub-text-size", next ? "large" : "normal"); } catch { /* private mode */ }
    setLarge(next);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Account menu" className="size-9 rounded-full border-2 border-[#D9BC8C] bg-[#1c1a17] text-[#D9BC8C] text-sm font-semibold outline-none">
        {me?.initials ||
          user?.name
            ?.split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(w => w[0]?.toUpperCase())
            .join("") ||
          "SM"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-sm">
          <div className="font-medium truncate">{me?.name ?? user?.name}</div>
          <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/tools" data-testid="menu-all-tools"><Grid2x2 className="size-4" /> All tools</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {(me?.isAdmin || me?.isOps) && (
          <DropdownMenuItem asChild>
            <Link to="/desk"><Headset className="size-4" /> Lead Desk</Link>
          </DropdownMenuItem>
        )}
        {me?.canNewLeads && (
          <DropdownMenuItem asChild>
            <Link to="/new-leads"><Inbox className="size-4" /> New Leads</Link>
          </DropdownMenuItem>
        )}
        {(me?.isAdmin || me?.isOps) && (
          <DropdownMenuItem asChild>
            <Link to="/team"><UsersRound className="size-4" /> Team roster</Link>
          </DropdownMenuItem>
        )}
        {(me?.isAdmin || me?.isOps) && (
          <DropdownMenuItem asChild>
            <Link to="/logins"><KeyRound className="size-4" /> Agent logins</Link>
          </DropdownMenuItem>
        )}
        {me?.isAdmin && (
          <DropdownMenuItem asChild>
            <Link to="/adoption"><BarChart3 className="size-4" /> Adoption scoreboard</Link>
          </DropdownMenuItem>
        )}
        {(me?.isAdmin || adPending > 0) && (
          <DropdownMenuItem asChild>
            <Link to="/ad-orders"><Megaphone className="size-4" /> Ad orders{adPending ? <span className="ml-auto rounded-full bg-[#9C7434] px-2 py-0.5 text-xs font-bold text-white">{adPending}</span> : null}</Link>
          </DropdownMenuItem>
        )}
        {reelConfirm > 0 && (
          <DropdownMenuItem asChild>
            <Link to="/reels"><Clapperboard className="size-4" /> Reels to confirm<span className="ml-auto rounded-full bg-[#9C7434] px-2 py-0.5 text-xs font-bold text-white">{reelConfirm}</span></Link>
          </DropdownMenuItem>
        )}
        {listConfirm > 0 && (
          <DropdownMenuItem asChild>
            <Link to="/seller-lists?tab=orders"><ListChecks className="size-4" /> Seller lists to confirm<span className="ml-auto rounded-full bg-[#9C7434] px-2 py-0.5 text-xs font-bold text-white">{listConfirm}</span></Link>
          </DropdownMenuItem>
        )}
        {(me?.isAdmin || me?.isOps) && <DropdownMenuSeparator />}
        <DropdownMenuItem asChild>
          <Link to="/signature" data-testid="menu-signature"><PenLine className="size-4" /> My email signature</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/requests"><FileBarChart className="size-4" /> My CMA requests</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/help"><LifeBuoy className="size-4" /> My help requests</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/feedback"><Lightbulb className="size-4" /> Suggest a fix</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings"><Settings className="size-4" /> Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={e => { e.preventDefault(); toggleLarge(); }}>
          <Type className="size-4" /> Larger text
          <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${large ? "bg-[#9C7434] text-white" : "bg-stone-100 text-stone-600"}`}>{large ? "On" : "Off"}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const isOn = (path: string, item: (typeof NAV)[number]) => {
  const hit = areaFor(path);
  // Pages outside the 5 areas (help, settings, feedback…) light up Today.
  return hit ? hit.area.id === item.id : item.id === "today";
};

// Chips for the pages inside the current area + what the page is for.
function AreaBar({ path }: { path: string }) {
  const hit = areaFor(path);
  if (!hit || !hit.page) return null;
  const { area, page } = hit;
  return (
    <div className="border-b border-black/5 bg-[#F7F5F1] print:hidden" data-testid="area-bar">
      <div className="mx-auto max-w-6xl px-4 lg:px-6">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 py-3 [scrollbar-width:none] lg:mx-0 lg:px-0">
          {area.pages.map(p => {
            const on = p.to === page.to;
            return (
              <Link
                key={p.to}
                to={p.to}
                title={p.purpose}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition-colors ${
                  on ? "bg-[#0A0A0A] text-white" : "bg-white text-stone-700 hover:text-black"
                }`}
              >
                {p.label}
                {p.isNew && !on && <span className="ml-1.5 rounded-full bg-[#9C7434] px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-white">New</span>}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Every page except Home gets a way back (Michael 2026-10-31): previous page if there is one
// inside the Hub, else Home.
function BackBar({ path }: { path: string }) {
  const nav = useNavigate();
  if (path === "/home") return null;
  const canGoBack = typeof window !== "undefined" && (window.history.state?.idx ?? 0) > 0;
  return (
    <div className="mb-3 flex items-center gap-2 print:hidden" data-testid="back-bar">
      <button
        type="button"
        onClick={() => (canGoBack ? nav(-1) : nav("/home"))}
        className="inline-flex items-center gap-1 rounded-full bg-white py-1.5 pl-2 pr-3.5 text-[14px] font-semibold text-stone-700 ring-1 ring-[#ebe5da] hover:text-black"
      >
        <ChevronLeft className="size-4" /> Back
      </button>
      <Link to="/home" className="inline-flex items-center rounded-full px-3 py-1.5 text-[14px] font-semibold text-stone-500 hover:text-black">
        Home
      </Link>
    </div>
  );
}

export function AppLayout() {
  const badge = useInboxBadge();
  const path = useLocation().pathname;
  useAdoptionPing(path);
  // My tools on Home: count which tools this phone opens (localStorage only).
  useEffect(() => { recordToolUse(path); }, [path]);
  return (
    <div className="min-h-svh bg-background">
      <header
        className="sticky top-0 z-40 bg-[#0A0A0A] text-white print:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 lg:px-6">
          <Link to="/home" className="flex items-center gap-3 shrink-0">
            <img src="/logo-white.png" alt="SpaceMatch" className="h-6 md:h-7" />
            <span className="hidden sm:block text-[10px] tracking-[0.25em] text-[#D9BC8C] font-semibold border-l border-white/20 pl-3">
              AGENT HUB
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={() =>
                  `relative rounded-full px-4 py-2 text-sm transition-colors ${
                    isOn(path, item) ? "bg-[#9C7434] text-white" : "text-[#bdb6aa] hover:text-white"
                  }`
                }
              >
                {item.label}
                {item.badge && badge > 0 && (
                  <span className="ml-1.5 rounded-full bg-[#D9BC8C] px-1.5 text-[11px] font-bold text-black">{badge}</span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto"><UserMenu /></div>
        </div>
      </header>

      <AreaBar path={path} />

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 lg:px-6 md:pb-12">
        <BackBar path={path} />
        <Outlet />
      </main>

      {/* Phone tab bar — feels like a native app once added to the home screen */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 backdrop-blur md:hidden print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {NAV.map(item => {
            const on = isOn(path, item);
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className="relative flex flex-col items-center gap-0.5 py-2.5 text-[11px]">
                <Icon className={`size-5 ${on ? "text-[#9C7434]" : "text-stone-500"}`} />
                <span className={on ? "font-semibold text-[#0A0A0A]" : "text-stone-500"}>{item.label}</span>
                {item.badge && badge > 0 && (
                  <span className="absolute right-[22%] top-1.5 rounded-full bg-[#9C7434] px-1.5 text-[10px] font-bold text-white">{badge}</span>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
