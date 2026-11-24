// "Talk it in" (Michael 2026-11-22, all agents): one tap, say the property, the form fills itself.
// Live transcript = Viktor speech (useRealtimeTranscription); parsing = voiceFill.parseCmaDictation.
// Hands-free finish: say "that's it" / "done", or pause ~6 s. The agent reviews and submits as usual.
import { useAction } from "convex/react";
import { Loader2, Mic, Square, Undo2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AGENTS } from "@/lib/agents";
import { useRealtimeTranscription } from "@/lib/viktor-speech/useRealtimeTranscription";
import { api } from "../../../convex/_generated/api";

export type VoiceResult = Record<string, unknown>;

const AUTO_FINISH_MS = 6000;
// A whole utterance that is only a stop word ("done", "okay that's it"), or a sentence ending in an
// unambiguous one ("... seller wants 650. That's it."). Bare "done" mid-sentence ("kitchen was done") never stops.
const DONE_ONLY = /^(?:ok(?:ay)?[\s,]+)?(?:that'?s it|that is it|i'?m done|all done|done|finished|fill it(?: in)?)[.!\s]*$/i;
const DONE_TAIL = /[\s,.]+(?:ok(?:ay)?[\s,]+)?(?:that'?s it|that is it|i'?m done|all done)[.!\s]*$/i;
const isDone = (s: string) => DONE_ONLY.test(s.trim()) || DONE_TAIL.test(` ${s.trim()}`);
const stripDone = (finals: string[]) =>
  finals.filter(f => !DONE_ONLY.test(f.trim())).join(" ").replace(DONE_TAIL, "").trim();

const PLACES = [
  "Evanston", "Wilmette", "Winnetka", "Skokie", "Glenview", "Northbrook", "Highland Park", "Kenilworth",
  "Glencoe", "Lincolnwood", "Morton Grove", "Niles", "Park Ridge", "Des Plaines", "Oak Park", "River Forest",
  "Rogers Park", "Edgewater", "Andersonville", "Lincoln Square", "Ravenswood", "Uptown", "Lakeview",
  "Lincoln Park", "Bucktown", "Wicker Park", "Logan Square", "River North", "West Loop", "Albany Park",
  "North Center", "Roscoe Village",
];
const TERMS = ["SpaceMatch", "CMA", "HOA", "MLS", "townhome", "two-flat", "three-flat", "walkout", "LVP"];

