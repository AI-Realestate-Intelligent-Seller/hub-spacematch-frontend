// Feedback board on the new backend (backend/src/modules/feedback).
import { ApiError } from "./api";
import { apiGet, apiSend } from "./apiData";

export interface FeedbackItem {
  _id: string;
  fromEmail: string;
  fromName: string;
  kind: string;
  area: string;
  title: string;
  details: string;
  blocking?: boolean;
  category: string;
  status: string;
  priority?: string;
  estimate?: string;
  decisionNote?: string;
  decidedBy?: string;
  decidedAt?: number;
  shippedAt?: number;
  createdAt: number;
  votes: number;
  voted: boolean;
  mine: boolean;
  shotUrl?: string;
}

export const SHOT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_SHOT_BYTES = 4 * 1024 * 1024;

const enc = encodeURIComponent;
const API_BASE = `${import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "") ?? ""}/api/v1`;

export const feedbackApi = {
  list: () => apiGet<{ items: FeedbackItem[]; isAdmin: boolean; myId: string }>("/feedback"),
  /** Sends the image itself (4 MB max) and returns its storage key. */
  uploadShot: async (file: File): Promise<string> => {
    const res = await fetch(`${API_BASE}/feedback/screenshots`, { method: "POST", credentials: "include", headers: { "Content-Type": file.type }, body: file });
    const body = await res.json().catch(() => undefined);
    if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? "upload_failed", body?.error?.message ?? "Couldn't upload the screenshot.");
    return body.key as string;
  },
  create: (input: { kind: string; area: string; title: string; details: string; blocking?: boolean; shotKey?: string | null }) => apiSend<FeedbackItem>("POST", "/feedback", input),
  vote: (id: string) => apiSend<{ voted: boolean }>("POST", `/feedback/${enc(id)}/vote`),
  decide: (id: string, status: string, note?: string | null, category?: string) =>
    apiSend<FeedbackItem>("POST", `/feedback/${enc(id)}/decision`, { status, ...(note ? { note } : {}), ...(category ? { category } : {}) }),
  remove: (id: string) => apiSend<{ ok: true }>("DELETE", `/feedback/${enc(id)}`),
};
