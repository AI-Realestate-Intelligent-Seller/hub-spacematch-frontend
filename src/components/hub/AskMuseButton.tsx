import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { askMusePrompt, MUSE_URL } from "@/lib/musePack";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older mobile browsers
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

/** Copy a ready prompt and open Muse. Plain link: no AI cost on the Hub side. */
export function openMuseWith(text: string) {
  void copyText(text);
  window.open(MUSE_URL, "_blank", "noopener");
  toast.success("Copied. In Muse, paste it and add your details.", {
    description: "No coach yet? Hub › Muse coach takes 2 minutes.",
  });
}

export function AskMuseButton({
  title,
  kind = "playbook",
  className = "",
}: {
  title: string;
  kind?: "playbook" | "situation";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => openMuseWith(askMusePrompt(title, kind))}
      data-testid="ask-muse"
      className={`inline-flex items-center gap-1.5 rounded-lg bg-[#0A0A0A] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#2a2723] ${className}`}
    >
      <Sparkles className="size-4 text-[#D9BC8C]" /> Ask Muse
    </button>
  );
}
