// CMA Builder (listing-based CMAs) on the new backend: backend/src/modules/cma-builder.
// Responses keep the API's own shape (id, ISO dates): no Convex-style conversion here.
import { api } from "./api";
import { notifyDataChanged } from "./apiData";

export type ReportStatus = "queued" | "collecting" | "normalizing" | "analyzing" | "ready_for_review" | "draft" | "published" | "superseded" | "failed" | "cancelled";
export type ListingCmaStatus = "not_requested" | "queued" | "collecting" | "normalizing" | "analyzing" | "ready_for_review" | "draft" | "published" | "refreshing" | "failed" | "cancelled";
export type PropertyType = "single_family" | "townhome" | "condo" | "multi_2_4" | "land" | "other";
export type CompStatus = "sold" | "pending" | "active" | "off_market";
export type AdjustmentCategory = "size" | "bedrooms" | "bathrooms" | "condition" | "renovation" | "garage" | "lot" | "location" | "features" | "other";

export const PROPERTY_TYPES: [PropertyType, string][] = [["single_family", "Single-family"], ["townhome", "Townhome"], ["condo", "Condo"], ["multi_2_4", "2–4 unit"], ["land", "Land"], ["other", "Other"]];
export const CONDITIONS = ["Needs work", "Original / dated", "Average / well maintained", "Partially updated", "Fully renovated"] as const;
export const ADJUSTMENT_CATEGORIES: [AdjustmentCategory, string][] = [["size", "Size"], ["bedrooms", "Bedrooms"], ["bathrooms", "Bathrooms"], ["condition", "Condition"], ["renovation", "Renovations"], ["garage", "Garage"], ["lot", "Lot size"], ["location", "Location"], ["features", "Features"], ["other", "Other"]];
export const COMP_STATUS_LABEL: Record<CompStatus, string> = { sold: "Sold", pending: "Pending", active: "Active", off_market: "Off market" };
export const typeLabel = (t?: string | null) => PROPERTY_TYPES.find(([k]) => k === t)?.[1] ?? "–";

export type Subject = {
  address: string; street?: string | null; city?: string | null; state?: string | null; zip?: string | null; lat?: number | null; lng?: number | null;
  propertyType: PropertyType; beds?: number | null; baths?: number | null; sqft?: number | null; lotSqft?: number | null; yearBuilt?: number | null;
  condition?: string | null; garageSpaces?: number | null; askingPrice?: number | null; mlsNumber?: string | null; features?: string[];
};
export type SearchParams = {
  radiusMi: 0.5 | 1 | 3 | 5; soldWithinDays: 90 | 180 | 365; sqftMin?: number | null; sqftMax?: number | null; bedsMin?: number | null; bedsMax?: number | null;
  bathsMin?: number | null; propertyTypes: PropertyType[]; statuses: ("sold" | "active" | "pending")[]; instructions?: string | null; provider: string;
};
export type Provider = { id: string; label: string; kind: "browser" | "api" | "manual"; isFixture: boolean; available: boolean; reason: string | null; needs: string[] };
export type Stage = { stage: string; at: string; note?: string };
export type Range = { low: number; high: number; fromAgent: boolean };

