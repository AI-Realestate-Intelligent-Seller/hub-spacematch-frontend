// Neighborhood & marketing plan for a listing (Michael 2026-11-08, #team-app-design).
// Runs Michael's "I just took this listing…" prompt on verified local data:
//   free public data in code (Census geocoder, ACS 2024 via Census Reporter, Chicago
//   community area, CPS attendance boundaries) + ~6 web searches + one AI write-up.
// Measured cost ≈ 150 Viktor credits per plan (searches ~4 each, write-up ~110).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { mine } from "./listings";
import { callTool } from "./viktorTools";

const MAX_BUILDS_PER_LISTING = 6; // staff are not capped
const STALE_MS = 15 * 60 * 1000; // a build stuck longer than this can be restarted
const clean = (s: string | undefined, max: number) => (s ?? "").trim().slice(0, max) || undefined;

export const MICHAEL_PROMPT =
  "I just took this listing. Tell me the highlights of the neighborhood. Pull demographic data. I'm trying to find the ideal buyer to market to. If I live there, what would the lifestyle be? What are the school ratings? Identify cons for living in this neighborhood and give me objection handlers for those cons. Create a marketing plan for this listing and play the role of top marketer and top listing agent. The goal is to generate as many offers as possible. Add a neighborhood farming plan for this specific listing.";

// ---------- Agent side ----------

export const forListing = authenticatedQuery({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    const { me, l } = await mine(ctx, ctx.userId, listingId);
    const p = await ctx.db.query("listingPlans").withIndex("by_listing", q => q.eq("listingId", listingId)).first();
    return {
      listing: { _id: l._id, address: l.address, price: l.price, mlsNumber: l.mlsNumber, agentName: l.agentName, status: l.status },
      plan: p ?? null,
      buildsLeft: me.staff ? null : Math.max(0, MAX_BUILDS_PER_LISTING - (p?.builds ?? 0)),
      prompt: MICHAEL_PROMPT,
    };
  },
});

async function queue(ctx: MutationCtx, listingId: Id<"listings">, email: string, staff: boolean, neighborhood?: string, notes?: string) {
  const now = Date.now();
  const p = await ctx.db.query("listingPlans").withIndex("by_listing", q => q.eq("listingId", listingId)).first();
  if (p && (p.status === "queued" || p.status === "building") && now - p.updatedAt < STALE_MS) {
    throw new Error("Your plan is already being built. It takes about 2 minutes.");
  }
  if (p && !staff && p.builds >= MAX_BUILDS_PER_LISTING) {
    throw new Error(`This listing has used its ${MAX_BUILDS_PER_LISTING} plan builds. Ask Michael or ops if you need another.`);
  }
  const patch = {
    status: "queued" as const, step: "Starting…", neighborhood, notes, requestedByEmail: email,
    error: undefined, builds: (p?.builds ?? 0) + 1, startedAt: now, finishedAt: undefined, updatedAt: now,
  };
  if (p) await ctx.db.patch(p._id, patch);
  else await ctx.db.insert("listingPlans", { listingId, createdAt: now, ...patch });
  await ctx.scheduler.runAfter(0, internal.listingPlans.build, { listingId });
}

export const request = authenticatedMutation({
  args: { listingId: v.id("listings"), neighborhood: v.optional(v.string()), notes: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const { me } = await mine(ctx, ctx.userId, a.listingId);
    await queue(ctx, a.listingId, me.email, me.staff, clean(a.neighborhood, 120), clean(a.notes, 1500));
    return null;
  },
});

/** Called from listings.create: every new listing gets a plan without a tap. */
export const autoQueue = internalMutation({
  args: { listingId: v.id("listings"), email: v.string() },
  handler: async (ctx, { listingId, email }) => {
    const l = await ctx.db.get(listingId);
    if (!l || l.sellerEmail?.endsWith("@example.com")) return null; // e2e listings stay free
    const p = await ctx.db.query("listingPlans").withIndex("by_listing", q => q.eq("listingId", listingId)).first();
    if (p) return null;
    await queue(ctx, listingId, email, false);
    return null;
  },
});

// ---------- Build pipeline ----------

export const getForBuild = internalQuery({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    const l = await ctx.db.get(listingId);
    const p = await ctx.db.query("listingPlans").withIndex("by_listing", q => q.eq("listingId", listingId)).first();
    return l && p ? { l, p } : null;
  },
});

