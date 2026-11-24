// "Talk it in" on the CMA form (Michael 2026-11-22, all agents): the agent dictates the property
// (live transcript via viktorSpeech.startTranscription), then parseCmaDictation turns the transcript
// into form fields with Viktor's ai_structured_output. The browser merges the result into the form;
// the agent reviews and submits as usual. Billed to the workspace (speech seconds + one AI call).
import { ConvexError, v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { REMOVED_EMAILS, isAdminEmail } from "./agentsData";
import { authenticatedAction } from "./functions";
import { internal } from "./_generated/api";
import { syncRoster } from "./rosterSync";
import { callTool } from "./viktorTools";

/** Current SpaceMatch Hub user: @spacematchinc.com (or admin) and not a removed agent. */
export const speechViewerAllowed = internalQuery({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, { userId }) => {
    // Platform automation (space_session: Viktor's own e2e / embed sessions) is allowed, like the
    // template's billedToolAction.
    const platform = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", q => q.eq("userId", userId).eq("provider", "space_session"))
      .first();
    if (platform) return true;
    await syncRoster(ctx);
    const user = await ctx.db.get(userId);
    const email = (user?.email ?? "").trim().toLowerCase();
    if (!email || REMOVED_EMAILS.includes(email)) return false;
    return email.endsWith("@spacematchinc.com") || isAdminEmail(email);
  },
});

const MAX_TRANSCRIPT = 6000;

const str = (description: string, extra: Record<string, unknown> = {}) => ({
  type: "string",
  description,
  ...extra,
});

function schemaFor(o: Options) {
  return {
    type: "object",
    properties: {
      clientName: str("Client / seller name(s), e.g. 'John and Mary Park'. Empty if not said."),
      clientEmail: str("Client email if spelled out. Empty if not said."),
      clientPhone: str("Client phone digits, e.g. '773-555-1234'. Empty if not said."),
      street: str("Street address only (number + street name + suffix), e.g. '1234 Ashland Ave'. No unit, city or ZIP."),
      unit: str("Unit / apartment number if said."),
      city: str("City, e.g. 'Evanston', 'Chicago'."),
      state: str("2-letter state; 'IL' unless another state is said."),
      zip: str("5-digit ZIP if said."),
      propertyType: str("Property type, one of the allowed values, or empty.", { enum: ["", ...o.propertyTypes] }),
      beds: str("Bedrooms as a number, e.g. '4'."),
      bathsFull: str("Full bathrooms as a number. '2 and a half baths' → '2'."),
      bathsHalf: str("Half bathrooms as a number. '2 and a half baths' → '1'."),
      sqft: str("Interior square feet, digits only."),
      yearBuilt: str("Year built, 4 digits."),
      basement: str("Basement, one of the allowed values, or empty.", { enum: ["", ...o.basements] }),
      garage: str("Garage / parking as said, e.g. '2-car detached'."),
      hoaDues: str("HOA / assessment dues as said, e.g. '$350/mo'."),
      condition: str("Overall condition, one of the allowed values, or empty. Only if the agent describes the overall condition.", { enum: ["", ...o.conditions] }),
      upgrades: {
        type: "array",
        description: "Upgrades / renovations mentioned, each mapped to the closest checklist item.",
        items: {
          type: "object",
          properties: {
            item: str("Closest checklist item.", { enum: o.upgradeItems }),
            year: str("Year done, 4 digits, if said. 'two years ago' → compute from today's date."),
            notes: str("Short details, e.g. 'quartz counters, new cabinets'."),
          },
          required: ["item", "year", "notes"],
          additionalProperties: false,
        },
      },
      otherUpgrades: str("Upgrades that fit no checklist item."),
      knownIssues: str("Known problems / defects / repairs needed."),
      sellerPriceExpectation: str("Seller's price expectation in dollars, digits only, e.g. '650 thousand' → '650000', '1.2 million' → '1200000'."),
      timeline: str("Seller's timeline, e.g. 'list in spring', 'ASAP'."),
      purpose: str("Purpose of the CMA, one of the allowed values, or empty.", { enum: ["", ...o.purposes] }),
      neededBy: str("Date the CMA is needed by as YYYY-MM-DD. Resolve 'Friday', 'tomorrow', 'next Tuesday' against today's date."),
      compNotes: str("Comp preferences, e.g. 'stay within the school district', 'only sales in the last 6 months', MLS numbers."),
      notes: str("Anything else useful for the CMA that fits no field above (not filler or chit-chat)."),
      ...(o.kind === "commercial"
        ? {
            commercial: {
              type: "object",
              description: "Commercial building facts if said; empty strings otherwise.",
              properties: {
                buildingSf: str("Building square feet, digits."),
                landSf: str("Land square feet or acres as said."),
                units: str("Number of units."),
                unitMix: str("Unit mix, e.g. '6 two-beds, 2 one-beds'."),
                occupancy: str("Occupancy, e.g. '100% leased'."),
                grossIncome: str("Annual gross income, digits."),
                noi: str("Annual NOI, digits."),
                propertyTaxes: str("Annual property taxes, digits."),
                zoning: str("Zoning code."),
                parking: str("Parking."),
              },
              required: ["buildingSf", "landSf", "units", "unitMix", "occupancy", "grossIncome", "noi", "propertyTaxes", "zoning", "parking"],
              additionalProperties: false,
            },
          }
        : {}),
    },
    required: [
      "clientName", "clientEmail", "clientPhone", "street", "unit", "city", "state", "zip", "propertyType",
      "beds", "bathsFull", "bathsHalf", "sqft", "yearBuilt", "basement", "garage", "hoaDues", "condition",
      "upgrades", "otherUpgrades", "knownIssues", "sellerPriceExpectation", "timeline", "purpose", "neededBy",
      "compNotes", "notes", ...(o.kind === "commercial" ? ["commercial"] : []),
    ],
    additionalProperties: false,
  };
}

