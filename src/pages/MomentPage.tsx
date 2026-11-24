import { useQuery } from "convex/react";
import { ArrowRight, Grid2x2, MessageCircle } from "lucide-react";
import { Link, Navigate, useParams } from "react-router";
import { toast } from "sonner";
import { type MomentButton, MOMENTS, momentById } from "@/lib/catalog";
import { api } from "../../convex/_generated/api";

// /do/:id — one page per moment, steps in order, one big button per tool (Michael 2026-11-22).
function StepButton({ b, first }: { b: MomentButton; first: string }) {
  const Icon = b.icon;
  const cls = `inline-flex min-h-[48px] items-center gap-2 rounded-xl px-4 py-2.5 text-[16px] font-bold ${
    b.light ? "bg-white text-[#0A0A0A] ring-2 ring-[#0A0A0A]" : "bg-[#0A0A0A] text-white"
  }`;
  const body = (
    <>
      {Icon && <Icon className="size-[18px]" />}
      {b.label}
    </>
  );
  if (b.copy === "text-back") {
    const text = `Hi, this is ${first || "your agent"} with SpaceMatch. I just tried calling about your real estate question. When is a good time to talk today?`;
    return (
      <button
        type="button"
        className={cls}
        data-testid="moment-btn"
        onClick={() =>
          navigator.clipboard
            .writeText(text)
            .then(() => toast.success("Text copied. Paste it into your messages."))
            .catch(() => toast(text))
        }
      >
        {body}
      </button>
    );
  }
  return (
    <Link to={b.to ?? "/home"} className={cls} data-testid="moment-btn">
      {body}
    </Link>
  );
}

export function MomentPage() {
  const { id = "" } = useParams();
  const me = useQuery(api.hubMe.me);
  const m = momentById(id);
  if (!m) return <Navigate to="/tools" replace />;
  let n = 0;
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6" data-testid="moment-page">
      <header>
        <h1 className="font-['Playfair_Display'] text-[28px] font-semibold leading-tight text-[#0A0A0A]">{m.title}</h1>
        <div className="mt-3 rounded-2xl bg-[#0A0A0A] px-4 py-3 text-[17px] leading-snug text-white">
          <b className="text-[#D9BC8C]">Goal:</b> {m.goal}
        </div>
      </header>

      {m.groups.map((g, gi) => (
        <section key={gi}>
          <h2 className="mb-2 mt-5 text-[16px] font-extrabold text-[#7a5a26]">{g.when ?? "Do these in order"}</h2>
          <ol className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe5da]">
            {g.steps.map(s => {
              n += 1;
              return (
                <li key={n} className="flex gap-3 p-4" data-testid="moment-step">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#9C7434] text-[17px] font-extrabold text-white">{n}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-semibold leading-snug text-[#0A0A0A]">{s.text}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {s.buttons.map(b => (
                        <StepButton key={b.label + (b.to ?? "")} b={b} first={me?.firstName ?? ""} />
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <Link to="/muse" className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#9C7434] bg-white px-4 py-3 text-[17px] font-bold text-[#0A0A0A]">
        <MessageCircle className="size-5 text-[#9C7434]" /> {m.muse}
      </Link>

      <section>
        <h2 className="mb-2 mt-6 text-[16px] font-extrabold text-[#0A0A0A]">Working on something else?</h2>
        <div className="grid grid-cols-2 gap-2">
          {MOMENTS.filter(x => x.id !== m.id).map(x => (
            <Link key={x.id} to={`/do/${x.id}`} className="flex min-h-[52px] items-center gap-2 rounded-xl bg-white px-3 py-2 text-[16px] font-semibold text-[#0A0A0A] ring-1 ring-[#ddd6ca]">
              <x.icon className="size-5 shrink-0 text-[#9C7434]" />
              <span className="min-w-0 flex-1 leading-tight">{x.label}</span>
              <ArrowRight className="size-4 shrink-0 text-stone-600" />
            </Link>
          ))}
          <Link to="/tools" className="flex min-h-[52px] items-center gap-2 rounded-xl bg-[#F7F5F1] px-3 py-2 text-[16px] font-semibold text-[#0A0A0A] ring-1 ring-[#ddd6ca]">
            <Grid2x2 className="size-5 shrink-0 text-[#9C7434]" />
            <span className="min-w-0 flex-1 leading-tight">All tools</span>
            <ArrowRight className="size-4 shrink-0 text-stone-600" />
          </Link>
        </div>
      </section>
    </div>
  );
}