export const setState = internalMutation({
  args: {
    listingId: v.id("listings"),
    status: v.optional(v.union(v.literal("building"), v.literal("ready"), v.literal("error"))),
    step: v.optional(v.string()),
    facts: v.optional(v.any()),
    plan: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { listingId, ...rest }) => {
    const p = await ctx.db.query("listingPlans").withIndex("by_listing", q => q.eq("listingId", listingId)).first();
    if (!p) return null;
    const patch: Partial<Doc<"listingPlans">> = { updatedAt: Date.now() };
    if (rest.status) patch.status = rest.status;
    if (rest.step !== undefined) patch.step = rest.step;
    if (rest.facts !== undefined) patch.facts = rest.facts;
    if (rest.plan !== undefined) patch.plan = rest.plan;
    if (rest.status === "error") patch.error = rest.error ?? "Something went wrong";
    if (rest.status === "ready") { patch.error = undefined; patch.finishedAt = Date.now(); patch.step = undefined; }
    await ctx.db.patch(p._id, patch);
    return null;
  },
});

const UA = { "User-Agent": "Mozilla/5.0 (SpaceMatch Hub listing plan)" };
async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${new URL(url).host} HTTP ${r.status}`);
  return (await r.json()) as T;
}

type Geo = { matched: string; lat: number; lon: number; tract?: string; placeGeoid?: string; placeName?: string; countyGeoid?: string; countyName?: string; schoolDistricts: string[] };
async function geocode(address: string): Promise<Geo | null> {
  const q = new URLSearchParams({ address, benchmark: "Public_AR_Current", vintage: "Current_Current", format: "json", layers: "Census Tracts,Incorporated Places,Counties,Unified School Districts,Elementary School Districts,Secondary School Districts" });
  const j = await getJson<{ result: { addressMatches: Array<{ matchedAddress: string; coordinates: { x: number; y: number }; geographies: Record<string, Array<Record<string, string>>> }> } }>(
    `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?${q}`,
  );
  const m = j.result.addressMatches[0];
  if (!m) return null;
  const g = m.geographies;
  const tract = g["Census Tracts"]?.[0];
  const place = g["Incorporated Places"]?.[0];
  const county = g.Counties?.[0];
  const schoolDistricts = ["Unified School Districts", "Elementary School Districts", "Secondary School Districts"].flatMap(k => (g[k] ?? []).map(x => x.NAME)).filter(Boolean);
  return { matched: m.matchedAddress, lon: m.coordinates.x, lat: m.coordinates.y, tract: tract?.GEOID, placeGeoid: place?.GEOID, placeName: place?.NAME, countyGeoid: county?.GEOID, countyName: county?.NAME, schoolDistricts };
}

// ACS tables: housing, income, education, commute. Deliberately no race, ethnicity,
// age, sex, household/family type or other protected-class tables (Fair Housing).
const ACS_TABLES = "B01003,B19013,B25077,B25064,B25003,B25010,B15003,B08301,B25035,B25024";
type AcsRow = Record<string, number | string | null>;
async function acs(geoIds: string[]): Promise<{ release: string; areas: AcsRow[] }> {
  const q = new URLSearchParams({ table_ids: ACS_TABLES, geo_ids: geoIds.join(",") });
  const d = await getJson<{ data: Record<string, Record<string, { estimate: Record<string, number | null> }>>; geography: Record<string, { name: string }>; release: { name: string } }>(
    `https://api.censusreporter.org/1.0/data/show/latest?${q}`,
  );
  const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : null);
  const areas = geoIds.filter(g => d.data[g]).map(g => {
    const e = (t: string, c: string) => d.data[g][t]?.estimate?.[`${t}${c}`] ?? 0;
    const sum = (t: string, cols: string[]) => cols.reduce((n, c) => n + (e(t, c) ?? 0), 0);
    return {
      geoId: g,
      name: d.geography[g]?.name ?? g,
      population: e("B01003", "001"),
      medianHouseholdIncome: e("B19013", "001"),
      medianHomeValue: e("B25077", "001"),
      medianGrossRent: e("B25064", "001"),
      ownerOccupiedPct: pct(e("B25003", "002"), e("B25003", "001")),
      avgHouseholdSize: e("B25010", "001"),
      bachelorsOrHigherPct: pct(sum("B15003", ["022", "023", "024", "025"]), e("B15003", "001")),
      commuteTransitPct: pct(e("B08301", "010"), e("B08301", "001")),
      workFromHomePct: pct(e("B08301", "021"), e("B08301", "001")),
      walkOrBikePct: pct(sum("B08301", ["018", "019"]), e("B08301", "001")),
      medianYearBuilt: e("B25035", "001"),
      singleFamilyPct: pct(sum("B25024", ["002", "003"]), e("B25024", "001")),
      twoToFourUnitPct: pct(sum("B25024", ["004", "005"]), e("B25024", "001")),
    };
  });
  return { release: d.release.name, areas };
}

