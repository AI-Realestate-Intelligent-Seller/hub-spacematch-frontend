// Market myself on the new backend: past clients and the open house calendar.
import { apiGet, apiSend } from "./apiData";

export interface PastClient {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  closedOn: string;
  side: string;
  done: string[];
  createdAt: number;
}

export interface ClientInput {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  closedOn: string;
  side: string;
}

export interface OpenHouseSlot {
  _id: string;
  listingId?: string;
  address: string;
  date: string;
  start: string;
  end: string;
  listingAgent: string;
  hostEmail?: string;
  hostName?: string;
  notes?: string;
  createdByEmail: string;
  mine: boolean;
  canEdit: boolean;
}

export interface OpenHousesData {
  me: string;
  isStaff: boolean;
  listings: { _id: string; address: string; agentName: string }[];
  slots: OpenHouseSlot[];
}

const enc = encodeURIComponent;

export const pastClientsApi = {
  list: () => apiGet<{ items: PastClient[] }>("/past-clients"),
  add: (input: ClientInput) => apiSend<PastClient>("POST", "/past-clients", input),
  update: (id: string, input: ClientInput) => apiSend<PastClient>("PUT", `/past-clients/${enc(id)}`, input),
  remove: (id: string) => apiSend<{ ok: true }>("DELETE", `/past-clients/${enc(id)}`),
  markTouch: (id: string, key: string, done: boolean) => apiSend<PastClient>("PUT", `/past-clients/${enc(id)}/touches`, { key, done }),
};

export const openHousesApi = {
  list: () => apiGet<OpenHousesData>("/open-houses"),
  add: (input: { listingId: string | null; address: string | null; date: string; start: string; end: string; hostMe: boolean; notes: string | null }) =>
    apiSend<OpenHouseSlot>("POST", "/open-houses", input),
  claim: (id: string, claim: boolean) => apiSend<OpenHouseSlot>("PUT", `/open-houses/${enc(id)}/host`, { claim }),
  remove: (id: string) => apiSend<{ ok: true }>("DELETE", `/open-houses/${enc(id)}`),
};

// ---------- Settings, Google reviews, market update kit ----------

export interface MarketSettings {
  email: string;
  name: string;
  phone: string;
  slug: string;
  isAgent: boolean;
  isStaff: boolean;
  reviewUrl: string;
  areas: string[];
  teamReviewUrl: string;
}

export interface ReviewsData {
  rows: { _id: string; token: string; clientName: string; channel: string; target: string; createdAt: number; opened: boolean; clicked: boolean; note?: string }[];
  sent: number;
  opened: number;
  clicked: number;
  mentions?: { count: number; total: number; at: number };
  team: { agentName: string; sent: number; opened: number; clicked: number; mentions: number }[];
}

export interface StatRow {
  month: string;
  sales?: number;
  median?: number;
  yoyPct?: number;
  domMedian?: number;
  soldToList?: number;
  active?: number;
  monthsSupply?: number;
  source: string;
}

export interface MarketKit {
  areas: { area: string; mred?: StatRow; mine?: StatRow }[];
}

export interface ReviewView {
  clientFirst: string;
  agentName: string;
  agentSlug: string;
  agentPhone: string;
  reviewUrl: string;
  team: boolean;
  noteSent: boolean;
}

export const marketMeApi = {
  settings: () => apiGet<MarketSettings>("/market-me/settings"),
  saveSettings: (patch: { reviewUrl?: string; areas?: string[] }) => apiSend<MarketSettings>("PATCH", "/market-me/settings", patch),
  reviews: () => apiGet<ReviewsData>("/market-me/reviews"),
  createReview: (clientName: string, channel: "text" | "email" | "copy") => apiSend<{ token: string }>("POST", "/market-me/reviews", { clientName, channel }),
  marketKit: () => apiGet<MarketKit>("/market-me/market-kit"),
  enterStats: (input: { area: string; month: string; median: number; sales: number; domMedian: number; active: number }) =>
    apiSend<MarketKit>("PUT", "/market-me/market-stats", input),
  // Public review page (no login)
  reviewView: (token: string) => apiGet<ReviewView>(`/public/reviews/${enc(token)}`),
  reviewPing: (token: string, event: "open" | "click") => apiSend<{ ok: boolean }>("POST", `/public/reviews/${enc(token)}/${event}`, undefined, false),
  reviewNote: (token: string, note: string) => apiSend<{ ok: boolean }>("POST", `/public/reviews/${enc(token)}/note`, { note }, false),
};
