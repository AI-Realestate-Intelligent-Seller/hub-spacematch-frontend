// Field rules shared by the forms on the new backend. They mirror backend/src/utils/fields.ts,
// so people see problems while typing; the backend checks everything again.
import { z } from "zod";

// ---------- Typing filters (stop wrong characters going in at all) ----------

/** Digits only, e.g. MLS #, counts. */
export const digitsOnly = (v: string, max = 10) => v.replace(/\D/g, "").slice(0, max);

/** Phone as typed: digits only, shown as (312) 555-0100. A leading 1 is dropped. */
export function typePhone(v: string): string {
  let d = v.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length <= 3) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Name as typed: no digits or symbols other than & . ' - , */
export const typeName = (v: string, max = 120) => v.replace(/[^\p{L}\s.'&,-]/gu, "").slice(0, max);

/** Email as typed: no spaces. */
export const typeEmail = (v: string) => v.replace(/\s/g, "").slice(0, 200);

// ---------- Rules ----------

const optional = <T extends z.ZodTypeAny>(schema: T) => z.union([z.literal(""), schema]);

export const fieldRules = {
  email: optional(z.string().trim().max(200, "Email is too long.").pipe(z.email("That email doesn't look right."))),
  phone: optional(z.string().refine(v => v.replace(/\D/g, "").length === 10, "Phone must be 10 digits.")),
  /** Website with or without https:// (acme.com is fine). */
  website: optional(
    z
      .string()
      .trim()
      .max(300, "Website is too long.")
      .refine(v => {
        try {
          const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
          return /\.[a-z]{2,}$/i.test(u.hostname);
        } catch {
          return false;
        }
      }, "That website doesn't look right (e.g. acme.com)."),
  ),
  /** Full https:// link. */
  httpsUrl: optional(
    z
      .string()
      .trim()
      .max(600, "Link is too long.")
      .refine(v => {
        try {
          return new URL(v).protocol === "https:";
        } catch {
          return false;
        }
      }, "Use a full link starting with https://"),
  ),
  text: (max: number, label: string) => z.string().trim().max(max, `${label} is too long (${max} characters max).`),
  required: (max: number, label: string, empty = `Add ${label.toLowerCase()}.`) =>
    z.string().trim().min(1, empty).max(max, `${label} is too long (${max} characters max).`),
};

/** Runs a schema and returns { field: first message }; empty when valid. */
export function check<T extends z.ZodTypeAny>(schema: T, values: unknown): Record<string, string> {
  const r = schema.safeParse(values);
  if (r.success) return {};
  const out: Record<string, string> = {};
  for (const i of r.error.issues) {
    const k = i.path.join(".");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/** Empty string → null (clears the field on the server). */
export const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

/** True when a check() result has any message. */
export const hasErrors = (e: Record<string, string>) => Object.values(e).some(Boolean);
