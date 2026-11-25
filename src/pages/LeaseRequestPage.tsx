import { SCHOOL_OPTIONS, SCHOOLS_HINT } from "@/lib/cmaSchools";
import { useApiData } from "@/lib/apiData";
import { CMA_TYPING, MAX_UPLOAD_MB, cmaApi, cmaErrorMessage, cmaFieldProblems } from "@/lib/cmaApi";
import {
  Building2,
  CheckCircle2,
  FileUp,
  Home,
  Loader2,
  Paperclip,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AGENTS } from "@/lib/agents";
import { Choice, Field } from "./NewRequestPage";
import { VoiceFill, type VoiceResult } from "@/components/hub/VoiceFill";

type Kind = "residential" | "commercial";

// Building types the agent picks from (stored as propertyType).
const RES_BUILDINGS: [string, string][] = [
  ["Single-family house", "Whole house"],
  ["Townhome / rowhouse", "Attached, own entrance"],
  ["Condo unit", "Unit in a condo association"],
  ["2–4 flat apartment", "Unit in a 2–4 unit building"],
  ["Apartment in 5+ unit building", "Courtyard, walk-up, mid-rise"],
  ["High-rise / luxury rental", "Doorman, elevator, amenities"],
  ["Garden / basement unit", "Lower-level apartment"],
  ["Coach house / ADU", "Rear or accessory unit"],
  ["Other residential", "Describe in notes"],
];
const COM_BUILDINGS: [string, string][] = [
  ["Retail / storefront", "Street retail, strip center"],
  ["Restaurant / food service", "Kitchen, hood, grease trap"],
  ["Office", "General office suite or floor"],
  ["Medical / dental office", "Exam rooms, plumbing"],
  ["Industrial / warehouse / flex", "Docks, clear height, yard"],
  ["Mixed-use ground floor", "Commercial unit under apartments"],
  ["Laundromat / service business space", "Utilities, venting, drains"],
  ["Whole building (master lease)", "Entire building to one tenant"],
  ["Land / ground lease / parking", "Lot, pad site, parking"],
  ["Other commercial", "Describe in notes"],
];

const CLIENT_ROLES = [
  "Landlord / owner (pricing a rental)",
  "Tenant (looking to lease)",
  "Investor (underwriting rents)",
];
const RES_PURPOSES = [
  "Set the asking rent for a new listing",
  "Renewal / rent increase check",
  "Tenant offer support",
  "Investor rent underwriting",
];
const COM_PURPOSES = [
  "Set the asking rate for a vacancy",
  "Lease renewal / renegotiation",
  "Tenant offer support",
  "Investor / lender rent underwriting",
];
const RES_CONDITIONS = [
  "Needs work",
  "Original / dated",
  "Average / well maintained",
  "Partially updated",
  "Fully renovated / new",
];
const COM_CONDITIONS = [
  "Vanilla shell / cold dark shell",
  "Second-generation (prior build-out)",
  "Turnkey / move-in ready",
  "Needs major work",
  "New construction",
];
const PARKING = [
  "None / street only",
  "Permit street parking",
  "Assigned outdoor space",
  "Garage space included",
  "Garage available for extra fee",
];
const LAUNDRY = ["In-unit", "In building (shared)", "Hookups only", "None"];
const PETS = ["Cats & dogs OK", "Cats only", "Case by case", "No pets"];
const FURNISHED = ["Unfurnished", "Partially furnished", "Furnished"];
const UTILITIES = ["Heat", "Water", "Gas", "Electric", "Trash", "Internet"];
const RES_AMENITIES = [
  "Central A/C",
  "Dishwasher",
  "Private outdoor space",
  "Fireplace",
  "Storage",
  "Elevator",
  "Doorman",
  "Fitness center",
  "Pool",
  "Rooftop deck",
  "Bike room",
  "EV charging",
];
const LEASE_STRUCTURES = [
  "NNN (tenant pays taxes, insurance, CAM)",
  "Modified gross",
  "Full-service gross",
  "Not sure, recommend one",
];
const COM_FEATURES = [
  "Street frontage / signage",
  "Corner location",
  "Drive-thru",
  "Grease trap / hood",
  "Loading dock(s)",
  "Drive-in door(s)",
  "3-phase power",
  "Sprinklered",
  "ADA restrooms",
  "On-site parking",
  "Outdoor seating / patio",
  "Basement storage",
];
const BRANDING = [
  "SpaceMatch · a team of Real Broker",
  "SpaceMatch only (no brokerage)",
];

