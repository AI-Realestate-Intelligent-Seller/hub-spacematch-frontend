// Shared big, readable building blocks for the Market myself pages (Michael 11-22: "easier to read like buttons").
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Icon = React.ComponentType<{ className?: string }>;
const base = "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[16px] font-bold disabled:opacity-50";
export const btnDark = `${base} bg-[#0A0A0A] text-white hover:bg-[#1c1a17]`;
export const btnLight = `${base} bg-white text-[#0A0A0A] ring-2 ring-[#0A0A0A] hover:bg-[#FBFAF7]`;
export const btnGold = `${base} bg-[#9C7434] text-white hover:bg-[#8a662c]`;
export const input = "w-full rounded-xl border-2 border-stone-300 bg-white px-3.5 py-3 text-[17px] text-[#0A0A0A] outline-none focus:border-[#0A0A0A]";
export const label = "mb-1.5 block text-[16px] font-semibold text-[#0A0A0A]";

export function PageHead({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="mb-4">
      <h1 className="font-['Playfair_Display'] text-[28px] font-semibold leading-tight text-[#0A0A0A]">{title}</h1>
      <p className="mt-1 text-[17px] leading-snug text-stone-700">{sub}</p>
    </header>
  );
}

export function Card({ children, className = "", testid }: { children: React.ReactNode; className?: string; testid?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da] md:p-5 ${className}`} data-testid={testid}>
      {children}
    </section>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-[19px] font-bold text-[#0A0A0A]">{children}</h2>;
}

export function CopyBtn({ text, label: l = "Copy", light, testid, icon: I = Copy }: { text: string; label?: string; light?: boolean; testid?: string; icon?: Icon }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      data-testid={testid}
      className={light ? btnLight : btnDark}
      onClick={() =>
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setDone(true);
            toast.success("Copied");
            setTimeout(() => setDone(false), 1800);
          })
          .catch(() => toast.error("Couldn't copy. Press and hold the text to copy it."))
      }
    >
      {done ? <Check className="size-[18px]" /> : <I className="size-[18px]" />} {done ? "Copied" : l}
    </button>
  );
}

export function LinkBtn({ to, children, light, icon: I }: { to: string; children: React.ReactNode; light?: boolean; icon?: Icon }) {
  return (
    <Link to={to} className={light ? btnLight : btnDark}>
      {I && <I className="size-[18px]" />}
      {children}
    </Link>
  );
}

export function Stat({ n, label: l }: { n: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl bg-[#F7F5F1] px-3 py-3 text-center">
      <div className="font-['Playfair_Display'] text-[26px] font-bold leading-none text-[#0A0A0A]">{n}</div>
      <div className="mt-1 text-[15px] font-semibold text-stone-700">{l}</div>
    </div>
  );
}

/** Plain message from a Convex error ("[CONVEX M(x)] [Request ID …] Server Error Uncaught Error: <msg> at handler …"). */
export function errMsg(e: unknown) {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  const m = raw.match(/Uncaught Error:\s*([\s\S]*?)(?:\s+at handler|\s+at async|\n|$)/);
  const msg = (m ? m[1] : raw.replace(/^\[CONVEX[^\]]*\]\s*(\[Request ID[^\]]*\]\s*)?/, "")).trim();
  return msg && msg.length < 200 ? msg : "Something went wrong. Try again.";
}
export const toastErr = (e: unknown) => toast.error(errMsg(e));