export type ListingCmaRequest = {
  id: string; listingId: string; address: string; status: ReportStatus;
  providerLabel: string; version: number; requestedByName: string; createdAt: string;
};
export type ReportSummary = {
  id: string; version: number; status: ReportStatus; trigger: string; provider: string; estimatedValue: number | null; engineValue: number | null; overridden: boolean;
  range: Range | null; askingPrice: number | null; soldCount: number; analysisStatus: "ok" | "insufficient_data" | null; progressNote: string | null; errorMessage: string | null;
  stages: Stage[]; requestedByName: string; reviewedByName: string | null; publishedByName: string | null; dataCollectedAt: string | null; publishedAt: string | null;
  hasPdf: boolean; createdAt: string; updatedAt: string;
};
export type Stats = { count: number; avgPrice: number | null; medianPrice: number | null; avgPpsf: number | null; medianPpsf: number | null; avgDom: number | null; medianDom: number | null; minPrice: number | null; maxPrice: number | null };
export type Analysis = {
  computedAt: string; status: "ok" | "insufficient_data"; insufficientReason?: string; settings: { sizeAdjustmentFactor: number; minSoldComps: number };
  sold: Stats; soldAll: Stats; active: Stats; pending: Stats; soldToListRatio: number | null; soldToListCount: number; estimatedValue: number | null;
  valueRange: { low: number; high: number; method: string } | null; ppsfIndication: number | null; method: string[];
  subjectPositioning: { askingPrice: number | null; askingPpsf: number | null; vsEstimatePct: number | null; position: "below_range" | "within_range" | "above_range" | null };
  quality: { grade: "high" | "medium" | "low" | "insufficient"; score: number; notes: string[] }; warnings: string[];
  comparedToPublished?: { reportId: string; version: number; previousValue: number | null; changePct: number | null; newSales: number } | null;
};
export type Adjustment = { id?: string; category: AdjustmentCategory; amount: number; reason: string; byEmail?: string; at?: string; suggested?: boolean };
export type Comparable = {
  id: string; source: string; sourceRecordId: string | null; sourceUrl: string | null; isFixture: boolean; manual: boolean; status: CompStatus; address: string;
  city: string | null; state: string | null; zip: string | null; lat: number | null; lng: number | null; propertyType: PropertyType | null;
  originalListPrice: number | null; listPrice: number | null; soldPrice: number | null; soldDate: string | null; listDate: string | null; daysOnMarket: number | null;
  beds: number | null; baths: number | null; sqft: number | null; lotSqft: number | null; yearBuilt: number | null; condition: string | null; garageSpaces: number | null;
  features: string[]; distanceMi: number | null; selected: boolean; adjustments: Adjustment[]; notes: string | null; collectedAt: string; similarity: number; coverage: number;
  pricePerSqft: number | null; outlier: boolean; adjustedValue: number | null; adjustmentTotal: number; suggestions: { category: AdjustmentCategory; amount: number; reason: string }[];
};
export type ReportContent = {
  executiveSummary?: string | null; propertyObservations?: string | null; pricingRecommendation?: string | null; marketingRecommendations?: string | null; comparableNotes?: string | null;
  recommendedLow?: number | null; recommendedHigh?: number | null; recommendedListPrice?: number | null;
  sections?: { overview: boolean; comparables: boolean; market: boolean; adjustments: boolean; recommendations: boolean }; showCompAddressesToSeller?: boolean;
};
export type ResearchFact = { label: string; value: string | number; unit?: string; provider: string; dataset: string; url: string; effectiveDate: string | null };
export type PublishedResearch = {
  collectedAt: string; facts: ResearchFact[];
  sales: { date: string; price: number; deed: string; marketCandidate: boolean }[];
  assessments: { year: number; value: number; stage: string }[];
};
export type MarketingFacts = { available: false; rules: string[] } | {
  available: true; propertyFacts: ResearchFact[]; source: string; rules: string[];
  estimatedValue: number | null; range: Range | null; askingPrice: number | null;
  soldComparables: number; medianSoldPrice: number | null; medianPricePerSqft: number | null;
};
export type AgentResearch = Omit<PublishedResearch, "facts"> & {
  facts: Record<string, ResearchFact>; status: "complete" | "partial" | "clarification" | "unavailable";
  issues: { source: string; message: string }[]; approvals: string[];
};
export type Report = ReportSummary & {
  listing: { id: string; address: string; priceCents: number | null; status: string; agentName: string; agentEmail: string; photoUrl: string | null };
  propertyResearch: AgentResearch | null;
  listingStatus: ListingCmaStatus; params: SearchParams; subject: Subject; analysis: Analysis | null;
  override: { value: number; reason: string; byEmail: string; byName: string; at: string } | null; content: ReportContent; editable: boolean;
  providerLabel: string; providerNeedsBrowser: boolean; comparables: Comparable[];
  activity: { id: string; kind: "collection" | "audit"; level: "info" | "warn" | "error"; stage: string | null; message: string; actorEmail: string | null; createdAt: string }[];
  canPublish: boolean;
};
export type CmaStatusResponse = { listingId: string; status: ListingCmaStatus; current: ReportSummary | null; published: ReportSummary | null };
export type Defaults = { listing: { id: string; address: string; price: number | null; status: string; photoUrl: string | null }; subject: Subject; params: SearchParams; prefilledFrom: string | null; missing: string[]; providers: Provider[] };
export type History = { total: number; items: (ReportSummary & { changePct: number | null; newSales: number | null })[]; trend: { at: string; estimatedValue: number; medianSoldPrice: number | null; medianPpsf: number | null; soldCount: number; activeCount: number }[] };
export type MarketingContext = {
  activity: { showings: number; feedback: number; offers: number; priceOpinions: string[]; latestWeek: Record<string, number | string | null> | null; totals: { zillowViews: number; zillowSaves: number; adViews: number; adClicks: number } };
  connectors: { id: string; label: string; connected: boolean; note: string }[]; note: string;
};
export type ImportResult = { imported: number; duplicates: number; rejected: { record: string; reason: string }[]; rejectedCount: number; truncated: boolean; mapping: { header: string; field: string | null }[] };
export type NewComparable = Partial<Omit<Comparable, "id" | "status" | "address">> & { status: CompStatus; address: string };