const MAX_FILE_MB = MAX_UPLOAD_MB; // Supabase free plan: 50 MB per file
const fmtSize = (n: number) =>
  n > 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1024))} KB`;

const emptyForm = {
  agentName: "",
  agentEmail: "",
  agentPhone: "",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  street: "",
  unit: "",
  city: "",
  state: "IL",
  zip: "",
  propertyType: "",
  purpose: RES_PURPOSES[0],
  condition: "",
  knownIssues: "",
  timeline: "",
  neededBy: "",
  branding: BRANDING[0],
  schools: SCHOOL_OPTIONS[0],
  compNotes: "",
  notes: "",
};
type FormState = typeof emptyForm;

// Everything lease-specific lives in request.lease (string map).
const emptyLease = {
  clientRole: CLIENT_ROLES[0],
  // residential
  beds: "",
  bathsFull: "",
  bathsHalf: "",
  sqft: "",
  floor: "",
  yearBuilt: "",
  parking: "",
  laundry: "",
  pets: "",
  furnished: "",
  utilitiesIncluded: "",
  amenities: "",
  // commercial
  spaceSf: "",
  buildingSf: "",
  suite: "",
  frontage: "",
  ceilingHeight: "",
  docks: "",
  zoning: "",
  currentUse: "",
  leaseStructure: "",
  camEstimate: "",
  tiExpectation: "",
  features: "",
  // both
  currentRent: "",
  askingRent: "",
  availableDate: "",
  leaseTerm: "",
  recentUpdates: "",
};
type LeaseState = typeof emptyLease;

// "Talk it in" (Michael 2026-11-22): chip labels for fields a voice fill can set.
const VOICE_FORM: Partial<Record<keyof FormState, string>> = {
  clientName: "Client", clientEmail: "Client email", clientPhone: "Client phone",
  street: "Street", unit: "Unit", city: "City", state: "State", zip: "ZIP",
  propertyType: "Building type", purpose: "Purpose", condition: "Condition",
  knownIssues: "Known issues", timeline: "Timeline", neededBy: "Needed by", compNotes: "Comp notes",
};
const VOICE_LEASE: Partial<Record<keyof LeaseState, string>> = {
  clientRole: "Client role",
  beds: "Beds", bathsFull: "Full baths", bathsHalf: "Half baths", sqft: "Sq ft", floor: "Floor",
  yearBuilt: "Year built", parking: "Parking", laundry: "Laundry", pets: "Pets", furnished: "Furnished",
  utilitiesIncluded: "Utilities", amenities: "Amenities",
  spaceSf: "Space SF", buildingSf: "Building SF", suite: "Suite", frontage: "Frontage",
  ceilingHeight: "Ceiling height", docks: "Docks", zoning: "Zoning", currentUse: "Current use",
  leaseStructure: "Lease structure", camEstimate: "CAM", tiExpectation: "TI", features: "Features",
  currentRent: "Current rent", askingRent: "Rent wanted", availableDate: "Available", leaseTerm: "Lease term",
  recentUpdates: "Recent updates",
};
const VOICE_DATES = new Set(["neededBy", "availableDate"]);
const VOICE_APPEND = new Set(["knownIssues", "compNotes", "recentUpdates", "tiExpectation"]);
const VOICE_MULTI = new Set(["utilitiesIncluded", "amenities", "features"]);

const splitList = (s: string) =>
  s
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);

function MultiCheck({
  options,
  value,
  onChange,
  prefix,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  prefix: string;
}) {
  const sel = splitList(value);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {options.map(o => {
        const id = `${prefix}-${o.replace(/\W+/g, "-").toLowerCase()}`;
        const on = sel.includes(o);
        return (
          <label
            key={o}
            htmlFor={id}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${on ? "border-primary bg-primary/5" : "bg-white"}`}
          >
            <Checkbox
              id={id}
              checked={on}
              onCheckedChange={c =>
                onChange(
                  (c === true ? [...sel, o] : sel.filter(x => x !== o)).join(
                    ", ",
                  ),
                )
              }
            />
            {o}
          </label>
        );
      })}
    </div>
  );
}

type SavedAttachment = {
  storageId: string;
  name: string;
  size: number;
  contentType?: string;
};

