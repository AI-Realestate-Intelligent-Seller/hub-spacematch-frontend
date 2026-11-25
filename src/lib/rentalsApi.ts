// 100% commission rentals on the new backend (backend/src/modules/commission-buildings).
import { apiGet, apiSend } from "./apiData";

export interface Building {
  _id: string;
  name: string;
  address: string;
  neighborhood?: string;
  manager?: string;
  commissionPct: number;
  status: "pays" | "no_pay";
  noPayReason?: "none" | "under" | "unpaid";
  bonus?: string;
  keyRule?: string;
  terms?: string;
  phone?: string;
  email?: string;
  brokerUrl?: string;
  website?: string;
  sourceNote?: string;
  sourceUrl?: string;
  offerEnds?: string;
  verified: boolean;
  verifiedAt?: number;
  verifiedByName?: string;
  verifiedHow?: string;
  flagNote?: string;
  flaggedByName?: string;
  flaggedAt?: number;
  hidden: boolean;
  addedByEmail: string;
  addedByName: string;
  createdAt: number;
}

export interface RentalsData {
  viewer: { email: string; name: string; isAdmin: boolean; canVerify: boolean };
  verifyHow: string[];
  confirmHow: string[];
  items: Building[];
}

export interface BuildingInput {
  name: string | null;
  address: string;
  neighborhood: string | null;
  manager: string | null;
  commissionPct: number;
  status: "pays" | "no_pay";
  noPayReason: "none" | "under" | "unpaid" | null;
  bonus: string | null;
  keyRule: string | null;
  terms: string | null;
  phone: string | null;
  email: string | null;
  brokerUrl: string | null;
  website: string | null;
  sourceNote: string | null;
  sourceUrl: string | null;
  offerEnds: string | null;
}

const enc = encodeURIComponent;

export const rentalsApi = {
  list: () => apiGet<RentalsData>("/commission-buildings"),
  add: (input: BuildingInput & { verify?: boolean; verifiedHow?: string | null }) => apiSend<Building>("POST", "/commission-buildings", input),
  update: (id: string, input: BuildingInput) => apiSend<Building>("PUT", `/commission-buildings/${enc(id)}`, input),
  remove: (id: string) => apiSend<{ ok: true }>("DELETE", `/commission-buildings/${enc(id)}`),
  verify: (id: string, verified: boolean, how?: string) => apiSend<Building>("PUT", `/commission-buildings/${enc(id)}/verification`, how ? { verified, how } : { verified }),
  report: (id: string, note: string) => apiSend<Building>("POST", `/commission-buildings/${enc(id)}/report`, { note }),
  moderate: (id: string, m: { hidden?: boolean; clearReport?: boolean }) => apiSend<Building>("PATCH", `/commission-buildings/${enc(id)}/moderation`, m),
};