// Seller
export type SellerState = "none" | "requested" | "processing" | "under_review" | "published" | "refreshing";
export type SellerReport = {
  id: string; version: number; publishedAt: string; agentName: string; askingPrice: number | null; estimatedValue: number | null; range: Range | null; recommendedListPrice: number | null;
  executiveSummary: string | null; propertyObservations: string | null; pricingRecommendation: string | null; marketingRecommendations: string | null;
  propertyResearch: PublishedResearch | null;
  sections: NonNullable<ReportContent["sections"]>;
  stats: { soldCount: number; avgSoldPrice: number | null; medianSoldPrice: number | null; avgPpsf: number | null; medianPpsf: number | null; avgDom: number | null; activeCount: number; pendingCount: number; activeMedianPrice: number | null; soldToListRatio: number | null; subjectAskingPpsf: number | null } | null;
  comparables: { id: string; address: string | null; source: string | null; status: CompStatus; price: number | null; soldDate: string | null; beds: number | null; baths: number | null; sqft: number | null; pricePerSqft: number | null; distanceMi: number | null; daysOnMarket: number | null; isFixture: boolean }[];
  containsFixtures: boolean; hasPdf: boolean; disclaimer: string;
};
export type SellerCma = { state: SellerState; report: SellerReport | null; history: { version: number; publishedAt: string; estimatedValue: number; range: Range | null; askingPrice: number | null }[] };

const enc = encodeURIComponent;
const send = async <T>(method: "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> => {
  const r = await api<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  notifyDataChanged();
  return r;
};

export type ReportFormat = "pdf" | "pptx";
export type ReportFile = { status: "ready" | "rendering"; url: string | null; version: number };

