// Email templates on the new backend (backend/src/modules/email-templates). Replaces convex/emailTemplates.ts.
import { apiGet, apiSend } from "./apiData";

export type TemplateStatus = "mine" | "suggested" | "team" | "declined";

export interface EmailTemplate {
  _id: string;
  ownerEmail: string;
  ownerName: string;
  title: string;
  segment: string;
  subject: string;
  body: string;
  status: TemplateStatus;
  reviewNote?: string;
  reviewedBy?: string;
  basedOn?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TeamRate {
  ratePct: number;
  source: string;
  asOf: string;
}

export interface TemplatesOverview {
  mine: EmailTemplate[];
  team: EmailTemplate[];
  review: EmailTemplate[];
  canReview: boolean;
  rate: TeamRate;
}

export interface TemplateInput {
  title: string;
  segment: string;
  subject: string;
  body: string;
  basedOn?: string | null;
}

/** Merge fields an email may use (backend checks the same list). */
export const MERGE_FIELDS = ["first_name", "agent_first", "agent_name", "agent_phone", "neighborhood"];
export const unknownFields = (s: string) => [...s.matchAll(/\{([^{}]*)\}/g)].map(m => m[1] ?? "").filter(k => !MERGE_FIELDS.includes(k));

const enc = encodeURIComponent;

export const emailTemplatesApi = {
  overview: () => apiGet<TemplatesOverview>("/email-templates"),
  create: (input: TemplateInput) => apiSend<EmailTemplate>("POST", "/email-templates", input),
  update: (id: string, input: TemplateInput) => apiSend<EmailTemplate>("PUT", `/email-templates/${enc(id)}`, input),
  remove: (id: string) => apiSend<{ ok: true }>("DELETE", `/email-templates/${enc(id)}`),
  suggest: (id: string) => apiSend<EmailTemplate>("POST", `/email-templates/${enc(id)}/suggest`),
  review: (id: string, approve: boolean, note?: string | null) =>
    apiSend<EmailTemplate>("POST", `/email-templates/${enc(id)}/review`, note ? { approve, note } : { approve }),
  setRate: (ratePct: number) => apiSend<TeamRate>("PUT", "/email-templates/rate", { ratePct }),
};
