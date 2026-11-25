// CMA requests ("Price a home") on the new backend (backend/src/modules/cma). Replaces convex/cma.ts.
import { ApiError } from "./api";
import { apiGet, apiSend } from "./apiData";
import { typeEmail, typePhone } from "./formRules";

export type CmaStatus = "submitted" | "building" | "needs_info" | "approval" | "ready" | "revision" | "failed";
export type CmaAttachment = { storageId: string; name: string; size: number; contentType?: string; url?: string };

export interface CmaRequest {
  _id: string;
  reportType: "sale" | "lease";
  kind: "residential" | "commercial";
  lease?: Record<string, string>;
  investor?: Record<string, string>;
  commercial?: Record<string, string>;
  attachments: CmaAttachment[];
  agentName: string;
  agentEmail: string;
  agentPhone?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  beds?: string;
  bathsFull?: string;
  bathsHalf?: string;
  sqft?: string;
  yearBuilt?: string;
  basement?: string;
  garage?: string;
  hoaDues?: string;
  condition: string;
  upgrades: { item: string; year?: string; notes?: string }[];
  otherUpgrades?: string;
  knownIssues?: string;
  sellerPriceExpectation?: string;
  timeline?: string;
  purpose: string;
  neededBy?: string;
  branding: string;
  schools?: string;
  compNotes?: string;
  notes?: string;
  submittedByEmail: string;
  status: CmaStatus;
  statusNote?: string;
  valueLow?: number;
  valueHigh?: number;
  listPrice?: number;
  recommendedListPrice?: number;
  agentListPrice?: number;
  agentListPriceNote?: string;
  revisionPending: boolean;
  revisions: { at: number; byEmail: string; type: string; changed: string[]; listPrice?: number; note?: string }[];
  pdfUrl?: string;
  workbookUrl?: string;
  pickedUpAt?: number;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
  /** Convex used _creationTime; kept so older code keeps sorting/showing dates. */
  _creationTime: number;
}

export interface CmaQuota {
  agentUsed: number;
  agentCap: number;
  teamUsed: number;
  teamCap: number;
  pendingApproval: number;
  agentName?: string;
  isAdmin: boolean;
}

/** Same limit as the backend: Supabase's free plan stores files up to 50 MB. */
export const MAX_UPLOAD_MB = 50;

const enc = encodeURIComponent;
const withCreation = (r: CmaRequest): CmaRequest => ({ ...r, _creationTime: r.createdAt });

export const cmaApi = {
  me: () => apiGet<{ name: string; email: string; isAdmin: boolean }>("/cma/me"),
  quota: (agentName?: string) => apiGet<CmaQuota>(`/cma/quota${agentName ? `?agentName=${enc(agentName)}` : ""}`),
  list: async () => (await apiGet<{ items: CmaRequest[] }>("/cma")).items.map(withCreation),
  get: async (id: string) => withCreation(await apiGet<CmaRequest>(`/cma/${enc(id)}`)),
  submit: (payload: unknown) => apiSend<{ _id: string; status: CmaStatus; statusNote?: string }>("POST", "/cma", payload),
  update: (id: string, payload: unknown) => apiSend<{ changed: string[]; status: CmaStatus }>("PUT", `/cma/${enc(id)}`, payload),
  setListPrice: (id: string, listPrice: number, note?: string) => apiSend<{ ok: true }>("POST", `/cma/${enc(id)}/list-price`, note ? { listPrice, note } : { listPrice }),
  decideApproval: (id: string, approve: boolean) => apiSend<{ ok: true }>("POST", `/cma/${enc(id)}/approval`, { approve }),
  /** Uploads one file straight to storage (no size limit from the API) and returns its attachment entry. */
  upload: async (f: File): Promise<CmaAttachment> => {
    const contentType = f.type || "application/octet-stream";
    const { key, uploadUrl } = await apiSend<{ key: string; uploadUrl: string }>("POST", "/cma/uploads", { name: f.name, size: f.size, contentType }, false);
    const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: f });
    if (!res.ok) throw new ApiError(res.status, "upload_failed", `Upload failed for ${f.name}. Try again.`);
    return { storageId: key, name: f.name, size: f.size, contentType: f.type || undefined };
  },
};

// ---------- Field checks (same rules as backend/src/modules/cma/cma.validation.ts) ----------

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

/** Typing filters for the request forms (wrong characters never go in). */
export const CMA_TYPING: Record<string, (v: string) => string> = {
  zip: v => v.replace(/[^\d-]/g, "").slice(0, 10),
  state: v => v.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase(),
  clientPhone: typePhone,
  agentPhone: typePhone,
  clientEmail: typeEmail,
  yearBuilt: v => digits(v, 4),
  beds: v => v.replace(/[^\d.+]/g, "").slice(0, 5),
  bathsFull: v => v.replace(/[^\d+]/g, "").slice(0, 3),
  bathsHalf: v => v.replace(/[^\d+]/g, "").slice(0, 3),
  sqft: v => v.replace(/[^\d,]/g, "").slice(0, 9),
};

/** Problems with the common request fields, as readable sentences (empty when all good). */
export function cmaFieldProblems(f: Record<string, string>): string[] {
  const out: string[] = [];
  const t = (k: string) => (f[k] ?? "").trim();
  if (t("clientName") && !/\p{L}/u.test(t("clientName"))) out.push("Client name needs letters.");
  if (t("clientEmail") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t("clientEmail"))) out.push("Client email doesn't look right.");
  if (t("clientPhone") && t("clientPhone").replace(/\D/g, "").length !== 10) out.push("Client phone must be 10 digits.");
  if (t("street") && !/\d/.test(t("street"))) out.push("The street address needs a house number.");
  if (t("city") && !/^[\p{L}][\p{L}\s.'-]*$/u.test(t("city"))) out.push("City should be letters only.");
  if (t("state") && !/^[A-Za-z]{2}$/.test(t("state"))) out.push("State must be 2 letters, e.g. IL.");
  if (t("zip") && !/^\d{5}(-\d{4})?$/.test(t("zip"))) out.push("ZIP must be 5 digits.");
  if (t("beds") && !/^\d{1,2}(\.\d)?\+?$/.test(t("beds"))) out.push("Beds must be a number, e.g. 3.");
  if (t("bathsFull") && !/^\d{1,2}\+?$/.test(t("bathsFull"))) out.push("Full baths must be a number, e.g. 2.");
  if (t("bathsHalf") && !/^\d{1,2}\+?$/.test(t("bathsHalf"))) out.push("Half baths must be a number, e.g. 1.");
  if (t("sqft") && !/^\d{1,3}(,?\d{3})*$/.test(t("sqft"))) out.push("Square feet must be a number, e.g. 1,850.");
  const y = t("yearBuilt");
  if (y && (!/^\d{4}$/.test(y) || +y < 1800 || +y > new Date().getFullYear() + 2)) out.push(`Year built must be 4 digits between 1800 and ${new Date().getFullYear() + 2}.`);
  return out;
}

/** Field errors from the backend as one readable line (e.g. "ZIP must be 5 digits."). */
export function cmaErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const details = Array.isArray(e.details) ? (e.details as { path?: string; message?: string }[]) : [];
    return details.length ? details.map(d => d.message).filter(Boolean).slice(0, 3).join(" ") : e.message;
  }
  return e instanceof Error ? e.message : "Could not submit";
}