type Options = {
  kind: "residential" | "commercial";
  propertyTypes: string[];
  conditions: string[];
  basements: string[];
  purposes: string[];
  upgradeItems: string[];
};

export const parseCmaDictation = authenticatedAction({
  args: {
    transcript: v.string(),
    kind: v.union(v.literal("residential"), v.literal("commercial")),
    today: v.string(),
    propertyTypes: v.array(v.string()),
    conditions: v.array(v.string()),
    basements: v.array(v.string()),
    purposes: v.array(v.string()),
    upgradeItems: v.array(v.string()),
  },
  handler: async (ctx, a) => {
    const ok: boolean = await ctx.runQuery(internal.voiceFill.speechViewerAllowed, { userId: ctx.userId });
    if (!ok) throw new ConvexError("Voice fill is for SpaceMatch agents.");
    const transcript = a.transcript.trim().slice(0, MAX_TRANSCRIPT);
    if (transcript.length < 8) throw new ConvexError("I didn't catch enough. Tap the mic and try again.");
    const cap = (xs: string[]) => xs.slice(0, 40).map(x => x.slice(0, 80));
    const opts: Options = {
      kind: a.kind,
      propertyTypes: cap(a.propertyTypes),
      conditions: cap(a.conditions),
      basements: cap(a.basements),
      purposes: cap(a.purposes),
      upgradeItems: cap(a.upgradeItems),
    };
    const prompt = [
      "A Chicago-area real estate agent dictated details for a CMA (comparative market analysis) request while driving.",
      `Today is ${a.today.slice(0, 40)}. Request kind: ${a.kind}.`,
      "Extract every fact they said into the fields. Leave a field as an empty string when it was not said: never guess or invent values.",
      "Speech-to-text may mishear: fix obvious transcription errors in street names and Chicago-area suburbs (e.g. 'Evan stun' → 'Evanston').",
      "Numbers: digits only where the field says digits. Put the agent's own corrections last-wins ('3 beds, no wait, 4' → '4').",
    ].join(" ");
    return await structured(prompt, schemaFor(opts), transcript);
  },
});

async function structured(prompt: string, schema: Record<string, unknown>, transcript: string) {
  const r = await callTool<{ result?: Record<string, unknown> | null; error?: string | null }>(
    "ai_structured_output",
    { prompt, output_schema: schema, input_text: transcript, intelligence_level: "fast" },
  );
  if (!r.result) throw new ConvexError(r.error ? `Couldn't read that: ${r.error}` : "Couldn't read that. Try again.");
  return r.result;
}

