import { useQuery } from "convex/react";
import { ArrowRight, GraduationCap, Smartphone } from "lucide-react";
import { Link } from "react-router";
import { api } from "../../../convex/_generated/api";

// Home: the agent's "Why SpaceMatch" link (send during a call, watch it live). Full-width so it's the first thing they see.
export function WhyTile() {
  const tut = useQuery(api.whyLinks.tutorial);
  const data = useQuery(api.whyLinks.mine, tut?.done ? {} : "skip");
  const live = (data?.links ?? []).filter(l => l.lastSeenAt && Date.now() - l.lastSeenAt < 60_000);
  const opened = (data?.links ?? []).filter(l => l.opens > 0).length;
  return (
    <Link to="/why" data-testid="why-tile"
      className="group flex items-center gap-4 rounded-2xl bg-[#0A0A0A] p-4 text-white ring-1 ring-[#0A0A0A] transition-all hover:-translate-y-0.5 hover:shadow-lg md:p-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#9C7434]">
        {tut && !tut.done ? <GraduationCap className="size-6" /> : <Smartphone className="size-6" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold leading-tight">Why SpaceMatch link</span>
        <span className="mt-0.5 block text-[14px] leading-snug text-white/70">
          {tut && !tut.done
            ? "New · 3-minute tutorial unlocks your personal pitch page"
            : live.length
              ? `● ${live.map(l => l.prospectName).join(", ")} viewing now`
              : `On a call? Text your branded page in 15 seconds${opened ? ` · ${opened} opened` : ""}`}
        </span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-[#D9BC8C] transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
