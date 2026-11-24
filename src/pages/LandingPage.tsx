import { useOptionalSession } from "@/auth/session";
import {
  ArrowRight,
  Building2,
  ClipboardList,
  FileBarChart,
  GraduationCap,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { FEATURE_GROUPS, toolById } from "@/lib/hubGuide";

// Shown to signed-out visitors at "/". Brokerage line switches to Real on Nov 10.
function brokerageLine() {
  const chicago = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  return chicago >= "2026-11-09" ? "SpaceMatch Inc. · a team of Real Broker, LLC" : "SpaceMatch Inc.";
}

const GROUP_ICONS: LucideIcon[] = [FileBarChart, ClipboardList, Building2, GraduationCap, LifeBuoy];

const DEAL_FLOW = [
  { k: "Prospect", v: "Why link · mailers · B-roll" },
  { k: "Appointment", v: "CMA · decks · seller guide" },
  { k: "Launch", v: "Seller portal · Ad Kit · open house QR" },
  { k: "Contract", v: "TC request · vendors · Real forms" },
  { k: "Closed", v: "Reviews · referrals" },
];

export function LandingPage() {
  const { isAuthenticated, isLoading } = useOptionalSession();
  return (
    <div className="flex-1 flex flex-col bg-[#F7F5F1]">
      <section className="px-4 pt-12 pb-10 md:pt-20 md:pb-14">
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <p className="text-sm font-semibold text-[#9C7434]">{brokerageLine()}</p>
          <h1 className="font-['Playfair_Display'] text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] text-[#0A0A0A]">
            Agent Hub
          </h1>
          <p className="text-lg md:text-xl text-stone-700 max-w-2xl mx-auto">
            Everything a SpaceMatch agent needs to win listings, market them
            and close, in one app on your phone.
          </p>
          {!isLoading && (
            <div className="flex flex-wrap gap-3 justify-center pt-2">
              {isAuthenticated ? (
                <Button size="lg" asChild>
                  <Link to="/home">
                    Open the Hub <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" asChild>
                    <Link to="/login">
                      Sign in <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/signup">Create account</Link>
                  </Button>
                </>
              )}
            </div>
          )}
          {!isAuthenticated && !isLoading && (
            <p className="text-[15px] text-stone-600">
              Use your @spacematchinc.com email. We'll send you a code.
            </p>
          )}
        </div>
      </section>

      {/* Deal flow strip */}
      <section className="px-4 pb-10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center font-['Playfair_Display'] text-2xl md:text-3xl font-semibold text-[#0A0A0A]">
            One app for the whole deal
          </h2>
          <ol className="mt-5 grid grid-cols-1 sm:grid-cols-5 gap-2">
            {DEAL_FLOW.map((s, i) => (
              <li
                key={s.k}
                className="rounded-xl bg-[#0A0A0A] text-white px-4 py-3 flex sm:block items-baseline gap-3"
              >
                <div className="text-[#D9BC8C] text-sm font-semibold">
                  {i + 1}. {s.k}
                </div>
                <div className="text-[15px] text-stone-200 sm:mt-1">{s.v}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What's inside */}
      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto space-y-8">
          <h2 className="text-center font-['Playfair_Display'] text-2xl md:text-3xl font-semibold text-[#0A0A0A]">
            What's inside
          </h2>
          {FEATURE_GROUPS.map((g, gi) => {
            const Icon = GROUP_ICONS[gi] ?? FileBarChart;
            return (
              <div key={g.title} data-testid="landing-group">
                <div className="flex items-center gap-2">
                  <Icon className="size-5 text-[#9C7434]" />
                  <h3 className="text-xl font-semibold text-[#0A0A0A]">{g.title}</h3>
                </div>
                <p className="text-[15px] text-stone-600 mt-1">{g.blurb}</p>
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  {g.ids.map(id => {
                    const t = toolById(id);
                    return (
                      <div key={id} className="rounded-xl bg-white ring-1 ring-[#ebe5da] p-4">
                        <div className="font-semibold text-[17px] text-[#0A0A0A]">{t.name}</div>
                        <p className="text-[15px] text-stone-700 mt-1 leading-relaxed">{t.what}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="rounded-2xl bg-[#0A0A0A] text-white p-6 text-center space-y-3">
            <p className="text-lg">
              New here? After you sign in, open the <b className="text-[#D9BC8C]">Hub Guide</b> on Home. It
              shows which tool to use for every situation, from first call to closing.
            </p>
            {!isLoading && !isAuthenticated && (
              <Button size="lg" asChild>
                <Link to="/login">
                  Sign in <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
