import { useQuery } from "convex/react";
import { Check, Copy, Download, ExternalLink, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { copyText, openMuseWith } from "@/components/hub/AskMuseButton";
import {
  buildPack,
  MUSE_RULES,
  MUSE_SENT_KEY,
  MUSE_URL,
  packFileName,
  packVersion,
  setupMessage,
  TRY_PROMPTS,
} from "@/lib/musePack";

// /muse: 3 taps to give an agent a SpaceMatch Coach inside Meta's Muse (Michael 2026-10-27).
// The coach file is built here on the device from Hub content. Nothing is sent to us or Meta until the agent shares it.

function StepNum({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[17px] font-bold ${done ? "bg-[#9C7434] text-white" : "bg-[#0A0A0A] text-white"}`}
    >
      {done ? <Check className="size-5" /> : n}
    </span>
  );
}

export function MusePage() {
  const me = useQuery(api.hubMe.me);
  const name = me?.agentName ?? (me && !me.isShared ? me.name : "") ?? "";
  const firstName = me?.firstName ?? "";
  const version = packVersion();
  const [file, setFile] = useState<File | null>(null);
  const [opened, setOpened] = useState(false);
  const [sentVersion, setSentVersion] = useState<string | null>(() => localStorage.getItem(MUSE_SENT_KEY));
  const [copied, setCopied] = useState(false);
  const [showMsg, setShowMsg] = useState(false);
  const message = useMemo(() => setupMessage(firstName), [firstName]);
  const fileName = packFileName(firstName);

  // Build the PDF ahead of time so the share sheet opens straight from the tap (iPhone needs that).
  useEffect(() => {
    if (me === undefined) return;
    let off = false;
    const blocks = buildPack({ name, firstName });
    import("@/lib/musePackPdf")
      .then(m => m.packToPdf(blocks, `SpaceMatch Coach${name ? ` · ${name}` : ""} · ${version.label}`))
      .then(bytes => {
      if (!off) setFile(new File([bytes as BlobPart], fileName, { type: "application/pdf" }));
    });
    return () => {
      off = true;
    };
  }, [me, name, firstName, fileName, version.label]);

  const markSent = () => {
    localStorage.setItem(MUSE_SENT_KEY, version.v);
    setSentVersion(version.v);
  };

  const download = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const sendFile = async () => {
    if (!file) return;
    void copyText(message).then(ok => ok && setCopied(true));
    const canShare = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    if (canShare) {
      try {
        await navigator.share({ files: [file], title: "SpaceMatch Coach", text: message });
        markSent();
        toast.success("Sent. If the message didn't come along, paste it in Muse (it's copied).");
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") {
          download();
          markSent();
        }
      }
    } else {
      download();
      markSent();
      toast.success("Downloaded. Drag it into your Muse chat, then paste the message (it's copied).");
    }
  };

  const copyMsg = async () => {
    if (await copyText(message)) {
      setCopied(true);
      toast.success("Copied. Paste it in Muse with the file.");
    }
  };

  const upToDate = sentVersion === version.v;
  const needsUpdate = !!sentVersion && !upToDate;

  return (
    <div className="mx-auto max-w-2xl space-y-6" data-testid="muse-page">
      <header className="rounded-3xl bg-[#0A0A0A] p-6 text-white">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-[#D9BC8C]">
          <Sparkles className="size-5" /> Muse coach
        </div>
        <h1 className="mt-2 font-['Playfair_Display'] text-3xl font-bold leading-tight">
          Your SpaceMatch Coach, in your pocket
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-white/85">
          Muse is Meta's free AI assistant. Give it our playbooks once, then ask it
          anything on the go: before a listing appointment, after a showing, when a
          lead calls. It answers with the SpaceMatch way and points you to the right
          Hub page. Talk or type. Takes 2 minutes.
        </p>
      </header>

      {needsUpdate && (
        <div className="rounded-2xl bg-amber-50 p-4 text-[15px] text-amber-950 ring-1 ring-amber-200" data-testid="muse-update">
          <b>New version of your coach file ({version.label}).</b> Do step 2 again and add
          "Replace my old SpaceMatch coach file with this one."
        </div>
      )}
      {upToDate && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-[15px] text-emerald-900 ring-1 ring-emerald-200" data-testid="muse-done">
          <Check className="size-5" /> Your coach file is up to date ({version.label}). Try a question below.
        </div>
      )}

      <ol className="space-y-4">
        <li className="flex gap-4 rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]">
          <StepNum n={1} done={opened || !!sentVersion} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="text-[18px] font-semibold">Open Muse</div>
              <p className="text-[15px] leading-relaxed text-stone-600">
                Sign in with your Instagram or Facebook account. On your phone, get the
                "Muse from Meta" app (the page shows App Store and Google Play links).
                If it offers WhatsApp, say yes: then you can text your coach like a
                contact.
              </p>
            </div>
            <a
              href={MUSE_URL}
              target="_blank"
              rel="noopener"
              onClick={() => setOpened(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0A0A0A] px-4 py-2.5 text-[16px] font-semibold text-white hover:bg-[#2a2723]"
              data-testid="muse-open"
            >
              Open Muse <ExternalLink className="size-4" />
            </a>
          </div>
        </li>

        <li className="flex gap-4 rounded-2xl bg-white p-5 ring-2 ring-[#9C7434]">
          <StepNum n={2} done={upToDate} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="text-[18px] font-semibold">Send your coach file to Muse</div>
              <p className="text-[15px] leading-relaxed text-stone-600">
                On your phone: tap the button, then pick <b>Muse</b> in the share list.
                On a computer: it downloads, so drag it into your Muse chat.
                {firstName ? ` It's made for you, ${firstName}.` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={sendFile}
                disabled={!file}
                className="inline-flex items-center gap-2 rounded-xl bg-[#9C7434] px-5 py-3 text-[17px] font-semibold text-white hover:bg-[#87632b] disabled:opacity-60"
                data-testid="muse-send"
              >
                <Send className="size-5" /> {file ? "Send to Muse" : "Preparing your file…"}
              </button>
              <button
                type="button"
                onClick={() => {
                  download();
                  markSent();
                }}
                disabled={!file}
                className="inline-flex items-center gap-2 rounded-xl bg-[#F7F5F1] px-4 py-3 text-[15px] font-semibold text-[#7a5a27] ring-1 ring-[#e4d9c4] disabled:opacity-60"
                data-testid="muse-download"
              >
                <Download className="size-4" /> Download PDF
              </button>
            </div>
          </div>
        </li>

        <li className="flex gap-4 rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]">
          <StepNum n={3} done={copied && upToDate} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="text-[18px] font-semibold">Paste the message and send</div>
              <p className="text-[15px] leading-relaxed text-stone-600">
                We copied it for you in step 2. In Muse, press and hold the message box,
                tap <b>Paste</b>, then send. Muse replies "Coach ready" and from then on
                it coaches you the SpaceMatch way. It also texts you 3 tasks from the
                90-day plan every weekday at 8am.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyMsg}
                className="inline-flex items-center gap-2 rounded-xl bg-[#F7F5F1] px-4 py-2.5 text-[15px] font-semibold text-[#7a5a27] ring-1 ring-[#e4d9c4]"
                data-testid="muse-copy"
              >
                <Copy className="size-4" /> {copied ? "Copy again" : "Copy message"}
              </button>
              <button type="button" onClick={() => setShowMsg(s => !s)} className="text-[15px] font-semibold text-[#9C7434] hover:underline">
                {showMsg ? "Hide message" : "See the message"}
              </button>
            </div>
            {showMsg && (
              <pre className="whitespace-pre-wrap rounded-xl bg-[#F7F5F1] p-4 font-sans text-[15px] leading-relaxed text-stone-800" data-testid="muse-message">
                {message}
              </pre>
            )}
          </div>
        </li>
      </ol>

      <section className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]">
        <h2 className="font-['Playfair_Display'] text-xl font-semibold">Try it: tap one, paste it in Muse</h2>
        <p className="text-[15px] text-stone-600">
          Or just talk to it. Every playbook and Hub Guide situation also has an <b>Ask Muse</b> button.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {TRY_PROMPTS.map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => openMuseWith(p.text)}
              className="flex items-center justify-between gap-2 rounded-xl bg-[#F7F5F1] px-4 py-3 text-left text-[15px] font-semibold text-stone-800 ring-1 ring-[#e4d9c4] hover:bg-[#efe7d8]"
              data-testid="muse-try"
            >
              {p.label} <Sparkles className="size-4 shrink-0 text-[#9C7434]" />
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]">
        <h2 className="flex items-center gap-2 font-['Playfair_Display'] text-xl font-semibold">
          <ShieldCheck className="size-5 text-[#9C7434]" /> 4 rules
        </h2>
        <ul className="space-y-2.5">
          {MUSE_RULES.map(r => (
            <li key={r} className="flex gap-3 text-[15px] leading-relaxed text-stone-700">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#9C7434]" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
        <p className="text-[14px] text-stone-500">
          Muse is free up to a usage limit, then Meta charges for its paid plans; most agents
          won't need one. US and Canada only. When we update the playbooks, the Hub posts an
          announcement and this page shows a "new version" note.
        </p>
      </section>
    </div>
  );
}