// Chicago open data (no key). CPS boundary datasets are per school year: update the
// ids each summer (catalog: data.cityofchicago.org "Attendance Boundaries SY2627").
const CHI_COMMUNITY_AREAS = "igwz-8jzy";
const CPS_ES = { id: "x72b-38qv", year: "SY2025-26" };
const CPS_HS = { id: "xg7c-d8rm", year: "SY2025-26" };
async function soqlAt<T>(dataset: string, lon: number, lat: number, select: string): Promise<T[]> {
  const q = new URLSearchParams({ $select: select, $where: `intersects(the_geom, 'POINT (${lon} ${lat})')` });
  return getJson<T[]>(`https://data.cityofchicago.org/resource/${dataset}.json?${q}`);
}
const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\bHs\b/, "HS");

type School = { name: string; level: string; grades: string; address: string; cpsId?: string; boundarySource: string };
async function chicagoFacts(geo: Geo) {
  const [ca, es, hs] = await Promise.all([
    soqlAt<{ community?: string }>(CHI_COMMUNITY_AREAS, geo.lon, geo.lat, "community"),
    soqlAt<{ short_name?: string; school_add?: string; boundarygr?: string; school_id?: string }>(CPS_ES.id, geo.lon, geo.lat, "short_name,school_add,boundarygr,school_id"),
    soqlAt<{ school_nam?: string; school_add?: string; boundarygr?: string; school_id?: string }>(CPS_HS.id, geo.lon, geo.lat, "school_nam,school_add,boundarygr,school_id"),
  ]);
  const schools: School[] = [];
  for (const s of es) if (s.short_name) schools.push({ name: `${titleCase(s.short_name)} Elementary`, level: "Elementary (attendance boundary)", grades: (s.boundarygr ?? "").replace(/\s/g, ""), address: titleCase((s.school_add ?? "").replace(/\s+/g, " ")), cpsId: s.school_id, boundarySource: `City of Chicago Data Portal, CPS elementary attendance boundaries ${CPS_ES.year}` });
  for (const s of hs) if (s.school_nam) schools.push({ name: titleCase(s.school_nam.replace(/\bHS\b/, "High School")), level: "High school (attendance boundary)", grades: (s.boundarygr ?? "").replace(/\s/g, ""), address: titleCase((s.school_add ?? "").replace(/\s+/g, " ")), cpsId: s.school_id, boundarySource: `City of Chicago Data Portal, CPS high school attendance boundaries ${CPS_HS.year}` });
  return { communityArea: ca[0]?.community ? titleCase(ca[0].community) : undefined, schools };
}

async function search(q: string): Promise<string> {
  const r = await callTool<{ search_response: string }>("web_search", { search_question: q, detail: "detailed" });
  return (r.search_response ?? "").slice(0, 14000);
}

