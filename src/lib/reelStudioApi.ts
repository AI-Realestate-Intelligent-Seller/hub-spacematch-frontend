import { api } from "./api";
import { notifyDataChanged, useApiData } from "./apiData";

export type ReelClip = { id: string; name: string; link: string; size: number; mimeType: string; role?: string };
type Payment = { code: string; amount: number; kind: string; status: string; test?: boolean; sentAt?: number; note?: string };
type Order = {
  _id: string; agentName: string; tierName: string; status: string; statusLabel: string; statusNote?: string;
  createdAt: number; queuedAt?: number; pickedUpAt?: number; stageAt?: number; stage?: string;
  free: boolean; testOrder: boolean; price: number; paid: number; notes?: string; question?: string; options: unknown;
  clips: { id: string; name: string; role?: string }[]; openPayment: Payment | null; payments: Payment[];
  revisions: { n: number; at: number; note: string; paid: boolean; kind?: string }[];
  freeRevisionsLeft: number; canEditCaptions: boolean; captionLines: { i: number; start: number; end: number; text: string }[]; version: number;
  outputs: { format: string; url: string; version: number; size?: number }[]; queueAhead: number | null; sampleUrl: string | null;
  costUsd: number; costCredits: number; deliveryNote?: string;
};
type StudioConfig = { isStaff: boolean; isAdmin: boolean; canConfirm: boolean; canTestPayments: boolean; toConfirm: number; zelleTo: string; myCell: string | null; agents: { name: string; email: string }[] };
const query = (as?: string) => as ? `?as=${encodeURIComponent(as)}` : "";
const prefix = "/reel-studio";
const get = <T>(path: string) => api<T>(prefix + path);
async function send<T>(path: string, data: unknown, notify = true) {
  const result = await api<T>(prefix + path, { method: "POST", body: JSON.stringify(data) });
  if (notify) notifyDataChanged();
  return result;
}
export const useReelConfig = () => useApiData("reel-studio:config", () => get<StudioConfig>("/config"));
export type ReelConfigResult = ReturnType<typeof useReelConfig>;
export const useReels = (as?: string) => useApiData(`reel-studio:orders:${as ?? ""}`, () => get<Order[]>(`/orders${query(as)}`), {
  pollMs: 5000,
  pollWhen: orders => !!orders?.some(order => ["payment_sent", "queued", "editing"].includes(order.status)),
});
export const useReelQueue = () => useApiData("reel-studio:queue", () => get<{ orders: Order[]; isStaff: boolean; canConfirm: boolean; canTestPayments: boolean; totals: { revenue: number; owedToConfirm: number; cost: number } }>("/queue"), { pollMs: 5000 });
export const useReelFree = (as?: string) => useApiData(`reel-studio:free:${as ?? ""}`, () => get<{ left: number; total: number }>(`/free${query(as)}`)).data;
export const useReelAssets = (as?: string) => useApiData(`reel-studio:assets:${as ?? ""}`, () => get<ReelClip[]>(`/assets${query(as)}`)).data;
export const useReelDrive = (as?: string) => useApiData(`reel-studio:drive:${as ?? ""}`, () => get<{ email: string; checkedAt: number; files: ReelClip[] }>(`/drive${query(as)}`));
export const placeReel = (data: unknown) => send<string>("/orders", data);
export const reelAction = (action: string) => ({ id, ...body }: { id: string } & Record<string, unknown>) =>
  send<{ ok: boolean; needsPayment: boolean }>(`/orders/${encodeURIComponent(id)}/actions`, { ...body, action });

function putPart(url: string, body: Blob, progress: (bytes: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = event => progress(event.loaded);
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`));
    xhr.onerror = () => reject(new Error("Could not reach storage."));
    xhr.ontimeout = () => reject(new Error("Upload timed out."));
    xhr.timeout = 115_000;
    xhr.send(body);
  });
}

export async function uploadReelClip(file: File, as?: string, progress: (bytes: number) => void = () => {}) {
  const { id, urls, chunkSize } = await send<{ id: string; urls: string[]; chunkSize: number }>("/assets", {
    as, name: file.name, mimeType: file.type.startsWith("video/") ? file.type : "video/mp4", size: file.size,
  }, false);
  let index = 0;
  let failure: unknown;
  const loaded = urls.map(() => 0);
  async function worker() {
    while (index < urls.length && !failure) {
      const part = index++;
      const blob = file.slice(part * chunkSize, (part + 1) * chunkSize);
      for (let attempt = 1; ; attempt++) {
        try {
          await putPart(urls[part]!, blob, bytes => {
            loaded[part] = bytes;
            progress(loaded.reduce((total, n) => total + n, 0));
          });
          loaded[part] = blob.size;
          break;
        } catch (error) {
          loaded[part] = 0;
          if (attempt === 3) {
            failure = error;
            return;
          }
          if (failure) return;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  if (failure) throw failure;
  return send<ReelClip>(`/assets/${encodeURIComponent(id)}/complete`, { as });
}
