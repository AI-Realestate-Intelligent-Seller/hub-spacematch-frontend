// Help requests on the new backend (backend/src/modules/help). Replaces convex/help.ts.
import { apiGet, apiSend } from "./apiData";

export type HelpStatus = "new" | "in_progress" | "waiting" | "done";

export interface HelpRequest {
  _id: string;
  fromEmail: string;
  fromName: string;
  toName: string;
  toEmail: string;
  topic: string;
  details: string;
  urgency: "now" | "today" | "week";
  status: HelpStatus;
  reply?: string;
  statusAt?: number;
  statusBy?: string;
  reassignedBy?: string;
  doneAt?: number;
  doneBy?: string;
  createdAt: number;
  updatedAt: number;
}

export interface HelpOverview {
  mine: HelpRequest[];
  toMe: HelpRequest[];
  canHandle: boolean;
  isAdmin: boolean;
  myEmail: string;
  support: { name: string; email: string }[];
}

const enc = encodeURIComponent;

export const helpApi = {
  list: () => apiGet<HelpOverview>("/help-requests"),
  create: (input: { toEmail: string; topic: string; details: string; urgency: string }) => apiSend<HelpRequest>("POST", "/help-requests", input),
  setStatus: (id: string, status: HelpStatus, reply?: string | null) =>
    apiSend<HelpRequest>("PATCH", `/help-requests/${enc(id)}/status`, reply ? { status, reply } : { status }),
  reassign: (id: string, toEmail: string) => apiSend<HelpRequest>("PATCH", `/help-requests/${enc(id)}/assignee`, { toEmail }),
};