// ── Lease CMA form (/lease) ─────────────────────────────────────────────────────────────────────
// `enums` = the form's own choice lists (single-pick → enum string, multi-pick → enum array), so the
// model can only return values the form accepts. Free-text fields are fixed below.
const LEASE_TEXT: Record<string, string> = {
  clientName: "Client name(s) (landlord, tenant or investor). Empty if not said.",
  clientEmail: "Client email if spelled out.",
  clientPhone: "Client phone digits, e.g. '773-555-1234'.",
  street: "Street address only (number + street name + suffix), e.g. '1234 Ashland Ave'. No unit, city or ZIP.",
  unit: "Unit / apartment / suite number if said.",
  city: "City, e.g. 'Evanston', 'Chicago'.",
  state: "2-letter state; 'IL' unless another state is said.",
  zip: "5-digit ZIP if said.",
  knownIssues: "Known problems / repairs needed.",
  timeline: "Timeline, e.g. 'tenant moves out end of March', 'ASAP'.",
  neededBy: "Date the CMA is needed by as YYYY-MM-DD. Resolve 'Friday', 'tomorrow' against today's date.",
  compNotes: "Comp preferences, e.g. 'same building only', 'last 6 months', MLS numbers.",
  notes: "Anything else useful for the rent analysis that fits no field (not filler or chit-chat).",
  currentRent: "Current or last rent as said, e.g. '$2,400/mo' or '$28/SF NNN'.",
  askingRent: "Rent the owner/client hopes for, as said, e.g. '$2,600' or '$30 a foot'.",
  availableDate: "Date available as YYYY-MM-DD (resolve 'March 1st', 'next month' against today).",
  leaseTerm: "Lease term, e.g. '12 months', '5 years with options'.",
  recentUpdates: "Recent updates / renovations with years, e.g. 'new kitchen 2023, refinished floors'.",
};
const LEASE_RES_TEXT: Record<string, string> = {
  beds: "Bedrooms as a number ('studio' → '0').",
  bathsFull: "Full bathrooms as a number. '1 and a half baths' → '1'.",
  bathsHalf: "Half bathrooms as a number. '1 and a half baths' → '1'.",
  sqft: "Interior square feet, digits only.",
  floor: "Floor / level, e.g. '3rd floor', 'garden'.",
  yearBuilt: "Year built, 4 digits.",
};
const LEASE_COM_TEXT: Record<string, string> = {
  spaceSf: "Leasable space square feet, digits only.",
  buildingSf: "Whole building square feet, digits only.",
  suite: "Suite / space number.",
  frontage: "Street frontage, e.g. '25 feet on Central'.",
  ceilingHeight: "Ceiling / clear height, e.g. '14 ft'.",
  docks: "Loading docks / drive-in doors as said.",
  zoning: "Zoning code, e.g. 'B1-2'.",
  currentUse: "Current or last use / tenant, e.g. 'nail salon'.",
  camEstimate: "Taxes + CAM + insurance in $/SF/yr if said, e.g. '9.50'.",
  tiExpectation: "Tenant improvement allowance / free rent expectations.",
};
const LEASE_MULTI = new Set(["utilitiesIncluded", "amenities", "features"]);

export const parseLeaseDictation = authenticatedAction({
  args: {
    transcript: v.string(),
    kind: v.union(v.literal("residential"), v.literal("commercial")),
    today: v.string(),
    enums: v.record(v.string(), v.array(v.string())),
  },
  handler: async (ctx, a) => {
    const ok: boolean = await ctx.runQuery(internal.voiceFill.speechViewerAllowed, { userId: ctx.userId });
    if (!ok) throw new ConvexError("Voice fill is for SpaceMatch agents.");
    const transcript = a.transcript.trim().slice(0, MAX_TRANSCRIPT);
    if (transcript.length < 8) throw new ConvexError("I didn't catch enough. Tap the mic and try again.");
    const text = { ...LEASE_TEXT, ...(a.kind === "commercial" ? LEASE_COM_TEXT : LEASE_RES_TEXT) };
    const properties: Record<string, unknown> = {};
    for (const [k, d] of Object.entries(text)) properties[k] = str(d);
    const ENUM_DESC: Record<string, string> = {
      propertyType: "Type of building / space, closest allowed value, or empty.",
      clientRole: "Who the client is, closest allowed value, or empty.",
      purpose: "Purpose of the rent analysis, closest allowed value, or empty.",
      condition: "Overall condition, closest allowed value, or empty. Only if described.",
      parking: "Parking, closest allowed value, or empty. Empty unless parking is mentioned.",
      laundry: "Laundry, closest allowed value, or empty.",
      pets: "Pet policy, closest allowed value, or empty.",
      furnished: "Furnished, closest allowed value, or empty. Empty unless the agent actually says furnished/unfurnished.",
      leaseStructure: "Lease structure (NNN / gross), closest allowed value, or empty.",
      utilitiesIncluded: "Utilities included in rent that were mentioned.",
      amenities: "Amenities mentioned.",
      features: "Space features mentioned.",
    };
    const enumKeys = Object.keys(a.enums).filter(k => k in ENUM_DESC).slice(0, 20);
    for (const k of enumKeys) {
      const vals = a.enums[k].slice(0, 40).map(x => x.slice(0, 80));
      properties[k] = LEASE_MULTI.has(k)
        ? { type: "array", description: ENUM_DESC[k], items: { type: "string", enum: vals } }
        : str(ENUM_DESC[k], { enum: ["", ...vals] });
    }
    const schema = {
      type: "object",
      properties,
      required: Object.keys(properties),
      additionalProperties: false,
    };
    const prompt = [
      `A Chicago-area real estate agent dictated details for a ${a.kind} LEASE CMA (rent analysis) request while driving.`,
      `Today is ${a.today.slice(0, 40)}.`,
      "Extract every fact they said into the fields. Leave a field as an empty string (or empty list) when it was not said: never guess or invent values.",
      "Speech-to-text may mishear: fix obvious transcription errors in street names and Chicago-area suburbs (e.g. 'Evan stun' → 'Evanston').",
      "Numbers: digits only where the field says digits. The agent's own corrections are last-wins ('2 beds, no wait, 3' → '3').",
    ].join(" ");
    return await structured(prompt, schema, transcript);
  },
});