export function LeaseRequestPage() {
  const { id: editParam } = useParams();
  const editId = editParam;
  const navigate = useNavigate();
  const existingRes = useApiData(editId ? `cma:${editId}` : null, () => cmaApi.get(editId!));
  // undefined = loading, null = not found
  const existing = existingRes.notFound ? null : existingRes.data;
  const me = useApiData("cma:me", () => cmaApi.me()).data;
  const [kind, setKind] = useState<Kind>("residential");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [lease, setLease] = useState<LeaseState>(emptyLease);
  const [kept, setKept] = useState<SavedAttachment[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadMsg, setUploadMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const prefilled = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = (k: keyof FormState) => (v: string) =>
    setForm(f => ({ ...f, [k]: v }));
  const setInput =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // Number / ZIP / phone fields only take the characters they allow.
      const value = (CMA_TYPING[k] ?? (v => v))(e.target.value);
      setForm(f => ({ ...f, [k]: value }));
    };
  const setL = (k: keyof LeaseState) => (v: string) =>
    setLease(l => ({ ...l, [k]: v }));
  const setLInput =
    (k: keyof LeaseState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = (CMA_TYPING[k] ?? (v => v))(e.target.value);
      setLease(l => ({ ...l, [k]: value }));
    };

  useEffect(() => {
    if (!existing || prefilled.current) return;
    prefilled.current = true;
    const r = existing as Record<string, unknown> & typeof existing;
    setKind(r.kind === "commercial" ? "commercial" : "residential");
    setForm(
      Object.fromEntries(
        Object.keys(emptyForm).map(k => {
          const v = r[k];
          return [
            k,
            typeof v === "string" && v
              ? v
              : k === "schools"
                ? "" // filed before the schools option: leave unset
                : emptyForm[k as keyof FormState],
          ];
        }),
      ) as FormState,
    );
    setLease({ ...emptyLease, ...(existing.lease ?? {}) });
    setKept(
      (existing.attachments ?? []).map(a => ({
        storageId: a.storageId,
        name: a.name,
        size: a.size,
        contentType: a.contentType,
      })),
    );
  }, [existing]);

  useEffect(() => {
    if (editId || !me?.email || form.agentName) return;
    const a = AGENTS.find(x => x.email.toLowerCase() === me.email);
    if (a) {
      setForm(f => ({
        ...f,
        agentName: a.name,
        agentEmail: a.email,
        agentPhone: a.phone,
      }));
    }
  }, [me, form.agentName, editId]);

  const switchKind = (k: Kind) => {
    if (k === kind) return;
    setKind(k);
    setForm(f => ({
      ...f,
      propertyType: "",
      purpose: k === "commercial" ? COM_PURPOSES[0] : RES_PURPOSES[0],
      condition: "",
    }));
  };

  // "Talk it in": only the form's own choices for pick fields, multi-picks merged, notes appended.
  const voiceSnap = useRef<{ form: FormState; lease: LeaseState } | null>(null);
  const voiceEnums: Record<string, string[]> =
    kind === "commercial"
      ? {
          propertyType: COM_BUILDINGS.map(b => b[0]),
          clientRole: CLIENT_ROLES,
          purpose: COM_PURPOSES,
          condition: COM_CONDITIONS,
          leaseStructure: LEASE_STRUCTURES,
          features: COM_FEATURES,
        }
      : {
          propertyType: RES_BUILDINGS.map(b => b[0]),
          clientRole: CLIENT_ROLES,
          purpose: RES_PURPOSES,
          condition: RES_CONDITIONS,
          parking: PARKING,
          laundry: LAUNDRY,
          pets: PETS,
          furnished: FURNISHED,
          utilitiesIncluded: UTILITIES,
          amenities: RES_AMENITIES,
        };
  const applyVoice = (r: VoiceResult): string[] => {
    voiceSnap.current = { form, lease };
    const labels: string[] = [];
    const pick = (k: string, cur: string): string | null => {
      const raw = r[k];
      const allowed = voiceEnums[k];
      if (VOICE_MULTI.has(k)) {
        const add = (Array.isArray(raw) ? raw : []).map(x => String(x).trim()).filter(x => allowed?.includes(x));
        const have = splitList(cur);
        const merged = [...have, ...add.filter(x => !have.includes(x))];
        return merged.length > have.length ? merged.join(", ") : null;
      }
      let v = typeof raw === "string" ? raw.trim() : "";
      if (!v) return null;
      if (allowed && !allowed.includes(v)) return null;
      if (VOICE_DATES.has(k) && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
      if (k === "state") {
        v = v.toUpperCase();
        if (!/^[A-Z]{2}$/.test(v)) return null;
      }
      if (VOICE_APPEND.has(k) && cur && !cur.includes(v)) v = `${cur}\n${v}`;
      return v === cur ? null : v;
    };
    const nextForm = { ...form };
    for (const k of Object.keys(VOICE_FORM) as (keyof FormState)[]) {
      const v = pick(k, nextForm[k]);
      if (v === null) continue;
      nextForm[k] = v;
      labels.push(VOICE_FORM[k]!);
    }
    const extra = typeof r.notes === "string" ? r.notes.trim() : "";
    if (extra && !nextForm.notes.includes(extra)) {
      nextForm.notes = nextForm.notes ? `${nextForm.notes}\n${extra}` : extra;
      labels.push("Notes");
    }
    const nextLease = { ...lease };
    for (const k of Object.keys(VOICE_LEASE) as (keyof LeaseState)[]) {
      if (!(k in r)) continue;
      const v = pick(k, nextLease[k]);
      if (v === null) continue;
      nextLease[k] = v;
      labels.push(VOICE_LEASE[k]!);
    }
    setForm(nextForm);
    setLease(nextLease);
    return labels;
  };
  const undoVoice = () => {
    const snap = voiceSnap.current;
    if (!snap) return;
    setForm(snap.form);
    setLease(snap.lease);
    voiceSnap.current = null;
    toast.info("Voice fill undone");
  };

  const pickAgent = (name: string) => {
    const a = AGENTS.find(x => x.name === name);
    setForm(f => ({
      ...f,
      agentName: name,
      agentEmail: a?.email ?? f.agentEmail,
      agentPhone: a?.phone ?? f.agentPhone,
    }));
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    const tooBig = picked.filter(f => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig.length) {
      toast.error(
        `Over ${MAX_FILE_MB} MB, skipped: ${tooBig.map(f => f.name).join(", ")}`,
      );
    }
    setFiles(cur => {
      const ok = picked.filter(
        f =>
          f.size <= MAX_FILE_MB * 1024 * 1024 &&
          !cur.some(c => c.name === f.name && c.size === f.size),
      );
      return [...cur, ...ok].slice(0, Math.max(0, 25 - kept.length));
    });
    if (fileInput.current) fileInput.current.value = "";
  };

  const uploadAll = async () => {
    const out: SavedAttachment[] = [];
    for (const [i, f] of files.entries()) {
      setUploadMsg(`Uploading ${i + 1} of ${files.length}: ${f.name}`);
      out.push(await cmaApi.upload(f));
    }
    setUploadMsg("");
    return out;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!form.agentName) missing.push("agent");
    if (!form.propertyType) missing.push("building type");
    if (!form.clientName.trim()) missing.push("client name");
    if (!form.street.trim()) missing.push("street address");
    if (!form.city.trim()) missing.push("city");
    if (!form.zip.trim()) missing.push("ZIP");
    if (!form.condition) missing.push("condition");
    if (missing.length) {
      toast.error(`Please fill in: ${missing.join(", ")}`);
      return;
    }
    // Same format checks as the backend (lease beds/sqft/year live in the lease section).
    const problems = cmaFieldProblems({ ...form, ...lease });
    if (problems.length) {
      toast.error(problems.slice(0, 3).join(" "));
      return;
    }
    setSubmitting(true);
    try {
      const clean = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v.trim()]),
      ) as FormState;
      const opt = (v: string) => (v ? v : undefined);
      const attachments = await uploadAll();
      const resKeys = [
        "beds",
        "bathsFull",
        "bathsHalf",
        "sqft",
        "floor",
        "yearBuilt",
        "parking",
        "laundry",
        "pets",
        "furnished",
        "utilitiesIncluded",
        "amenities",
      ];
      const comKeys = [
        "spaceSf",
        "buildingSf",
        "suite",
        "frontage",
        "ceilingHeight",
        "docks",
        "zoning",
        "currentUse",
        "leaseStructure",
        "camEstimate",
        "tiExpectation",
        "features",
      ];
      const drop = kind === "commercial" ? resKeys : comKeys;
      const leaseOut = Object.fromEntries(
        Object.entries(lease)
          .filter(([k]) => !drop.includes(k))
          .map(([k, v]) => [k, v.trim()])
          .filter(([, v]) => v),
      );
      const payload = {
        reportType: "lease" as const,
        lease: leaseOut,
        kind,
        // biome-ignore lint/suspicious/noExplicitAny: storage ids from upload
        attachments: [...kept, ...attachments] as any,
        agentName: clean.agentName,
        agentEmail: clean.agentEmail,
        agentPhone: opt(clean.agentPhone),
        clientName: clean.clientName,
        clientEmail: opt(clean.clientEmail),
        clientPhone: opt(clean.clientPhone),
        street: clean.street,
        unit: opt(clean.unit),
        city: clean.city,
        state: clean.state || "IL",
        zip: clean.zip,
        propertyType: clean.propertyType,
        beds: kind === "residential" ? opt(lease.beds.trim()) : undefined,
        bathsFull:
          kind === "residential" ? opt(lease.bathsFull.trim()) : undefined,
        bathsHalf:
          kind === "residential" ? opt(lease.bathsHalf.trim()) : undefined,
        sqft:
          kind === "residential"
            ? opt(lease.sqft.trim())
            : opt(lease.spaceSf.trim()),
        yearBuilt:
          kind === "residential" ? opt(lease.yearBuilt.trim()) : undefined,
        condition: clean.condition,
        upgrades: [],
        knownIssues: opt(clean.knownIssues),
        sellerPriceExpectation: opt(lease.askingRent.trim()),
        timeline: opt(clean.timeline),
        purpose: clean.purpose,
        neededBy: opt(clean.neededBy),
        branding: clean.branding,
        schools: kind === "commercial" ? undefined : opt(clean.schools),
        compNotes: opt(clean.compNotes),
        notes: opt(clean.notes),
      };
      if (editId) {
        const res = await cmaApi.update(editId, payload);
        toast.success(
          !res.changed.length
            ? "No changes to save"
            : res.status === "submitted"
              ? "Saved. Viktor will use the updated details."
              : "Saved. Viktor is rebuilding the lease CMA with your changes.",
        );
        navigate("/requests");
        return;
      }
      const created = await cmaApi.submit(payload);
      setDone(created._id);
      if (created.status === "approval") toast.info(created.statusNote ?? "Over the monthly limit: sent to an admin for approval.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(cmaErrorMessage(err));
    } finally {
      setSubmitting(false);
      setUploadMsg("");
    }
  };

  if (done) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <CheckCircle2 className="size-12 mx-auto text-primary" />
            <h1 className="text-2xl font-bold" data-testid="lease-done">
              Lease CMA request received
            </h1>
            <p className="text-muted-foreground">
              Viktor will pull{" "}
              {kind === "commercial"
                ? "commercial lease comps"
                : "MLS rental comps"}{" "}
              for <strong className="text-foreground">{form.street}</strong> and
              build a branded rent analysis with a suggested asking{" "}
              {kind === "commercial" ? "rate" : "rent"} and a comps workbook.
              Requests are picked up every 15 minutes (7am–9pm). The PDF shows
              up under My requests.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <Button asChild>
                <Link to="/requests">View my requests</Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setForm({
                    ...emptyForm,
                    agentName: form.agentName,
                    agentEmail: form.agentEmail,
                    agentPhone: form.agentPhone,
                  });
                  setLease(emptyLease);
                  setFiles([]);
                  setDone(null);
                }}
              >
                New lease request
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (editId && existing === undefined) {
    return (
      <div className="max-w-3xl mx-auto py-16 flex justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (editId && existing === null) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center text-muted-foreground">
        Request not found.{" "}
        <Link to="/requests" className="text-primary underline">
          Back to my requests
        </Link>
      </div>
    );
  }

  const buildings = kind === "commercial" ? COM_BUILDINGS : RES_BUILDINGS;
  const com = kind === "commercial";

  return (
    <form onSubmit={onSubmit} className="max-w-3xl mx-auto space-y-6 pb-16">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          SpaceMatch · Lease CMA request
        </p>
        <h1 className="text-3xl md:text-4xl font-bold">
          {editId ? "Edit lease CMA request" : "Request a lease CMA"}
        </h1>
        <p className="text-muted-foreground">
          {com
            ? "For a storefront, office, industrial or other commercial space. Viktor pulls lease comps, compares $/SF and lease structure, and builds a branded rent analysis with a suggested asking rate."
            : "For a house, condo or apartment for rent. Viktor pulls MLS rental comps, adjusts for size, parking, laundry and finishes, and builds a branded rent analysis with a suggested asking rent."}{" "}
          Only <strong>*</strong> fields are required.
        </p>
      </div>

      <div
        className="grid grid-cols-2 gap-3"
        role="radiogroup"
        aria-label="Property kind"
      >
        {(
          [
            [
              "residential",
              "Residential lease",
              "House, condo, apartment",
              Home,
            ],
            [
              "commercial",
              "Commercial lease",
              "Retail, office, industrial, restaurant",
              Building2,
            ],
          ] as const
        ).map(([k, title, sub, Icon]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            data-testid={`lease-kind-${k}`}
            onClick={() => switchKind(k)}
            className={`text-left rounded-xl border-2 p-4 transition-colors ${
              kind === k
                ? "border-primary bg-primary/5"
                : "border-border bg-white hover:border-primary/40"
            }`}
          >
            <Icon
              className={`size-5 mb-2 ${kind === k ? "text-primary" : "text-muted-foreground"}`}
            />
            <div className="font-semibold">{title}</div>
            <div className="text-xs text-muted-foreground">{sub}</div>
          </button>
        ))}
      </div>

      <VoiceFill
        mode="lease"
        kind={kind}
        options={voiceEnums}
        onFill={applyVoice}
        onUndo={undoVoice}
      />

      <Card>
        <CardHeader>
          <CardTitle>1 · Type of building *</CardTitle>
          <CardDescription>
            Pick the closest match. It decides which comps Viktor pulls.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-2"
            role="radiogroup"
            aria-label="Building type"
          >
            {buildings.map(([name, sub]) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={form.propertyType === name}
                data-testid={`bt-${name.replace(/\W+/g, "-").toLowerCase()}`}
                onClick={() => set("propertyType")(name)}
                className={`text-left rounded-lg border-2 px-3 py-2.5 transition-colors ${
                  form.propertyType === name
                    ? "border-primary bg-primary/5"
                    : "border-border bg-white hover:border-primary/40"
                }`}
              >
                <div className="text-sm font-semibold">{name}</div>
                <div className="text-xs text-muted-foreground">{sub}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2 · Agent & client</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-6">
          <Field label="Agent *" className="sm:col-span-2">
            <Choice
              id="lease-agent"
              value={form.agentName}
              onChange={pickAgent}
              options={AGENTS.map(a => a.name)}
              placeholder="Choose agent"
            />
          </Field>
          <Field label="Agent email" className="sm:col-span-2">
            <Input
              value={form.agentEmail}
              onChange={setInput("agentEmail")}
              className="bg-white"
            />
          </Field>
          <Field label="Agent cell" className="sm:col-span-2">
            <Input
              value={form.agentPhone}
              onChange={setInput("agentPhone")}
              className="bg-white"
            />
          </Field>
          <Field label="Client name *" className="sm:col-span-2">
            <Input
              name="clientName"
              value={form.clientName}
              onChange={setInput("clientName")}
              className="bg-white"
            />
          </Field>
          <Field label="Client email" className="sm:col-span-2">
            <Input
              type="email"
              value={form.clientEmail}
              onChange={setInput("clientEmail")}
              className="bg-white"
            />
          </Field>
          <Field label="Client phone" className="sm:col-span-2">
            <Input
              value={form.clientPhone}
              onChange={setInput("clientPhone")}
              className="bg-white"
            />
          </Field>
          <Field label="Client is the" className="sm:col-span-3">
            <Choice
              value={lease.clientRole}
              onChange={setL("clientRole")}
              options={CLIENT_ROLES}
            />
          </Field>
          <Field label="Purpose" className="sm:col-span-3">
            <Choice
              key={`lp-${kind}`}
              value={form.purpose}
              onChange={set("purpose")}
              options={com ? COM_PURPOSES : RES_PURPOSES}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3 · Property address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-6">
          <Field label="Street address *" className="sm:col-span-4">
            <Input
              name="street"
              placeholder="676 N Michigan Ave"
              value={form.street}
              onChange={setInput("street")}
              className="bg-white"
            />
          </Field>
          <Field
            label={com ? "Suite / unit" : "Unit #"}
            className="sm:col-span-2"
          >
            <Input
              value={form.unit}
              onChange={setInput("unit")}
              className="bg-white"
            />
          </Field>
          <Field label="City *" className="sm:col-span-3">
            <Input
              name="city"
              value={form.city}
              onChange={setInput("city")}
              className="bg-white"
            />
          </Field>
          <Field label="State" className="sm:col-span-1">
            <Input
              value={form.state}
              onChange={setInput("state")}
              className="bg-white"
            />
          </Field>
          <Field label="ZIP *" className="sm:col-span-2">
            <Input
              name="zip"
              value={form.zip}
              onChange={setInput("zip")}
              className="bg-white"
            />
          </Field>
        </CardContent>
      </Card>

      {!com && (
        <Card>
          <CardHeader>
            <CardTitle>4 · Rental facts</CardTitle>
            <CardDescription>
              Leave blank what MLS or county records already show.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 grid-cols-2 sm:grid-cols-6">
            <Field label="Beds">
              <Input
                inputMode="numeric"
                value={lease.beds}
                onChange={setLInput("beds")}
                className="bg-white"
              />
            </Field>
            <Field label="Full baths">
              <Input
                inputMode="numeric"
                value={lease.bathsFull}
                onChange={setLInput("bathsFull")}
                className="bg-white"
              />
            </Field>
            <Field label="Half baths">
              <Input
                inputMode="numeric"
                value={lease.bathsHalf}
                onChange={setLInput("bathsHalf")}
                className="bg-white"
              />
            </Field>
            <Field label="Sq ft">
              <Input
                inputMode="numeric"
                value={lease.sqft}
                onChange={setLInput("sqft")}
                className="bg-white"
              />
            </Field>
            <Field label="Floor / level">
              <Input
                placeholder="e.g. 2nd"
                value={lease.floor}
                onChange={setLInput("floor")}
                className="bg-white"
              />
            </Field>
            <Field label="Year built">
              <Input
                inputMode="numeric"
                value={lease.yearBuilt}
                onChange={setLInput("yearBuilt")}
                className="bg-white"
              />
            </Field>
            <Field label="Parking" className="col-span-2 sm:col-span-2">
              <Choice
                value={lease.parking}
                onChange={setL("parking")}
                options={PARKING}
              />
            </Field>
            <Field label="Laundry" className="col-span-1 sm:col-span-2">
              <Choice
                value={lease.laundry}
                onChange={setL("laundry")}
                options={LAUNDRY}
              />
            </Field>
            <Field label="Pets" className="col-span-1 sm:col-span-2">
              <Choice
                value={lease.pets}
                onChange={setL("pets")}
                options={PETS}
              />
            </Field>
            <Field label="Furnished" className="col-span-1 sm:col-span-2">
              <Choice
                value={lease.furnished}
                onChange={setL("furnished")}
                options={FURNISHED}
              />
            </Field>
            <Field label="Condition *" className="col-span-1 sm:col-span-4">
              <Choice
                id="lease-condition"
                value={form.condition}
                onChange={set("condition")}
                options={RES_CONDITIONS}
              />
            </Field>
            <Field
              label="Utilities included in rent"
              className="col-span-2 sm:col-span-6"
            >
              <MultiCheck
                prefix="util"
                options={UTILITIES}
                value={lease.utilitiesIncluded}
                onChange={setL("utilitiesIncluded")}
              />
            </Field>
            <Field label="Amenities" className="col-span-2 sm:col-span-6">
              <MultiCheck
                prefix="amen"
                options={RES_AMENITIES}
                value={lease.amenities}
                onChange={setL("amenities")}
              />
            </Field>
          </CardContent>
        </Card>
      )}

      {com && (
        <Card>
          <CardHeader>
            <CardTitle>4 · Space facts</CardTitle>
            <CardDescription>
              Fill in what you know; a floor plan or flyer below can cover the
              rest.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 grid-cols-2 sm:grid-cols-6">
            <Field label="Space sq ft (leasable)" className="sm:col-span-2">
              <Input
                inputMode="numeric"
                value={lease.spaceSf}
                onChange={setLInput("spaceSf")}
                className="bg-white"
              />
            </Field>
            <Field label="Building sq ft" className="sm:col-span-2">
              <Input
                inputMode="numeric"
                value={lease.buildingSf}
                onChange={setLInput("buildingSf")}
                className="bg-white"
              />
            </Field>
            <Field label="Floor" className="sm:col-span-2">
              <Input
                placeholder="Ground, 2nd…"
                value={lease.suite}
                onChange={setLInput("suite")}
                className="bg-white"
              />
            </Field>
            <Field label="Frontage (ft)" className="sm:col-span-2">
              <Input
                inputMode="numeric"
                value={lease.frontage}
                onChange={setLInput("frontage")}
                className="bg-white"
              />
            </Field>
            <Field label="Ceiling / clear height" className="sm:col-span-2">
              <Input
                placeholder="e.g. 14 ft"
                value={lease.ceilingHeight}
                onChange={setLInput("ceilingHeight")}
                className="bg-white"
              />
            </Field>
            <Field label="Zoning" className="sm:col-span-2">
              <Input
                placeholder="e.g. B3-2"
                value={lease.zoning}
                onChange={setLInput("zoning")}
                className="bg-white"
              />
            </Field>
            <Field
              label="Current / last use"
              className="col-span-2 sm:col-span-3"
            >
              <Input
                placeholder="e.g. hair salon, vacant since May"
                value={lease.currentUse}
                onChange={setLInput("currentUse")}
                className="bg-white"
              />
            </Field>
            <Field
              label="Build-out condition *"
              className="col-span-2 sm:col-span-3"
            >
              <Choice
                id="lease-condition"
                value={form.condition}
                onChange={set("condition")}
                options={COM_CONDITIONS}
              />
            </Field>
            <Field label="Lease structure" className="col-span-2 sm:col-span-3">
              <Choice
                value={lease.leaseStructure}
                onChange={setL("leaseStructure")}
                options={LEASE_STRUCTURES}
              />
            </Field>
            <Field
              label="Taxes + CAM + insurance ($/SF/yr)"
              className="col-span-2 sm:col-span-3"
              hint="If known; NNN deals need it"
            >
              <Input
                value={lease.camEstimate}
                onChange={setLInput("camEstimate")}
                className="bg-white"
              />
            </Field>
            <Field
              label="Docks / drive-in doors"
              className="col-span-2 sm:col-span-3"
            >
              <Input
                placeholder="Industrial only"
                value={lease.docks}
                onChange={setLInput("docks")}
                className="bg-white"
              />
            </Field>
            <Field
              label="TI / free rent the owner will offer"
              className="col-span-2 sm:col-span-3"
            >
              <Input
                placeholder="e.g. $15/SF TI, 3 months free"
                value={lease.tiExpectation}
                onChange={setLInput("tiExpectation")}
                className="bg-white"
              />
            </Field>
            <Field label="Features" className="col-span-2 sm:col-span-6">
              <MultiCheck
                prefix="feat"
                options={COM_FEATURES}
                value={lease.features}
                onChange={setL("features")}
              />
            </Field>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>5 · Rent & lease terms</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label={com ? "Current / last rent" : "Current / last rent ($/mo)"}
            hint={com ? "$/SF/yr or $/mo, say which" : undefined}
          >
            <Input
              placeholder={com ? "e.g. $24/SF/yr NNN" : "$"}
              value={lease.currentRent}
              onChange={setLInput("currentRent")}
              className="bg-white"
            />
          </Field>
          <Field
            label={
              com
                ? "Owner's / client's rent expectation"
                : "Landlord's / client's rent expectation"
            }
          >
            <Input
              placeholder={com ? "e.g. $30/SF/yr" : "$ per month"}
              value={lease.askingRent}
              onChange={setLInput("askingRent")}
              className="bg-white"
            />
          </Field>
          <Field label="Available date">
            <Input
              type="date"
              value={lease.availableDate}
              onChange={setLInput("availableDate")}
              className="bg-white"
            />
          </Field>
          <Field label="Lease term">
            <Input
              placeholder={
                com ? "e.g. 5–10 yrs with options" : "e.g. 12 months"
              }
              value={lease.leaseTerm}
              onChange={setLInput("leaseTerm")}
              className="bg-white"
            />
          </Field>
          <Field label="Recent updates" className="sm:col-span-2">
            <Textarea
              placeholder={
                com
                  ? "e.g. new storefront glass 2024, HVAC replaced, ADA bathroom"
                  : "e.g. new kitchen 2023, refinished floors, new windows"
              }
              value={lease.recentUpdates}
              onChange={setLInput("recentUpdates")}
              className="bg-white"
            />
          </Field>
          <Field label="Known issues" className="sm:col-span-2">
            <Textarea
              value={form.knownIssues}
              onChange={setInput("knownIssues")}
              className="bg-white"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>6 · Documents (optional)</CardTitle>
          <CardDescription>
            Current lease, rent roll, floor plan, flyer, photos, or CoStar /
            Crexi lease comp exports. Up to 25 files, {MAX_FILE_MB} MB each.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            data-testid="lease-file-input"
            onChange={e => addFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInput.current?.click()}
          >
            <FileUp className="size-4" /> Add files
          </Button>
          {(kept.length > 0 || files.length > 0) && (
            <ul className="space-y-1.5">
              {kept.map(f => (
                <li
                  key={f.storageId}
                  className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm"
                >
                  <Paperclip className="size-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {fmtSize(f.size)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() =>
                      setKept(cur =>
                        cur.filter(c => c.storageId !== f.storageId),
                      )
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${f.size}`}
                  className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm"
                >
                  <Paperclip className="size-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {fmtSize(f.size)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() =>
                      setFiles(cur => cur.filter((_, j) => j !== i))
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>7 · Delivery</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Client's timeline">
            <Input
              placeholder="e.g. rent by Dec 1, renewal due in March"
              value={form.timeline}
              onChange={setInput("timeline")}
              className="bg-white"
            />
          </Field>
          <Field label="Needed by" hint="Date of your appointment, if any">
            <Input
              type="date"
              value={form.neededBy}
              onChange={setInput("neededBy")}
              className="bg-white"
            />
          </Field>
          <Field label="Branding on the report">
            <Choice
              value={form.branding}
              onChange={set("branding")}
              options={BRANDING}
            />
          </Field>
          {kind !== "commercial" && (
            <Field label="Schools for this address" hint={SCHOOLS_HINT}>
              <Choice
                id="lease-schools"
                value={form.schools}
                onChange={set("schools")}
                options={SCHOOL_OPTIONS}
                placeholder="Not set (filed before this option)"
              />
            </Field>
          )}
          <Field
            label="Comp preferences"
            hint="Radius, buildings to include or avoid, MLS #s"
          >
            <Input
              value={form.compNotes}
              onChange={setInput("compNotes")}
              className="bg-white"
            />
          </Field>
          <Field
            label="Anything else Viktor should know"
            className="sm:col-span-2"
          >
            <Textarea
              value={form.notes}
              onChange={setInput("notes")}
              className="bg-white"
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="submit"
          size="lg"
          disabled={submitting}
          data-testid="submit-lease"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {editId ? "Save changes" : "Submit lease CMA request"}
        </Button>
      </div>
      {uploadMsg && (
        <p className="text-right text-sm text-muted-foreground">{uploadMsg}</p>
      )}
    </form>
  );
}
