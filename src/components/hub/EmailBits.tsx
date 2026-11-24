// Small shared pieces for the Emails page and the seller net sheet.
import { useQuery } from "convex/react";
import { Check, Copy, ExternalLink, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { agentByEmail } from "@/lib/agents";
import { type Signer, gmailLink, signature } from "@/lib/emailLibrary";
import { TEAM_LINE } from "@/lib/hub";
import { api } from "../../../convex/_generated/api";

export const card = "rounded-2xl bg-white p-4 md:p-5 ring-1 ring-[#ebe5da]";
export const inputCls = "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[16px] outline-none focus:border-[#9C7434] focus:ring-2 focus:ring-[#9C7434]/20";
export const btnDark = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-4 py-2.5 text-[15px] font-semibold text-white disabled:opacity-50";
export const btnLight = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7F5F1] px-4 py-2.5 text-[15px] font-semibold text-[#0A0A0A] ring-1 ring-[#ebe5da] disabled:opacity-50";
export const labelCls = "text-[14px] font-semibold text-stone-700";

export function useSigner(): Signer {
  const me = useQuery(api.hubMe.me);
  const email = me?.email ?? "";
  const agent = agentByEmail(email);
  return { name: me?.name ?? "", phone: agent?.phone ?? TEAM_LINE, email: email.includes("@spacematchinc.com") ? email : "team@spacematchinc.com" };
}

const digits = (s: string) => s.replace(/[^\d]/g, "");
export function MoneyField({ label, value, onChange, hint, testId }: { label: string; value: number; onChange: (n: number) => void; hint?: string; testId?: string }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <div className="relative mt-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
        <input
          inputMode="numeric"
          data-testid={testId}
          className={`${inputCls} pl-7`}
          value={value ? value.toLocaleString("en-US") : ""}
          placeholder="0"
          onChange={e => onChange(Number(digits(e.target.value)) || 0)}
        />
      </div>
      {hint && <span className="mt-1 block text-[13px] text-stone-500">{hint}</span>}
    </label>
  );
}

export function PctField({ label, value, onChange, step = 0.05, hint, testId }: { label: string; value: number; onChange: (n: number) => void; step?: number; hint?: string; testId?: string }) {
  const [txt, setTxt] = useState(String(value));
  const shown = Number(txt) === value ? txt : String(value);
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <div className="relative mt-1">
        <input
          inputMode="decimal"
          step={step}
          data-testid={testId}
          className={`${inputCls} pr-8`}
          value={shown}
          onChange={e => { const t = e.target.value.replace(/[^\d.]/g, ""); setTxt(t); onChange(Number(t) || 0); }}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">%</span>
      </div>
      {hint && <span className="mt-1 block text-[13px] text-stone-500">{hint}</span>}
    </label>
  );
}

export function TextField({ label, value, onChange, placeholder, hint, testId, type = "text" }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string; hint?: string; testId?: string; type?: string }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input type={type} data-testid={testId} className={`${inputCls} mt-1`} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      {hint && <span className="mt-1 block text-[13px] text-stone-500">{hint}</span>}
    </label>
  );
}

export async function copyText(text: string, what = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(what);
  } catch {
    toast.error("Couldn't copy. Select the text and copy it by hand.");
  }
}

// Phone-style email preview + the 3 ways out (Gmail, copy, Lofty).
export function EmailPreview({
  subject, body, signer, to, lofty, testId,
}: { subject: string; body: string; signer: Signer; to?: string; lofty?: { subject: string; body: string }; testId?: string }) {
  const [copied, setCopied] = useState(false);
  const sig = signature(signer);
  const full = `${body}\n\n${sig}`;
  return (
    <div className={`${card} p-0 overflow-hidden`} data-testid={testId}>
      <div className="border-b border-[#ebe5da] bg-[#F7F5F1] px-4 py-3 text-[14px]">
        <div className="text-stone-500">To: <span className="text-stone-800">{to?.trim() || "your client"}</span></div>
        <div className="mt-0.5 font-semibold text-[#0A0A0A]" data-testid="email-subject">{subject}</div>
      </div>
      <div className="max-h-[520px] overflow-y-auto whitespace-pre-wrap px-4 py-4 text-[15px] leading-relaxed text-stone-800" data-testid="email-body">
        {body}
        <div className="mt-4 border-t border-dashed border-stone-200 pt-3 text-[14px] text-stone-500">{sig}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-[#ebe5da] p-3 md:flex md:flex-wrap">
        <a className={btnDark} href={gmailLink(to ?? "", subject, full)} target="_blank" rel="noreferrer" data-testid="open-gmail">
          <Mail className="size-4" /> Open in Gmail
        </a>
        <button type="button" className={btnLight} onClick={() => { copyText(`Subject: ${subject}\n\n${full}`, "Email copied"); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy
        </button>
        {lofty && (
          <button type="button" className={`${btnLight} col-span-2`} onClick={() => copyText(`${lofty.body}\n\n#signature#`, "Copied with Lofty fields. Paste it into a Lofty email.")}>
            <ExternalLink className="size-4" /> Copy for Lofty
          </button>
        )}
      </div>
    </div>
  );
}
