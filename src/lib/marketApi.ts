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
