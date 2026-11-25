// Vendor directory on the new backend (backend/src/modules/vendors). Replaces convex/vendors.ts.
import { apiGet, apiSend } from "./apiData";

export interface Vendor {
  _id: string;
  name: string;
  company?: string;
  category: string;
  subcategory?: string;
  description?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  areas?: string;
  languages?: string;
  perk?: string;
  preferred: boolean;
  hidden: boolean;
  private: boolean;
  onWebsite: boolean;
  addedByEmail: string;
  addedByName: string;
  rating?: number;
  ratingCount: number;
  myRating?: number;
  notes: { by: string; note: string; rating: number }[];
  createdAt: number;
  updatedAt: number;
}

export interface VendorInput {
  name: string;
  company: string | null;
  category: string;
  subcategory: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  areas: string | null;
  languages: string | null;
  perk: string | null;
  private: boolean;
}

const enc = encodeURIComponent;

export const vendorsApi = {
  list: () => apiGet<{ viewer: { email: string; name: string; isAdmin: boolean }; items: Vendor[] }>("/vendors"),
  add: (input: VendorInput) => apiSend<Vendor>("POST", "/vendors", input),
  update: (id: string, input: VendorInput) => apiSend<Vendor>("PUT", `/vendors/${enc(id)}`, input),
  remove: (id: string) => apiSend<{ ok: true }>("DELETE", `/vendors/${enc(id)}`),
  moderate: (id: string, patch: { preferred?: boolean; hidden?: boolean; onWebsite?: boolean }) => apiSend<Vendor>("PATCH", `/vendors/${enc(id)}/moderation`, patch),
  rate: (id: string, rating: number, note?: string | null) => apiSend<{ ok: true }>("PUT", `/vendors/${enc(id)}/rating`, note === undefined ? { rating } : { rating, note }),
};
