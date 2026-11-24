import { Share, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void> };

// "Add to Home Screen" helper: Android gets a one-tap install, iPhone gets the 2-step hint.
export function InstallCard() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [hidden, setHidden] = useState(() => localStorage.getItem("hub-install-dismissed") === "1");
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  if (standalone || hidden) return null;
  const dismiss = () => { localStorage.setItem("hub-install-dismissed", "1"); setHidden(true); };

  return (
    <div className="relative flex items-center gap-4 rounded-2xl bg-[#0A0A0A] p-4 text-white">
      <img src="/icon-192.png" alt="" className="size-12 rounded-xl ring-1 ring-white/20" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">Put the Hub on your phone</div>
        <div className="text-sm text-[#cfc7b9]">
          {evt ? "One tap — opens full-screen like an app." : ios ? (
            <>Tap <Share className="inline size-4 -mt-1" /> Share, then “Add to Home Screen”.</>
          ) : (
            <>Open this page on your phone, then use the browser menu → “Add to Home Screen”.</>
          )}
        </div>
      </div>
      {evt && (
        <button type="button" onClick={() => evt.prompt()} className="rounded-xl bg-[#9C7434] px-4 py-2 text-sm font-semibold">
          <Smartphone className="inline size-4 mr-1 -mt-0.5" />Install
        </button>
      )}
      <button type="button" onClick={dismiss} className="absolute right-2 top-2 p-1 text-white/50" aria-label="Dismiss"><X className="size-4" /></button>
    </div>
  );
}