const RULES = `You are SpaceMatch Inc.'s top listing agent and top marketer (Chicago; a team of Real Broker, LLC). Write the plan an agent can act on today.
VOICE: confident, specific, punchy. Short sentences. No buzzwords, no emoji, no filler, no hedging in the body. Write like a top producer briefing a teammate.
FACTS: use only facts in DATA. Every number (price, taxes, beds, income, school scores, days on market, distances) must come from DATA; name its source in the source field. If a fact is missing, do not guess: leave it out or write "(verify)" once, and put the check in verify_before_using (max 8 short items, most important first). Never invent business names, distances, walk times or stats. Never mention other brokerages, listing agents or their sites by name in the body (they only appear in sources). Agent notes in DATA beat web data.
FAIR HOUSING (federal FHA, Illinois Human Rights Act, Chicago Human Rights Ordinance): never describe, target, include or exclude buyers by race, color, religion, national origin, ancestry, sex, sexual orientation, gender identity, disability, familial status (no "families", "kids", "growing family", "empty nesters"), age (no "young professionals", "millennials", "retirees"), marital status, military status, source of income, immigration status or arrest record. Buyer profiles = needs, lifestyle and property fit (e.g. "buyer who wants a garage, a yard and the trail nearby", "house-hacker who wants rental income", "buyer upgrading from a condo who wants outdoor space"). Describe the property and amenities, never the people who live there. Demographic data is neighborhood and pricing context only, never a targeting tool. Schools: state the facts and link the source; no "great schools"/"good area" claims; tell buyers to confirm enrollment with the district. Safety/crime: never characterize; the objection handler points buyers to the official data source. Paid social runs under Meta's Housing Special Ad Category (no age/gender/ZIP targeting, 15-mile minimum radius).
SPACEMATCH ASSETS to use where they fit: Stagifi staging, Giraffe360 media day (photos, 3D tour, floor plan), Coming Soon pre-marketing to the 23,000+ buyer and investor database, Instagram Reel on @spacematchchicago (36,500+ followers), YouTube Short, listing landing page, broker broadcast, Seller Portal live page for the seller, 14-day launch (open houses, Day-7 report, Day-14 price checkpoint), Hub Seller mailers (Just Listed / Just Sold 6x11 jumbo cards via Lob), Hub Seller lists (owner lists by ZIP), Lofty CRM drips. Check MRED Coming Soon and Clear Cooperation rules before any off-MLS marketing.
SOURCES: the source fields and the sources list name real sources (Census, CPS, GreatSchools, a website). Body text never says "Source:", "DATA", "user brief", "agent request" or "SpaceMatch assets".
LENGTH: respect every list limit (e.g. schools: only the assigned/boundary schools, max 6; buyer profiles 3-5). Body fields never say "verify", "confirm" or "not established": state what DATA supports, skip what it does not, and put every check in verify_before_using.
GOAL: as many offers as possible: pricing strategy, showing windows, agent-to-agent outreach, offer-deadline tactics done ethically (no fake offers, present all offers promptly).
If DATA shows the home is already active on the MLS, plan a strong active launch, not a fake Coming Soon.`;

const str = { type: "string" };
const arr = (items: object, max: number) => ({ type: "array", items, maxItems: max });
const obj = (props: Record<string, object>) => ({ type: "object", properties: props, required: Object.keys(props) });
export const PLAN_SCHEMA = obj({
  headline: { type: "string", description: "one-line positioning statement for the listing" },
  property_snapshot: arr(obj({ label: str, value: str, source: str }), 10),
  neighborhood_highlights: arr(obj({ title: str, detail: str, source: str }), 7),
  demographics_takeaways: arr({ type: "string", description: "what the census numbers mean for pricing and positioning (never targeting)" }, 5),
  buyer_profiles: arr(obj({ name: str, why_this_home: str, where_to_reach: str, message: str }), 5),
  lifestyle: arr({ type: "string", description: "a day living here, second person, concrete places from DATA" }, 6),
  schools: arr(obj({ name: str, grades: str, ratings: str, source: str }), 6),
  cons: arr(obj({ con: str, objection_handler: str }), 7),
  marketing_plan: obj({
    pricing_strategy: str,
    phases: arr(obj({ phase: str, when: str, actions: arr(str, 7) }), 5),
    content_ideas: arr(obj({ format: str, idea: str, hook: str }), 7),
    offer_strategy: arr(str, 7),
  }),
  farming_plan: obj({
    area: str,
    list_size_note: str,
    touches: arr(obj({ when: str, channel: str, action: str }), 8),
    door_knock_script: str,
  }),
  verify_before_using: arr(str, 8),
  sources: arr(obj({ name: str, url: str }), 20),
});

