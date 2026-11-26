import { api } from "./api";
import { notifyDataChanged } from "./apiData";

export type FormSubmissionStatus = "new" | "contacted" | "done";
export interface FormSubmission {
  _id: string;
  _creationTime: number;
  formId: string;
  formTitle: string;
  listingId: string | null;
  agentEmail: string | null;
  agentName: string | null;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  propertyAddress: string | null;
  answers: Record<string, string>;
  isLead: boolean;
  status: FormSubmissionStatus;
  notes: string | null;
}

const send = <T>(path: string, method: string, body: unknown) => api<T>(`/forms${path}`, { method, body: JSON.stringify(body) });
const enc = encodeURIComponent;

export const formsApi = {
  agents: () => api<{ items: { id: string; name: string }[] }>("/forms/agents"),
  share: (formId: string, input: { listingId?: string; agentId?: string }) => send<{ link: string }>(`/${enc(formId)}/share`, "POST", input),
  context: (formId: string, link: string) => api<{ address: string | null; agentName: string | null }>(`/forms/${enc(formId)}/context?link=${enc(link)}`),
  submit: (formId: string, input: { submissionId: string; link?: string; agent?: string; answers: Record<string, string>; website?: string }) =>
    send<{ ok: true }>(`/${enc(formId)}/submissions`, "POST", input),
  inbox: (scope: "all" | "mine" = "all") => api<{ rows: FormSubmission[]; me: { isAdmin: boolean; isOps: boolean } }>(`/forms/inbox?scope=${scope}`),
  counts: () => api<{ newCount: number; newLeads: FormSubmission[] }>("/forms/counts"),
  setStatus: async (id: string, status: FormSubmissionStatus, notes: string) => {
    await send(`/inbox/${enc(id)}`, "PATCH", { status, notes });
    notifyDataChanged();
  },
  assign: async (id: string, agentId: string) => {
    await send(`/inbox/${enc(id)}/agent`, "PUT", { agentId });
    notifyDataChanged();
  },
};