export const cmaBuilderApi = {
  requests: () => api<ListingCmaRequest[]>("/cma-reports"),
  defaults: (listingId: string) => api<Defaults>(`/listings/${enc(listingId)}/cma/defaults`),
  status: (listingId: string) => api<CmaStatusResponse>(`/listings/${enc(listingId)}/cma/status`),
  current: (listingId: string) => api<CmaStatusResponse & { report: Report | null }>(`/listings/${enc(listingId)}/cma`),
  history: (listingId: string) => api<History>(`/listings/${enc(listingId)}/cma/history?limit=50`),
  marketingFacts: (listingId: string) => api<MarketingFacts>(`/listings/${enc(listingId)}/cma/facts`),
  context: (listingId: string) => api<MarketingContext>(`/listings/${enc(listingId)}/cma/context`),
  request: (listingId: string, body: { subject: Subject } & SearchParams) => send<{ id: string; version: number; status: ReportStatus }>("POST", `/listings/${enc(listingId)}/cma/request`, body),

  get: (id: string) => api<Report>(`/cma-reports/${enc(id)}`),
  update: (id: string, patch: { subject?: Partial<Subject>; researchApprovals?: string[]; content?: ReportContent; override?: { value: number; reason: string } | null; settings?: { sizeAdjustmentFactor: number } }) => send<Report>("PATCH", `/cma-reports/${enc(id)}`, patch),
  addComparable: (id: string, c: NewComparable) => send<Comparable>("POST", `/cma-reports/${enc(id)}/comparables`, c),
  updateComparable: (id: string, compId: string, patch: { selected?: boolean; adjustments?: Adjustment[]; notes?: string | null; fields?: Partial<NewComparable> }) =>
    send<Comparable>("PATCH", `/cma-reports/${enc(id)}/comparables/${enc(compId)}`, {
      ...patch,
      adjustments: patch.adjustments?.map(a => ({ id: a.id, category: a.category, amount: a.amount, reason: a.reason, suggested: a.suggested })),
    }),
  removeComparable: (id: string, compId: string) => send<{ ok: true }>("DELETE", `/cma-reports/${enc(id)}/comparables/${enc(compId)}`),
  setSelection: (id: string, selectedIds: string[]) => send<Report>("PUT", `/cma-reports/${enc(id)}/comparables/selection`, { selectedIds }),
  importCsv: (id: string, csv: string) => send<ImportResult>("POST", `/cma-reports/${enc(id)}/import`, { csv }),
  calculate: (id: string) => send<Report>("POST", `/cma-reports/${enc(id)}/calculate`),
  publish: (id: string) => send<ReportSummary & { alreadyPublished: boolean }>("POST", `/cma-reports/${enc(id)}/publish`, { confirm: true }),
  revise: (id: string) => send<{ id: string; version: number; status: ReportStatus }>("POST", `/cma-reports/${enc(id)}/revise`),
  providers: (listingId: string) => api<{ items: Provider[] }>(`/listings/${enc(listingId)}/cma/providers`),
  refresh: (id: string, provider?: string) => send<{ id: string; version: number; status: ReportStatus }>("POST", `/cma-reports/${enc(id)}/refresh`, provider ? { provider } : undefined),
  retry: (id: string) => send<{ id: string; version: number; status: ReportStatus }>("POST", `/cma-reports/${enc(id)}/retry`),
  cancel: (id: string) => send<{ id: string; status: ReportStatus }>("POST", `/cma-reports/${enc(id)}/cancel`),
  pdf: (id: string, format: ReportFormat = "pdf", download = false) =>
    api<ReportFile>(`/cma-reports/${enc(id)}/pdf?format=${format}&download=${download ? 1 : 0}`, { signal: AbortSignal.timeout(60_000) }),
  seller: (token: string) => api<SellerCma>(`/portal/${enc(token)}/cma`),
  sellerPdf: (token: string, format: ReportFormat = "pdf", download = false) =>
    api<ReportFile>(`/portal/${enc(token)}/cma/pdf?format=${format}&download=${download ? 1 : 0}`, { signal: AbortSignal.timeout(60_000) }),
};

// ---------- Display helpers ----------

export const money = (n: number | null | undefined) => (n == null ? "–" : `$${Math.round(n).toLocaleString("en-US")}`);
export const compactMoney = (n: number | null | undefined) =>
  n == null ? "–" : n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`;
export const num = (n: number | null | undefined, digits = 0) => (n == null ? "–" : n.toLocaleString("en-US", { maximumFractionDigits: digits }));
export const shortDate = (d?: string | null) => (d ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "–");
export const dateTime = (d?: string | null) => (d ? new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "–");

/** Collection pipeline as the agent sees it. */
export const PIPELINE: { key: ReportStatus; label: string }[] = [
  { key: "queued", label: "Queued" },
  { key: "collecting", label: "Collecting comparables" },
  { key: "normalizing", label: "Cleaning & de-duplicating" },
  { key: "analyzing", label: "Calculating" },
  { key: "ready_for_review", label: "Ready for review" },
];
export const ACTIVE: ListingCmaStatus[] = ["queued", "collecting", "normalizing", "analyzing", "refreshing"];

export const STATUS_LABEL: Record<ListingCmaStatus | ReportStatus, string> = {
  not_requested: "Not requested", queued: "Queued", collecting: "Collecting", normalizing: "Cleaning data", analyzing: "Analyzing", ready_for_review: "Ready for review",
  draft: "Draft", published: "Published", superseded: "Earlier version", refreshing: "Refreshing", failed: "Failed", cancelled: "Cancelled",
};

/** The listing page's CMA button: label for each status. */
export const BUTTON_LABEL: Record<ListingCmaStatus, string> = {
  not_requested: "Request CMA", queued: "View progress", collecting: "View progress", normalizing: "View progress", analyzing: "View progress",
  ready_for_review: "Open CMA Builder", draft: "Continue editing", published: "View CMA", refreshing: "View update progress", failed: "Retry CMA", cancelled: "Request CMA",
};