export const build = internalAction({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    const row = await ctx.runQuery(internal.listingPlans.getForBuild, { listingId });
    if (!row) return null;
    const { l, p } = row;
    const step = (s: string) => ctx.runMutation(internal.listingPlans.setState, { listingId, status: "building", step: s });
    try {
      await step("Locating the property");
      const geo = await geocode(l.address).catch(() => null);
      const isChicago = !!geo?.placeName && /^Chicago city$/i.test(geo.placeName);

      await step("Pulling census data and school boundaries");
      const geoIds = geo ? [geo.tract && `14000US${geo.tract}`, geo.placeGeoid && `16000US${geo.placeGeoid}`, geo.countyGeoid && `05000US${geo.countyGeoid}`].filter((x): x is string => !!x) : [];
      const [census, chi] = await Promise.all([
        geoIds.length ? acs(geoIds).catch(e => ({ error: String(e) })) : Promise.resolve({ error: "Address not found by the Census geocoder" }),
        geo && isChicago ? chicagoFacts(geo).catch(e => ({ communityArea: undefined, schools: [] as School[], error: String(e).slice(0, 200) })) : Promise.resolve({ communityArea: undefined, schools: [] as School[] }),
      ]);
      const place = isChicago ? "Chicago, IL" : geo?.placeName ? `${geo.placeName.replace(/ (city|village|town)$/i, "")}, IL` : "";
      const hood = p.neighborhood || chi.communityArea || (geo?.placeName ?? "").replace(/ (city|village|town)$/i, "") || "";
      const where = `${l.address}${hood ? ` (${hood}${place && !l.address.includes(place.split(",")[0]) ? `, ${place}` : ""})` : ""}`;

      await step("Researching the neighborhood, schools and market");
      const schoolQ = chi.schools.length
        ? chi.schools.map(s => `${s.name} ${s.address} (CPS ${s.cpsId ?? ""}): latest Illinois Report Card summative designation, proficiency or graduation rate, and GreatSchools rating`)
        : geo?.schoolDistricts.length
          ? geo.schoolDistricts.map(d => `${d}: which school is ${l.address} assigned to (attendance boundary / school finder), and that school's latest Illinois Report Card summative designation and GreatSchools rating`)
          : [`Public schools assigned to ${l.address}: elementary, middle and high school names and districts, with latest Illinois Report Card summative designation and GreatSchools ratings`];
      const queries: Record<string, string> = {
        listing: `${l.address}${l.mlsNumber ? ` MLS ${l.mlsNumber}` : ""} home listing details: price, beds, baths, square feet, taxes, year built, features`,
        neighborhood: `Neighborhood around ${where}: highlights, parks, trails, restaurants, coffee, shopping streets, transit (CTA/Metra/Pace), new developments 2025 2026`,
        cons: `Downsides of living in ${hood || where} that home buyers raise: traffic, parking, noise, property taxes, flooding, construction, plus official crime data portal link`,
        market: `${hood || where} housing market 2026: median sale price, days on market, sale-to-list, inventory`,
      };
      schoolQ.slice(0, 3).forEach((q, i) => { queries[`schools_${i + 1}`] = q; });
      const keys = Object.keys(queries);
      const results = await Promise.all(keys.map(k => search(queries[k]).catch(e => `SEARCH FAILED: ${String(e).slice(0, 200)}`)));
      const web = Object.fromEntries(keys.map((k, i) => [k, results[i]]));
      if (results.every(r => r.startsWith("SEARCH FAILED"))) throw new Error(`Web research failed: ${results[0].slice(15, 200)}`);

      const facts = {
        matchedAddress: geo?.matched ?? null,
        neighborhood: hood || null,
        communityArea: chi.communityArea ?? null,
        census,
        schools: chi.schools,
        schoolDistricts: geo?.schoolDistricts ?? [],
        chicagoDataError: "error" in chi ? chi.error : undefined,
        builtAt: Date.now(),
      };
      await ctx.runMutation(internal.listingPlans.setState, { listingId, step: "Writing your plan (about a minute)", facts });

      const data = {
        listing: { address: l.address, mls: l.mlsNumber ?? null, listPrice: l.price ?? null, status: l.status, neighborhood: hood || null, agentNotes: p.notes ?? null, listingAgent: l.agentName },
        census_acs_official: { source: "U.S. Census Bureau ACS 5-year (via Census Reporter)", ...census },
        school_boundaries_official: chi.schools.length ? chi.schools : "No official attendance-boundary feed for this address; use web_research for the assigned schools and flag the assignment for verification.",
        school_districts_official: geo?.schoolDistricts.length ? { source: "U.S. Census Bureau geocoder (school district boundaries)", districts: geo.schoolDistricts } : null,
        web_research: web,
      };
      const r = await callTool<{ result?: Record<string, unknown> | null; error?: string | null }>("ai_structured_output", {
        prompt: `${RULES}\n\nAGENT REQUEST (answer every part):\n${MICHAEL_PROMPT}`,
        input_text: `DATA:\n${JSON.stringify(data)}`,
        output_schema: PLAN_SCHEMA,
        model: "gpt-6.1-sol",
        intelligence_level: "balanced",
      });
      if (!r.result) throw new Error(r.error || "The write-up came back empty");
      await ctx.runMutation(internal.listingPlans.setState, { listingId, status: "ready", plan: r.result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.listingPlans.setState, { listingId, status: "error", error: msg.slice(0, 400) });
    }
    return null;
  },
});
