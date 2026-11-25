// Field rules for the listing forms. They mirror the backend's checks
// (backend/src/modules/listings/listing.validation.ts) so people see problems as they type;
// the backend checks everything again.
import { z } from "zod";

export { check, digitsOnly, orNull, typeName, typePhone } from "./formRules";

// ---------- Typing filters (stop wrong characters going in at all) ----------


/** Price as typed: digits, $ and commas only; shown with commas ("$549,000"). */
export function typePrice(v: string): string {
  const digits = v.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 9); // up to $999,999,999
  return digits ? `$${Number(digits).toLocaleString("en-US")}` : "";
}

/** "$549,000" → 54900000 cents; "" → null. */
export function priceToCents(v: string): number | null {
  const digits = v.replace(/\D/g, "");
  return digits ? Number(digits) * 100 : null;
}

/** 54900000 → "$549,000". */
export const centsToPrice = (cents?: number | null) => (cents == null ? "" : `$${Math.round(cents / 100).toLocaleString("en-US")}`);


// ---------- Rules ----------

const optional = <T extends z.ZodTypeAny>(schema: T) => z.union([z.literal(""), schema]);

export const rules = {
  address: z
    .string()
    .trim()
    .min(1, "Add the property address.")
    .min(5, "Add the full property address.")
    .max(200, "Address is too long (200 characters max).")
    .refine(v => /\d/.test(v) && /[a-z]/i.test(v), "Use a street address with a house number, e.g. 1234 N Main St."),
  sellerName: z
    .string()
    .trim()
    .min(1, "Add the seller's name.")
    .min(2, "Name is too short.")
    .max(120, "Name is too long (120 characters max).")
    .regex(/^[\p{L}][\p{L}\s.'&,-]*$/u, "Use letters only (spaces, & . ' - are fine)."),
  mlsNumber: optional(z.string().regex(/^\d{6,10}$/, "MLS # is 6 to 10 digits.")),
  price: optional(
    z.string().refine(v => {
      const c = priceToCents(v);
      return c !== null && c >= 100_000;
    }, "Price must be at least $1,000."),
  ),
  email: optional(z.string().trim().max(200, "Email is too long.").pipe(z.email("That email doesn't look right."))),
  phone: optional(z.string().refine(v => v.replace(/\D/g, "").length === 10, "Phone must be 10 digits.")),
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
  liveDate: optional(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a real date.")
      .refine(v => v >= "2000-01-01", "Date looks too far back.")
      .refine(v => Date.parse(`${v}T12:00:00Z`) <= Date.now() + 365 * 864e5, "Date can't be more than a year ahead."),
  ),
  count: optional(z.string().regex(/^\d{1,8}$/, "Use a whole number.").refine(v => Number(v) <= 10_000_000, "Number looks too high.")),
  title: (max: number) => z.string().trim().min(1, "Add a short title.").max(max, `Title is too long (${max} characters max).`),
  text: (max: number, label: string) => z.string().trim().max(max, `${label} is too long (${max} characters max).`),
};

export const newListingSchema = z.object({
  address: rules.address,
  mlsNumber: rules.mlsNumber,
  price: rules.price,
  sellerName: rules.sellerName,
  sellerPhone: rules.phone,
  sellerEmail: rules.email,
  agentUserId: z.string(),
});

export const detailsSchema = z.object({
  address: rules.address,
  mlsNumber: rules.mlsNumber,
  price: rules.price,
  liveDate: rules.liveDate,
  photoUrl: rules.httpsUrl,
  sellerName: rules.sellerName,
  sellerPhone: rules.phone,
  sellerEmail: rules.email,
  zillow: rules.httpsUrl,
  website: rules.httpsUrl,
  reel: rules.httpsUrl,
  tour: rules.httpsUrl,
});

export const eventSchema = z.object({ title: rules.title(140), body: rules.text(2000, "Details") });

export const suggestionSchema = z.object({
  title: z.string().trim().min(1, "Add a title.").max(120, "Title is too long (120 characters max)."),
  why: rules.text(300, "Why"),
  action: rules.text(300, "What we'll do"),
});

