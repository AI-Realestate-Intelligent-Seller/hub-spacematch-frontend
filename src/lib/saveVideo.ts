// Save a video to the device (Michael 2026-11-12: "on apple phones it does not show download").
// iPhone's built-in player has no Download item, and a plain link just plays the file. So:
//   phones  → fetch the file, then the share sheet ("Save Video" on iPhone, save to device on Android)
//   desktop → a normal file download
// iPhone only opens the share sheet straight from a tap. A slow download uses that tap up, so the
// caller keeps the file and asks for one more tap ("needs-tap"); that second tap always works.
import { useCallback, useEffect, useRef, useState } from "react";

export type SaveResult = "shared" | "downloaded" | "cancelled" | "needs-tap";
export type SaveState = "idle" | "loading" | "ready" | "saved";

const isPhone = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

export const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export const videoFileName = (...parts: (string | undefined)[]) =>
  `${parts.filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90) || "video"}.mp4`;

export async function fetchVideoFile(url: string, name: string, onProgress?: (pct: number) => void): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !total) return new File([await res.blob()], name, { type: "video/mp4" });
  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress?.(Math.min(99, Math.round((got / total) * 100)));
  }
  return new File(chunks, name, { type: "video/mp4" });
}

function downloadFile(file: File) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** `lastTry`: this call came straight from a tap, so if the share sheet still refuses, download instead. */
export async function saveVideoFile(file: File, title: string, lastTry = false): Promise<SaveResult> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (isPhone() && typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch (e) {
      const n = (e as Error).name;
      if (n === "AbortError") return "cancelled";
      if (n === "NotAllowedError" && !lastTry) return "needs-tap";
    }
  }
  downloadFile(file);
  return "downloaded";
}

/** One button, two possible taps: Download (fetch, then save) and, only if the phone asks, "Tap to save". */
export function useSaveVideo(url: string | null | undefined, fileName: string, title: string) {
  const [state, setState] = useState<SaveState>("idle");
  const [pct, setPct] = useState(0);
  const file = useRef<{ url: string; file: File } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new video starts over
  useEffect(() => { file.current = null; setState("idle"); setPct(0); }, [url]);
  const run = useCallback(async () => {
    if (!url || state === "loading") return;
    const finish = (r: SaveResult) => {
      if (r === "needs-tap") return setState("ready");
      setState(r === "cancelled" ? "idle" : "saved");
      if (r !== "cancelled") setTimeout(() => setState(s => (s === "saved" ? "idle" : s)), 4000);
    };
    // Already fetched: save right inside this tap, which every phone allows.
    if (file.current?.url === url) return finish(await saveVideoFile(file.current.file, title, true));
    setState("loading");
    setPct(0);
    try {
      const f = await fetchVideoFile(url, fileName, setPct);
      file.current = { url, file: f };
      finish(await saveVideoFile(f, title));
    } catch (e) {
      setState("idle");
      throw e;
    }
  }, [url, state, fileName, title]);
  return { state, pct, run };
}
