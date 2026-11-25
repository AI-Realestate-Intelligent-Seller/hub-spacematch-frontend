// Listings module on the new Express backend (backend/src/modules/listings).
// Replaces convex/listings.ts + convex/suggestions.ts for the listing pages and the seller portal.
//
// The API sends `id` and ISO dates; the pages were written against Convex (`_id`, millisecond
// timestamps, missing = undefined). fromApi() converts responses to that shape so the pages
// keep working with small changes.
import { api } from "./api";

// ---------- Types (as the pages see them, after fromApi) ----------

export type LaunchStep = { key: string; done: boolean; doneAt?: number; note?: string };
export type ListingLinks = { zillow?: string; website?: string; reel?: string; tour?: string; youtube?: string; tiktok?: string; facebook?: string };

export interface Listing {
  _id: string;
  address: string;
  mlsNumber?: string;
  priceCents?: number;
  price?: string; // "$549,000"
  status: string;
  photoUrl?: string;
  agentUserId?: string;
  agentEmail: string;
  agentName: string;
  sellerName: string;
  sellerEmail?: string;
  sellerPhone?: string;
  token: string;
  steps: LaunchStep[];
  links: ListingLinks;
  liveDate?: string;
  zillowPage?: { url: string; views: number; saves: number; checkedAt: number; price?: number; homeStatus?: string };
  loftyLeadId?: string;
  loftyError?: string;
  loftyAt?: number;
  reelAuto?: { mediaId: string; permalink: string; views: number; matchedBy: string; checkedAt: number };
  ytAuto?: { videoId: string; url: string; title: string; views: number; matchedBy: string; checkedAt: number };
  weeklyEmail: boolean;
  sellerLastSeenAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ListingSummary {
  _id: string;
  address: string;
  status: string;
  agentName: string;
  sellerName: string;
  photoUrl?: string;
  price?: string;
  stepsDone: number;
  stepsTotal: number;
  pending: number;
  showings: number;
  numbersThisWeek: boolean;
  adsRunning: number;
  sellerLastSeenAt?: number;
  updatedAt: number;
}

export interface ListingEvent {
  _id: string;
  listingId: string;
  kind: string;
  status: "pending" | "published" | "hidden";
  title: string;
  body?: string;
  interest?: string;
  priceOpinion?: string;
  rating?: string;
  when?: string;
  agentOnly?: string;
  source: string;
  createdAt: number;
}

export const METRIC_KEYS = [
  "zillowViews", "zillowSaves", "mlsSaved", "mlsMaybe", "mlsNotInterested",
  "adViews", "adClicks", "reelViews", "tiktokViews", "fbViews", "youtubeViews",
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export type ListingMetric = { _id: string; listingId: string; weekOf: string; auto?: string[]; enteredByEmail: string; updatedAt: number } & Partial<Record<MetricKey, number>>;

export interface ListingSuggestion {
  _id: string;
  listingId: string;
  ruleKey: string;
  title: string;
  why: string;
  action: string;
  status: "draft" | "published" | "dismissed";
  approvedAt?: number;
  stillTrue: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ListingDetail {
  listing: Listing;
  events: ListingEvent[];
  metrics: ListingMetric[];
  openHouse: { _id: string; name: string; at: number; status: string }[];
  thisWeek: string;
  me: { email: string; staff: boolean };
}

export interface PickedListing {
  _id: string;
  address: string;
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  mlsNumber: string;
  price: string;
  status: string;
  agentName: string;
  agentEmail: string;
  sellerName: string;
  sellerEmail: string;
  sellerPhone: string;
  photoUrl: string;
  zillow: string;
  website: string;
}

export interface ShowingInboxRow {
  _id: string;
  subject: string;
  address: string;
  mls?: string;
  createdAt: number;
}

export interface AgentOption {
  _id: string;
  name: string;
  email: string;
  role: string;
}

export interface PortalData {
  address: string;
  price?: string;
  status: string;
  photoUrl?: string;
  liveDate?: string;
  links: ListingLinks;
  sellerFirstName: string;
  agent: { name: string; phone?: string; email?: string };
  steps: LaunchStep[];
  metrics: ({ weekOf: string; auto: string[]; updatedAt: number } & Partial<Record<MetricKey, number>>)[];
  counts: { showings: number; feedback: number; openHouse: number };
  events: { _id: string; kind: string; title: string; body?: string; interest?: string; priceOpinion?: string; rating?: string; when?: string; createdAt: number }[];
  // biome-ignore lint/suspicious/noExplicitAny: ad campaigns are a later slice; SellerAdCampaigns types its own rows
  ads: any[];
  social: { reelCheckedAt?: number; youtubeCheckedAt?: number };
  suggestions: { _id: string; title: string; why: string; action: string; approvedAt?: number }[];
  zillowTotals?: { views: number; saves: number };
  updatedAt: number;
}

// ---------- Inputs ----------

export interface NewListingInput {
  address: string;
  mlsNumber?: string | null;
  priceCents?: number | null;
  sellerName: string;
  sellerEmail?: string | null;
  sellerPhone?: string | null;
  agentUserId?: string | null;
}

export type ListingPatch = Partial<{
  address: string;
  mlsNumber: string | null;
  priceCents: number | null;
  status: string;
  photoUrl: string | null;
  sellerName: string;
  sellerEmail: string | null;
  sellerPhone: string | null;
  liveDate: string | null;
  weeklyEmail: boolean;
  links: Partial<Record<keyof ListingLinks, string | null>>;
}>;

export type MetricsInput = Partial<Record<MetricKey, number | null>> & { tiktokLink?: string | null; facebookLink?: string | null };

import { fromApi, notifyDataChanged } from "./apiData";

export { apiErrorMessage, fieldErrors, fromApi, useApiData as useListingsData } from "./apiData";
/** Tells every mounted view to reload (kept for older imports). */
export const notifyListingsChanged = notifyDataChanged;

const get = async <T>(path: string) => fromApi<T>(await api<unknown>(path));
const send = async <T>(method: "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown, notify = true) => {
  const r = fromApi<T>(await api<unknown>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }));
  if (notify) notifyListingsChanged();
  return r;
};
const enc = encodeURIComponent;

// ---------- Calls ----------

export const listingsApi = {
  list: (scope: "mine" | "all") => get<{ items: ListingSummary[]; me: { email: string; staff: boolean } }>(`/listings?scope=${scope}`),
  get: (id: string) => get<ListingDetail>(`/listings/${enc(id)}`),
  pick: () => get<{ items: PickedListing[] }>("/listings/pick"),
  agents: () => get<{ items: AgentOption[] }>("/listings/agents"),

  create: (input: NewListingInput) => send<Listing>("POST", "/listings", input),
  update: (id: string, patch: ListingPatch) => send<Listing>("PATCH", `/listings/${enc(id)}`, patch),
  remove: (id: string) => send<{ ok: true }>("DELETE", `/listings/${enc(id)}`),
  rotateLink: (id: string) => send<Listing>("POST", `/listings/${enc(id)}/rotate-link`),
  linkLofty: (id: string) => send<Listing>("POST", `/listings/${enc(id)}/link-lofty`),
  toggleStep: (id: string, key: string, done: boolean, note?: string | null) =>
    send<Listing>("PATCH", `/listings/${enc(id)}/steps/${enc(key)}`, note === undefined ? { done } : { done, note }),
  saveMetrics: (id: string, weekOf: string, input: MetricsInput) => send<{ metrics: ListingMetric[] }>("PUT", `/listings/${enc(id)}/metrics/${enc(weekOf)}`, input),

  addEvent: (id: string, input: { kind: "update" | "offer" | "showing" | "feedback"; title: string; body?: string | null; when?: string | null }) =>
    send<ListingEvent>("POST", `/listings/${enc(id)}/events`, input),
  addParsedShowing: (id: string, parsed: unknown) => send<ListingEvent>("POST", `/listings/${enc(id)}/events/showingtime`, parsed),
  setEventStatus: (eventId: string, status: ListingEvent["status"], body?: string | null) =>
    send<ListingEvent>("PATCH", `/listings/events/${enc(eventId)}`, body === undefined ? { status } : { status, body }),
  removeEvent: (eventId: string) => send<{ ok: true }>("DELETE", `/listings/events/${enc(eventId)}`),

  showingInbox: () => get<{ items: ShowingInboxRow[] }>("/listings/showing-inbox"),
  assignInbox: (inboxId: string, listingId: string) => send<{ ok: true }>("POST", `/listings/showing-inbox/${enc(inboxId)}/assign`, { listingId }),

  suggestions: (id: string) => get<{ items: ListingSuggestion[] }>(`/listings/${enc(id)}/suggestions`),
  refreshSuggestions: async (id: string) => {
    const r = await send<{ added: number }>("POST", `/listings/${enc(id)}/suggestions/refresh`, undefined, false);
    if (r.added) notifyListingsChanged();
    return r;
  },
  addSuggestion: (id: string, input: { title: string; why: string; action: string }) => send<ListingSuggestion>("POST", `/listings/${enc(id)}/suggestions`, input),
  updateSuggestion: (suggestionId: string, patch: Partial<{ title: string; why: string; action: string; status: ListingSuggestion["status"] }>) =>
    send<ListingSuggestion>("PATCH", `/listings/suggestions/${enc(suggestionId)}`, patch),

  // Seller portal (public)
  portal: (token: string) => get<PortalData>(`/portal/${enc(token)}`),
  portalSeen: (token: string) => send<{ ok: true }>("POST", `/portal/${enc(token)}/seen`, undefined, false),
  approvePlan: (token: string) => send<{ ok: true }>("POST", `/portal/${enc(token)}/approve-plan`),
};

