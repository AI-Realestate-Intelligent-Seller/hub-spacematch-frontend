// Viktor tool gateway helper for scheduled/internal actions (no AI).
declare const process: { env: Record<string, string | undefined> };

/** Calls an integration tool and returns its parsed JSON content. Throws on any failure. */
export async function callIntegration<T = unknown>(role: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${process.env.VIKTOR_SPACES_API_URL}/api/viktor-spaces/tools/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_name: process.env.VIKTOR_SPACES_PROJECT_NAME,
      project_secret: process.env.VIKTOR_SPACES_PROJECT_SECRET,
      space_id: process.env.VIKTOR_AUTH_RESOURCE_ID,
      role,
      arguments: args,
    }),
  });
  if (!res.ok) throw new Error(`${role} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  if (!json.success) throw new Error(`${role}: ${json.error ?? "tool failed"}`);
  const r = json.result as { content?: string; error?: string };
  if (!r?.content) throw new Error(`${role}: ${r?.error ?? "no content"}`);
  return JSON.parse(r.content) as T;
}

/** Gmail mailboxes the Hub reads. team@ = agents' forwards; michael@ = his own Zillow login. */
export const MAILBOXES = [
  { key: "team", label: "team@spacematchinc.com", prefix: "mcp_pd_gmail_" },
  { key: "michael", label: "michael@spacematchinc.com", prefix: "mcp_gmail_3_pd_gmail_" },
] as const;

export type GmailMsg = { id: string; subject?: string; date?: string; sender?: string; bodyText?: string };

export async function gmailFind(prefix: string, q: string, max: number, fields: string[]): Promise<GmailMsg[]> {
  const c = await callIntegration<unknown>(`${prefix}find_email`, { q, maxResults: max, fields });
  const list = Array.isArray(c) ? c : ((c as { messages?: unknown[] }).messages ?? []);
  return list as GmailMsg[];
}

export async function gmailGetFull(prefix: string, id: string): Promise<{ internalDate: string; payload: unknown }> {
  const c = await callIntegration<{ status_code: number; body: unknown }>(`${prefix}proxy_get`, { url: `/gmail/v1/users/me/messages/${id}?format=full` });
  if (c.status_code >= 300) throw new Error(`Gmail message ${id}: HTTP ${c.status_code}`);
  return (typeof c.body === "string" ? JSON.parse(c.body) : c.body) as { internalDate: string; payload: unknown };
}