export function VoiceFill({
  mode = "sale",
  kind,
  options,
  onFill,
  onUndo,
}: {
  /** "sale" = /new (parseCmaDictation); "lease" = /lease (parseLeaseDictation). */
  mode?: "sale" | "lease";
  kind: "residential" | "commercial";
  /** sale: propertyTypes/conditions/basements/purposes/upgradeItems; lease: the form's choice lists by field. */
  options: Record<string, string[]>;
  /** Merge a parsed result into the form; returns the labels of the fields it filled. */
  onFill: (r: VoiceResult) => string[];
  onUndo: () => void;
}) {
  const parseSale = useAction(api.voiceFill.parseCmaDictation);
  const parseLease = useAction(api.voiceFill.parseLeaseDictation);
  const [phase, setPhase] = useState<"idle" | "talking" | "reading" | "done">("idle");
  const [filled, setFilled] = useState<string[]>([]);
  const [heard, setHeard] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const finishRef = useRef<() => void>(() => {});
  const silence = useRef<number | null>(null);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);

  const keyterms = [...AGENTS.map(a => a.name), ...PLACES, ...TERMS].slice(0, 50);
  const t = useRealtimeTranscription({
    languageCode: "en",
    keyterms,
    vadSilenceSeconds: 1.2,
    onFinal: text => {
      if (isDone(text)) finishRef.current();
    },
  });

  const clearSilence = () => {
    if (silence.current) window.clearTimeout(silence.current);
    silence.current = null;
  };
  const releaseWake = () => {
    wake.current?.release().catch(() => {});
    wake.current = null;
  };

  const finish = async () => {
    if (phase !== "talking") return;
    clearSilence();
    setPhase("reading");
    await t.stop();
  };
  finishRef.current = () => void finish();

  // After stop(): parse the full transcript once the last final has landed.
  useEffect(() => {
    if (phase !== "reading" || t.isActive) return;
    releaseWake();
    const text = stripDone(t.finals);
    if (text.length < 8) {
      setPhase("idle");
      setErr("I didn't catch that. Tap the mic and try again.");
      return;
    }
    setHeard(text);
    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const iso = new Date().toLocaleDateString("en-CA");
    const args = { transcript: text, kind, today: `${today} (${iso})` };
    const o = options;
    (mode === "lease"
      ? parseLease({ ...args, enums: o })
      : parseSale({
          ...args,
          propertyTypes: o.propertyTypes ?? [],
          conditions: o.conditions ?? [],
          basements: o.basements ?? [],
          purposes: o.purposes ?? [],
          upgradeItems: o.upgradeItems ?? [],
        }))
      .then(r => {
        const labels = onFill(r);
        setFilled(labels);
        setPhase("done");
        setErr(labels.length ? null : "I couldn't place anything from that. Try again with the address first.");
      })
      .catch(e => {
        setPhase("idle");
        setErr(e?.data?.message ?? (typeof e?.data === "string" ? e.data : null) ?? "Couldn't read that. Try again.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, t.isActive]);

  // Hands-free finish: ~6 s with nothing new said.
  useEffect(() => {
    if (phase !== "talking" || !t.isListening) return;
    clearSilence();
    if (!t.transcript.trim()) return;
    silence.current = window.setTimeout(() => finishRef.current(), AUTO_FINISH_MS);
    return clearSilence;
  }, [phase, t.isListening, t.transcript]);

  // Session ended on its own (phone locked, 60 s quiet, 15 min cap): parse what we have.
  useEffect(() => {
    if (phase === "talking" && (t.state === "ended" || t.state === "error")) {
      if (t.finals.length) setPhase("reading");
      else {
        setPhase("idle");
        releaseWake();
        if (t.error) setErr(t.error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.state]);

  useEffect(() => () => { clearSilence(); releaseWake(); }, []);

  const begin = () => {
    setErr(null);
    setFilled([]);
    setHeard("");
    t.reset();
    setPhase("talking");
    void t.start();
    // Keep the screen on while talking (phone in a car mount); ignored where unsupported.
    const nav = navigator as Navigator & { wakeLock?: { request: (k: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then(l => { wake.current = l; }).catch(() => {});
  };

  if (t.state === "unavailable") return null;
  const talking = phase === "talking";
  const reading = phase === "reading";
  const connecting = talking && (t.state === "connecting" || t.state === "retrying");

  return (
    <div
      className="rounded-2xl bg-[#0A0A0A] text-white p-4 sm:p-5 shadow-lg"
      data-testid="voice-fill"
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={talking ? () => void finish() : begin}
          disabled={reading}
          aria-label={talking ? "Stop and fill the form" : "Talk it in"}
          data-testid="voice-mic"
          className={`relative grid size-16 sm:size-20 shrink-0 place-items-center rounded-full shadow-lg transition-transform active:scale-95 disabled:opacity-60 ${
            talking ? "bg-red-600 text-white" : "bg-white text-[#0A0A0A] hover:bg-stone-200"
          }`}
        >
          {talking && !connecting && (
            <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" aria-hidden />
          )}
          {reading || connecting ? (
            <Loader2 className="size-8 animate-spin" />
          ) : talking ? (
            <Square className="size-7 fill-white" />
          ) : (
            <Mic className="size-8" />
          )}
        </button>
        <div className="min-w-0 space-y-0.5">
          <div className="text-xl font-bold text-white">
            {talking
              ? connecting ? "Starting the mic…" : "Listening… talk naturally"
              : reading ? "Filling in your form…"
              : phase === "done" ? "Done. Check it, then submit" : "Talk it in"}
          </div>
          <p className="text-base text-stone-300">
            {talking
              ? <>Say <strong>"that's it"</strong> or pause when you're done. Or tap the red button.</>
              : reading ? "Reading what you said."
              : phase === "done" ? "Tap the mic again to add more."
              : mode === "lease"
                ? <>Tap and say the address, client, beds and baths (or square feet), parking, laundry, the rent they want and when you need it. Good for the car: no typing.</>
                : <>Tap and say the address, client, beds and baths, upgrades with years, the seller's price and when you need it. Good for the car: no typing.</>}
          </p>
        </div>
      </div>

      {(talking || reading) && t.transcript && (
        <p className="mt-3 rounded-xl bg-white/10 border border-white/20 p-3 text-base leading-relaxed text-white" data-testid="voice-live" aria-live="polite">
          {t.finals.join(" ")} <span className="text-stone-400">{t.partial}</span>
        </p>
      )}

      {phase === "done" && filled.length > 0 && (
        <div className="mt-3 space-y-2" data-testid="voice-filled">
          <div className="flex flex-wrap gap-1.5">
            <Sparkles className="size-4 text-white mt-1" />
            {filled.map(f => (
              <span key={f} className="rounded-full bg-white px-2.5 py-0.5 text-sm font-semibold text-[#0A0A0A]">{f}</span>
            ))}
          </div>
          <details className="text-sm text-stone-300">
            <summary className="cursor-pointer">What I heard</summary>
            <p className="mt-1 italic">"{heard}"</p>
          </details>
          <Button type="button" variant="outline" size="sm" className="bg-transparent text-white border-white/40 hover:bg-white/10 hover:text-white" onClick={() => { onUndo(); setFilled([]); setPhase("idle"); }} data-testid="voice-undo">
            <Undo2 className="size-4" /> Undo voice fill
          </Button>
        </div>
      )}

      {err && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-300" data-testid="voice-error">
          {err}
          {(t.state === "unreachable" || t.state === "retrying") && (
            <Button type="button" variant="link" size="sm" className="text-white" onClick={t.retry}>Try again</Button>
          )}
        </p>
      )}
      {!err && t.error && talking && (
        <p role="alert" className="mt-3 text-sm text-red-300">{t.error}</p>
      )}
    </div>
  );
}
