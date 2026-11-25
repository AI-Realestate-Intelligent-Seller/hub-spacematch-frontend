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
import { Link, Navigate, useNavigate, useParams } from "react-router";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  cleanInvestor,
  InvestorCmaSection,
  type InvestorState,
  investorDefaults,
} from "@/components/hub/InvestorCmaSection";
import { AGENTS } from "@/lib/agents";
import { ListingPicker, type PickedListing } from "@/components/hub/ListingPicker";
import { VoiceFill, type VoiceResult } from "@/components/hub/VoiceFill";

const UPGRADE_ITEMS = [
  "Kitchen remodel",
  "Bathroom remodel",
  "Flooring (hardwood / LVP)",
  "Interior paint",
  "Roof",
  "Windows",
  "HVAC / furnace / AC",
  "Water heater",
  "Electrical panel / wiring",
  "Plumbing",
  "Basement finished",
  "Addition (bedroom / bath / sq ft)",
  "Siding / exterior",
  "Garage / driveway",
  "Deck / patio / landscaping",
  "Appliances",
  "Laundry",
  "Solar",
  "Pool",
];

const PROPERTY_TYPES = [
  "Single-family",
  "Townhome",
  "Condo",
  "2–4 unit",
  "Other",
];
const CONDITIONS = [
  "Needs work",
  "Original / dated",
  "Average / well maintained",
  "Partially updated",
  "Fully renovated",
];
const BASEMENTS = [
  "None / slab",
  "Unfinished",
  "Partially finished",
  "Finished",
  "Finished walkout",
];
const PURPOSES = [
  "Listing appointment",
  "Pricing check for a seller",
  "Buyer offer support",
  "Past-client home value update",
];
const COMMERCIAL_TYPES = [
  "Multi-family 5+ units",
  "Mixed use (retail + apartments)",
  "Retail / storefront",
  "Office",
  "Industrial / warehouse",
  "Business with real estate",
  "Land / development",
  "Other commercial",
];
const SALE_TYPES = [
  "Investment (tenants stay)",
  "Owner-user",
  "Vacant / value-add",
  "Redevelopment / land value",
];
const EXPENSE_STRUCTURES = [
  "Gross / landlord pays most",
  "Modified gross",
  "NNN (tenants pay taxes, insurance, CAM)",
  "Mixed / varies by tenant",
];
const COMMERCIAL_PURPOSES = [
  "Listing appointment / BOV",
  "Pricing check for an owner",
  "Buyer offer support",
  "Refinance / portfolio review",
];
const COMMERCIAL_CONDITIONS = [
  "Needs major work",
  "Dated but functional",
  "Average / well maintained",
  "Recently renovated",
  "New construction",
];

const emptyCommercial = {
  buildingSf: "",
  landSf: "",
  units: "",
  unitMix: "",
  stories: "",
  zoning: "",
  parking: "",
  pins: "",
  occupancy: "",
  saleType: "",
  grossIncome: "",
  operatingExpenses: "",
  noi: "",
  propertyTaxes: "",
  expenseStructure: "",
  tenants: "",
  capex: "",
  dataSources: "",
};
type CommercialState = typeof emptyCommercial;
type Kind = "residential" | "commercial";

const MAX_FILE_MB = MAX_UPLOAD_MB; // Supabase free plan: 50 MB per file
const fmtSize = (n: number) =>
  n > 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1024))} KB`;

const BRANDING = [
  "SpaceMatch · a team of Real Broker",
  "SpaceMatch only (no brokerage)",
];

type UpgradeState = { checked: boolean; year: string; notes: string };

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
  propertyType: "Single-family",
  beds: "",
  bathsFull: "",
  bathsHalf: "",
  sqft: "",
  yearBuilt: "",
  basement: "",
  garage: "",
  hoaDues: "",
  condition: "",
  otherUpgrades: "",
  knownIssues: "",
  sellerPriceExpectation: "",
  timeline: "",
  purpose: "Listing appointment",
  neededBy: "",
  branding: BRANDING[0],
  schools: SCHOOL_OPTIONS[0],
  compNotes: "",
  notes: "",
};

type FormState = typeof emptyForm;

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Choice({
  value,
  onChange,
  options,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  id?: string;
}) {
  return (
    // Radix fires onValueChange("") when the value is set programmatically
    // inside a <form> (hidden native select); ignore it so prefills stick.
    <Select value={value} onValueChange={v => v && onChange(v)}>
      <SelectTrigger className="w-full bg-white" id={id} data-testid={id}>
        <SelectValue placeholder={placeholder ?? "Select"} />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type SavedAttachment = {
  storageId: string;
  name: string;
  size: number;
  contentType?: string;
};

// "Talk it in" field labels shown as chips after a voice fill.
const VOICE_LABELS: Partial<Record<keyof FormState, string>> = {
  clientName: "Client",
  clientEmail: "Client email",
  clientPhone: "Client phone",
  street: "Street",
  unit: "Unit",
  city: "City",
  state: "State",
  zip: "ZIP",
  propertyType: "Property type",
  beds: "Beds",
  bathsFull: "Full baths",
  bathsHalf: "Half baths",
  sqft: "Sq ft",
  yearBuilt: "Year built",
  basement: "Basement",
  garage: "Garage",
  hoaDues: "HOA",
  condition: "Condition",
  otherUpgrades: "Other upgrades",
  knownIssues: "Known issues",
  sellerPriceExpectation: "Seller's price",
  timeline: "Timeline",
  purpose: "Purpose",
  neededBy: "Needed by",
  compNotes: "Comp notes",
};
const VOICE_APPEND: (keyof FormState)[] = ["otherUpgrades", "knownIssues", "compNotes"];

export function NewRequestPage() {
  const { id: editParam } = useParams();
  const editId = editParam;
  const navigate = useNavigate();
  const existingRes = useApiData(editId ? `cma:${editId}` : null, () => cmaApi.get(editId!));
  // undefined = loading, null = not found
  const existing = existingRes.notFound ? null : existingRes.data;
  const me = useApiData("cma:me", () => cmaApi.me()).data;
  const [kept, setKept] = useState<SavedAttachment[]>([]);
  const prefilled = useRef(false);
  const [kind, setKind] = useState<Kind>("residential");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [com, setCom] = useState<CommercialState>(emptyCommercial);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [upgrades, setUpgrades] = useState<Record<string, UpgradeState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [investorOn, setInvestorOn] = useState(false);
  const [investor, setInvestor] = useState<InvestorState>({});

  const set = (k: keyof FormState) => (v: string) =>
    setForm(f => ({ ...f, [k]: v }));
  const setInput =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // Number / ZIP / phone fields only take the characters they allow.
      const value = (CMA_TYPING[k] ?? (v => v))(e.target.value);
      setForm(f => ({ ...f, [k]: value }));
    };

  // Edit mode: load the saved request into the form once.
  useEffect(() => {
    if (!existing || prefilled.current) return;
    prefilled.current = true;
    const r = existing;
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    setKind(r.kind === "commercial" ? "commercial" : "residential");
    setForm(
      Object.fromEntries(
        Object.keys(emptyForm).map(k => [
          k,
          str((r as unknown as Record<string, unknown>)[k]) ||
            (k === "state" || k === "branding" || k === "propertyType"
              ? emptyForm[k as keyof FormState]
              : ""),
        ]),
      ) as FormState,
    );
    setCom({ ...emptyCommercial, ...(r.commercial ?? {}) });
    if (r.investor && Object.keys(r.investor).length) {
      setInvestorOn(true);
      setInvestor({ ...r.investor });
    }
    setUpgrades(
      Object.fromEntries(
        (r.upgrades ?? []).map(u => [
          u.item,
          { checked: true, year: u.year ?? "", notes: u.notes ?? "" },
        ]),
      ),
    );
    setKept(
      (r.attachments ?? []).map(a => ({
        storageId: a.storageId,
        name: a.name,
        size: a.size,
        contentType: a.contentType,
      })),
    );
  }, [existing]);

  // Pre-select the signed-in agent.
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

  // "Use one of your listings" → address, seller and price filled in.
  const fromListing = (l: PickedListing) => {
    const agent = AGENTS.find(x => x.email.toLowerCase() === l.agentEmail.toLowerCase());
    setForm(f => ({
      ...f,
      ...(agent ? { agentName: agent.name, agentEmail: agent.email, agentPhone: agent.phone } : {}),
      clientName: l.sellerName || f.clientName,
      clientEmail: l.sellerEmail || f.clientEmail,
      clientPhone: l.sellerPhone || f.clientPhone,
      street: l.street || f.street,
      unit: l.unit,
      city: l.city || f.city,
      state: l.state || f.state,
      zip: l.zip || f.zip,
      sellerPriceExpectation: l.price || f.sellerPriceExpectation,
      compNotes: l.mlsNumber && !f.compNotes.includes(l.mlsNumber) ? `${f.compNotes ? `${f.compNotes}\n` : ""}Subject MLS #${l.mlsNumber}` : f.compNotes,
    }));
    const missing = [!l.city && "city", !l.zip && "ZIP"].filter(Boolean);
    toast.success(`Filled in from ${l.address}${missing.length ? `. Add the ${missing.join(" and ")}.` : ""}`);
  };

  // "Talk it in": merge what the agent said; only allowed values for dropdowns, notes appended.
  const voiceSnap = useRef<{
    form: FormState;
    upgrades: Record<string, UpgradeState>;
    com: CommercialState;
  } | null>(null);
  const voiceOptions = {
    propertyTypes: kind === "commercial" ? COMMERCIAL_TYPES : PROPERTY_TYPES,
    conditions: kind === "commercial" ? COMMERCIAL_CONDITIONS : CONDITIONS,
    basements: BASEMENTS,
    purposes: kind === "commercial" ? COMMERCIAL_PURPOSES : PURPOSES,
    upgradeItems: UPGRADE_ITEMS,
  };
  const applyVoice = (r: VoiceResult): string[] => {
    voiceSnap.current = { form, upgrades, com };
    const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const enums: Partial<Record<keyof FormState, string[]>> = {
      propertyType: voiceOptions.propertyTypes,
      condition: voiceOptions.conditions,
      basement: BASEMENTS,
      purpose: voiceOptions.purposes,
    };
    const labels: string[] = [];
    const next = { ...form };
    for (const k of Object.keys(VOICE_LABELS) as (keyof FormState)[]) {
      let v = s(r[k]);
      if (!v) continue;
      if (enums[k] && !enums[k]!.includes(v)) continue;
      if (k === "neededBy" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) continue;
      if (k === "state") {
        v = v.toUpperCase();
        if (!/^[A-Z]{2}$/.test(v) || v === next.state) continue;
      }
      if (VOICE_APPEND.includes(k) && next[k] && !next[k].includes(v)) {
        v = `${next[k]}\n${v}`;
      }
      if (next[k] === v) continue;
      next[k] = v;
      labels.push(VOICE_LABELS[k]!);
    }
    const extra = s(r.notes);
    if (extra && !next.notes.includes(extra)) {
      next.notes = next.notes ? `${next.notes}\n${extra}` : extra;
      labels.push("Notes");
    }
    setForm(next);
    const ups = Array.isArray(r.upgrades) ? (r.upgrades as Record<string, unknown>[]) : [];
    const goodUps = ups.filter(u => UPGRADE_ITEMS.includes(s(u.item)));
    if (goodUps.length) {
      setUpgrades(cur => {
        const out = { ...cur };
        for (const u of goodUps) {
          const item = s(u.item);
          const prev = out[item];
          out[item] = {
            checked: true,
            year: s(u.year) || prev?.year || "",
            notes: s(u.notes) || prev?.notes || "",
          };
        }
        return out;
      });
      labels.push(`${goodUps.length} upgrade${goodUps.length > 1 ? "s" : ""}`);
    }
    if (kind === "commercial" && r.commercial && typeof r.commercial === "object") {
      const c = r.commercial as Record<string, unknown>;
      const got = (Object.keys(emptyCommercial) as (keyof CommercialState)[]).filter(k => s(c[k]));
      if (got.length) {
        setCom(cur => ({ ...cur, ...Object.fromEntries(got.map(k => [k, s(c[k])])) }));
        labels.push(`${got.length} building fact${got.length > 1 ? "s" : ""}`);
      }
    }
    return labels;
  };
  const undoVoice = () => {
    const snap = voiceSnap.current;
    if (!snap) return;
    setForm(snap.form);
    setUpgrades(snap.upgrades);
    setCom(snap.com);
    voiceSnap.current = null;
    toast.info("Voice fill undone");
  };

  const setComInput =
    (k: keyof CommercialState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setCom(c => ({ ...c, [k]: e.target.value }));
  const setCom1 = (k: keyof CommercialState) => (v: string) =>
    setCom(c => ({ ...c, [k]: v }));

  const switchKind = (k: Kind) => {
    if (k === kind) return;
    setKind(k);
    setForm(f => ({
      ...f,
      propertyType: k === "commercial" ? COMMERCIAL_TYPES[0] : "Single-family",
      purpose: k === "commercial" ? COMMERCIAL_PURPOSES[0] : PURPOSES[0],
      condition: "",
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
    const out: {
      storageId: string;
      name: string;
      size: number;
      contentType?: string;
    }[] = [];
    for (const [i, f] of files.entries()) {
      setUploadMsg(`Uploading ${i + 1} of ${files.length}: ${f.name}`);
      out.push(await cmaApi.upload(f));
    }
    setUploadMsg("");
    return out;
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

  const toggleUpgrade = (item: string, checked: boolean) =>
    setUpgrades(u => ({
      ...u,
      [item]: {
        year: u[item]?.year ?? "",
        notes: u[item]?.notes ?? "",
        checked,
      },
    }));
  const editUpgrade = (item: string, k: "year" | "notes", v: string) =>
    setUpgrades(u => ({
      ...u,
      [item]: {
        checked: true,
        year: u[item]?.year ?? "",
        notes: u[item]?.notes ?? "",
        [k]: v,
      },
    }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!form.agentName) missing.push("agent");
    if (!form.clientName.trim()) missing.push("client name");
    if (!form.street.trim()) missing.push("street address");
    if (!form.city.trim()) missing.push("city");
    if (!form.zip.trim()) missing.push("ZIP");
    if (!form.condition) missing.push("overall condition");
    if (
      kind === "commercial" &&
      !files.length &&
      !kept.length &&
      !com.buildingSf.trim() &&
      !com.units.trim()
    ) {
      missing.push("building size or units (or upload the OM)");
    }
    if (missing.length) {
      toast.error(`Please fill in: ${missing.join(", ")}`);
      return;
    }
    const problems = cmaFieldProblems(form);
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
      const commercial =
        kind === "commercial"
          ? (Object.fromEntries(
              Object.entries(com)
                .map(([k, v]) => [k, v.trim()])
                .filter(([, v]) => v),
            ) as Partial<CommercialState>)
          : undefined;
      const payload = {
        kind,
        commercial,
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
        beds: opt(clean.beds),
        bathsFull: opt(clean.bathsFull),
        bathsHalf: opt(clean.bathsHalf),
        sqft: opt(clean.sqft),
        yearBuilt: opt(clean.yearBuilt),
        basement: opt(clean.basement),
        garage: opt(clean.garage),
        hoaDues: opt(clean.hoaDues),
        condition: clean.condition,
        upgrades: Object.entries(upgrades)
          .filter(([, u]) => u.checked)
          .map(([item, u]) => ({
            item,
            year: opt(u.year.trim()),
            notes: opt(u.notes.trim()),
          })),
        otherUpgrades: opt(clean.otherUpgrades),
        knownIssues: opt(clean.knownIssues),
        sellerPriceExpectation: opt(clean.sellerPriceExpectation),
        timeline: opt(clean.timeline),
        purpose: clean.purpose,
        neededBy: opt(clean.neededBy),
        branding: clean.branding,
        schools: kind === "commercial" ? undefined : opt(clean.schools),
        investor:
          kind === "residential" && investorOn
            ? cleanInvestor(investor)
            : undefined,
        compNotes: opt(clean.compNotes),
        notes: opt(clean.notes),
      };
      if (editId) {
        const res = await cmaApi.update(editId, payload);
        if (!res.changed.length) {
          toast.info("No changes to save");
          navigate("/requests");
          return;
        }
        toast.success(
          res.status === "submitted"
            ? "Saved. Viktor will use the updated details."
            : res.status === "building"
              ? "Saved. Viktor will add these changes as soon as the current build finishes."
              : "Saved. Viktor is rebuilding the CMA with your changes.",
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
            <h1 className="text-2xl font-bold">
              {kind === "commercial"
                ? "Commercial CMA request received"
                : "CMA request received"}
            </h1>
            {kind === "commercial" ? (
              <p className="text-muted-foreground">
                Viktor will read your documents, pull commercial sale comps for{" "}
                <strong className="text-foreground">{form.street}</strong> and
                build a broker opinion of value (income + sales approach) with a
                comps workbook. Commercial CMAs take longer than residential
                ones, usually a few hours. The PDF shows up under My requests.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Viktor will pull the MLS comps for{" "}
                <strong className="text-foreground">{form.street}</strong> and
                build the CMA on {form.agentName}'s Cloud CMA packet
                {investorOn
                  ? ", with the as-is value, after-repair value and rent for each unit you asked for"
                  : ""}
                . Requests
                are picked up every 15 minutes (7am–9pm); a typical CMA is ready
                within the hour. The PDF shows up under My requests.
              </p>
            )}
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
                  setUpgrades({});
                  setCom(emptyCommercial);
                  setInvestorOn(false);
                  setInvestor({});
                  setFiles([]);
                  setDone(null);
                }}
              >
                New request
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
  if (editId && existing?.reportType === "lease") {
    return <Navigate to={`/lease/${editId}/edit`} replace />;
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

  return (
    <form onSubmit={onSubmit} className="max-w-3xl mx-auto space-y-6 pb-16">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          SpaceMatch · CMA request
        </p>
        <h1 className="text-3xl md:text-4xl font-bold">
          {editId ? "Edit CMA request" : "Request a CMA"}
        </h1>
        {editId && (
          <p
            className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900"
            data-testid="edit-banner"
          >
            Fix or add anything you missed, then save. If the CMA is already
            built, Viktor rebuilds it with the new details. You'll see the
            status change under My requests.
          </p>
        )}
        <p className="text-muted-foreground">
          {kind === "commercial"
            ? "Give us the building and upload whatever you have: the offering memorandum, rent roll, T-12, leases, CoStar or Crexi comp exports. Viktor reads them, pulls commercial sale comps and active listings from MRED and Crexi, and builds a branded broker opinion of value with an income approach and a sales comparison."
            : "Give us the address and what's changed in the home. Viktor pulls the comps from MRED, adjusts for the upgrades, and builds a branded CMA on your Cloud CMA packet (your welcome letter, bio and contact card)."}{" "}
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
              "Residential",
              "House, townhome, condo, 2–4 unit",
              Home,
            ],
            [
              "commercial",
              "Commercial building",
              "5+ units, mixed use, retail, office, industrial",
              Building2,
            ],
          ] as const
        ).map(([k, title, sub, Icon]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            data-testid={`kind-${k}`}
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
        kind={kind}
        options={voiceOptions}
        onFill={applyVoice}
        onUndo={undoVoice}
      />

      <Card>
        <CardHeader>
          <CardTitle>1 · Agent</CardTitle>
          <CardDescription>
            Whose Cloud CMA profile goes on the presentation.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Agent *" className="sm:col-span-1">
            <Choice
              id="agent"
              value={form.agentName}
              onChange={pickAgent}
              options={AGENTS.map(a => a.name)}
              placeholder="Choose agent"
            />
          </Field>
          <Field label="Agent email">
            <Input
              value={form.agentEmail}
              onChange={setInput("agentEmail")}
              className="bg-white"
            />
          </Field>
          <Field label="Agent cell">
            <Input
              value={form.agentPhone}
              onChange={setInput("agentPhone")}
              className="bg-white"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2 · Client & property</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-6">
          {!editId && (
            <ListingPicker
              className="sm:col-span-6"
              onPick={fromListing}
              hint="Fills in the seller, address and list price from the listing. You can still change anything."
            />
          )}
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
          <Field label="Street address *" className="sm:col-span-4">
            <Input
              name="street"
              placeholder="524 Timber Trail Ct"
              value={form.street}
              onChange={setInput("street")}
              className="bg-white"
            />
          </Field>
          <Field label="Unit #" className="sm:col-span-2">
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
          <Field label="Property type" className="sm:col-span-3">
            <Choice
              key={`pt-${kind}`}
              id="propertyType"
              value={form.propertyType}
              onChange={set("propertyType")}
              options={
                kind === "commercial" ? COMMERCIAL_TYPES : PROPERTY_TYPES
              }
            />
          </Field>
          <Field label="Purpose" className="sm:col-span-3">
            <Choice
              key={`pu-${kind}`}
              value={form.purpose}
              onChange={set("purpose")}
              options={kind === "commercial" ? COMMERCIAL_PURPOSES : PURPOSES}
            />
          </Field>
        </CardContent>
      </Card>

      {kind === "residential" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>3 · Home facts</CardTitle>
              <CardDescription>
                Leave blank and we'll use MLS / county records. Fill in only
                what's different now (e.g. an added bedroom or bath).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 grid-cols-2 sm:grid-cols-6">
              <Field label="Beds">
                <Input
                  inputMode="numeric"
                  value={form.beds}
                  onChange={setInput("beds")}
                  className="bg-white"
                />
              </Field>
              <Field label="Full baths">
                <Input
                  inputMode="numeric"
                  value={form.bathsFull}
                  onChange={setInput("bathsFull")}
                  className="bg-white"
                />
              </Field>
              <Field label="Half baths">
                <Input
                  inputMode="numeric"
                  value={form.bathsHalf}
                  onChange={setInput("bathsHalf")}
                  className="bg-white"
                />
              </Field>
              <Field label="Sq ft">
                <Input
                  inputMode="numeric"
                  value={form.sqft}
                  onChange={setInput("sqft")}
                  className="bg-white"
                />
              </Field>
              <Field label="Year built">
                <Input
                  inputMode="numeric"
                  value={form.yearBuilt}
                  onChange={setInput("yearBuilt")}
                  className="bg-white"
                />
              </Field>
              <Field label="Garage">
                <Input
                  placeholder="2-car attached"
                  value={form.garage}
                  onChange={setInput("garage")}
                  className="bg-white"
                />
              </Field>
              <Field label="Basement" className="col-span-2 sm:col-span-2">
                <Choice
                  value={form.basement}
                  onChange={set("basement")}
                  options={BASEMENTS}
                />
              </Field>
              <Field
                label="HOA dues ($/mo)"
                className="col-span-2 sm:col-span-2"
              >
                <Input
                  value={form.hoaDues}
                  onChange={setInput("hoaDues")}
                  className="bg-white"
                />
              </Field>
              <Field
                label="Overall condition *"
                className="col-span-2 sm:col-span-2"
              >
                <Choice
                  id="condition"
                  value={form.condition}
                  onChange={set("condition")}
                  options={CONDITIONS}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4 · Upgrades & renovations</CardTitle>
              <CardDescription>
                Check everything that's been done since the owner bought it.
                Year and a few words (finishes, brands) make the adjustments
                more accurate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {UPGRADE_ITEMS.map(item => {
                const u = upgrades[item];
                const id = `up-${item.replace(/\W+/g, "-").toLowerCase()}`;
                return (
                  <div
                    key={item}
                    className={`rounded-md px-3 py-2 ${u?.checked ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={id}
                        checked={!!u?.checked}
                        onCheckedChange={c => toggleUpgrade(item, c === true)}
                      />
                      <label
                        htmlFor={id}
                        className="text-sm flex-1 cursor-pointer"
                      >
                        {item}
                      </label>
                    </div>
                    {u?.checked && (
                      <div className="grid grid-cols-4 gap-2 mt-2 pl-7">
                        <Input
                          placeholder="Year"
                          value={u.year}
                          onChange={e =>
                            editUpgrade(item, "year", e.target.value)
                          }
                          className="bg-white col-span-1"
                        />
                        <Input
                          placeholder="Details, e.g. quartz, Sub-Zero, shaker cabinets"
                          value={u.notes}
                          onChange={e =>
                            editUpgrade(item, "notes", e.target.value)
                          }
                          className="bg-white col-span-3"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="pt-4 grid gap-4">
                <Field label="Other upgrades or features">
                  <Textarea
                    placeholder="e.g. 3 washer/dryer sets in basement laundry, heated in-ground pool, paid-off solar"
                    value={form.otherUpgrades}
                    onChange={setInput("otherUpgrades")}
                    className="bg-white"
                  />
                </Field>
                <Field label="Known issues / what still needs work">
                  <Textarea
                    placeholder="e.g. basement unfinished, original windows, roof ~20 yrs"
                    value={form.knownIssues}
                    onChange={setInput("knownIssues")}
                    className="bg-white"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <InvestorCmaSection
            on={investorOn}
            onToggle={on => {
              setInvestorOn(on);
              if (on && !Object.keys(investor).length) {
                setInvestor(investorDefaults(form.propertyType));
              }
            }}
            value={investor}
            onChange={setInvestor}
          />
        </>
      )}

      {kind === "commercial" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>3 · Building facts</CardTitle>
              <CardDescription>
                Fill in what you know. Anything in the OM or rent roll you
                upload below can be left blank.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 grid-cols-2 sm:grid-cols-6">
              <Field label="Building sq ft" className="sm:col-span-2">
                <Input
                  name="buildingSf"
                  inputMode="numeric"
                  value={com.buildingSf}
                  onChange={setComInput("buildingSf")}
                  className="bg-white"
                />
              </Field>
              <Field label="Land / lot sq ft" className="sm:col-span-2">
                <Input
                  inputMode="numeric"
                  value={com.landSf}
                  onChange={setComInput("landSf")}
                  className="bg-white"
                />
              </Field>
              <Field label="Units / tenant spaces" className="sm:col-span-2">
                <Input
                  name="units"
                  inputMode="numeric"
                  value={com.units}
                  onChange={setComInput("units")}
                  className="bg-white"
                />
              </Field>
              <Field
                label="Unit mix"
                className="col-span-2 sm:col-span-4"
                hint="e.g. 2 retail + 6 two-bed apartments, or 12 studios / 8 one-beds"
              >
                <Input
                  value={com.unitMix}
                  onChange={setComInput("unitMix")}
                  className="bg-white"
                />
              </Field>
              <Field label="Stories" className="sm:col-span-1">
                <Input
                  inputMode="numeric"
                  value={com.stories}
                  onChange={setComInput("stories")}
                  className="bg-white"
                />
              </Field>
              <Field label="Year built" className="sm:col-span-1">
                <Input
                  inputMode="numeric"
                  value={form.yearBuilt}
                  onChange={setInput("yearBuilt")}
                  className="bg-white"
                />
              </Field>
              <Field label="Zoning" className="sm:col-span-2">
                <Input
                  placeholder="e.g. B3-2"
                  value={com.zoning}
                  onChange={setComInput("zoning")}
                  className="bg-white"
                />
              </Field>
              <Field label="Parking" className="sm:col-span-2">
                <Input
                  placeholder="e.g. 10 surface spaces"
                  value={com.parking}
                  onChange={setComInput("parking")}
                  className="bg-white"
                />
              </Field>
              <Field label="PIN(s)" className="col-span-2 sm:col-span-2">
                <Input
                  placeholder="Tax parcel #s, if known"
                  value={com.pins}
                  onChange={setComInput("pins")}
                  className="bg-white"
                />
              </Field>
              <Field
                label="Overall condition *"
                className="col-span-2 sm:col-span-3"
              >
                <Choice
                  id="condition"
                  value={form.condition}
                  onChange={set("condition")}
                  options={COMMERCIAL_CONDITIONS}
                />
              </Field>
              <Field label="Sale type" className="col-span-2 sm:col-span-3">
                <Choice
                  value={com.saleType}
                  onChange={setCom1("saleType")}
                  options={SALE_TYPES}
                />
              </Field>
              <Field
                label="Recent capital improvements"
                className="col-span-2 sm:col-span-6"
                hint="Roof, HVAC, tuckpointing, unit rehabs, storefronts, with years"
              >
                <Textarea
                  value={com.capex}
                  onChange={setComInput("capex")}
                  className="bg-white"
                />
              </Field>
              <Field
                label="Known issues / deferred maintenance"
                className="col-span-2 sm:col-span-6"
              >
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
              <CardTitle>4 · Income & tenants</CardTitle>
              <CardDescription>
                Annual numbers. Leave blank if they're in the rent roll / T-12
                you upload. Without income, the value leans on $/sq ft and
                $/unit comps.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-6">
              <Field label="Occupancy %" className="sm:col-span-2">
                <Input
                  placeholder="e.g. 92%"
                  value={com.occupancy}
                  onChange={setComInput("occupancy")}
                  className="bg-white"
                />
              </Field>
              <Field label="Gross annual income" className="sm:col-span-2">
                <Input
                  placeholder="$"
                  value={com.grossIncome}
                  onChange={setComInput("grossIncome")}
                  className="bg-white"
                />
              </Field>
              <Field
                label="Annual operating expenses"
                className="sm:col-span-2"
              >
                <Input
                  placeholder="$"
                  value={com.operatingExpenses}
                  onChange={setComInput("operatingExpenses")}
                  className="bg-white"
                />
              </Field>
              <Field
                label="NOI (net operating income)"
                className="sm:col-span-2"
              >
                <Input
                  name="noi"
                  placeholder="$"
                  value={com.noi}
                  onChange={setComInput("noi")}
                  className="bg-white"
                />
              </Field>
              <Field label="Annual property taxes" className="sm:col-span-2">
                <Input
                  placeholder="$"
                  value={com.propertyTaxes}
                  onChange={setComInput("propertyTaxes")}
                  className="bg-white"
                />
              </Field>
              <Field label="Lease structure" className="sm:col-span-2">
                <Choice
                  value={com.expenseStructure}
                  onChange={setCom1("expenseStructure")}
                  options={EXPENSE_STRUCTURES}
                />
              </Field>
              <Field
                label="Tenants & leases"
                className="sm:col-span-6"
                hint="Major tenants, rents, lease end dates, options, below-market leases"
              >
                <Textarea
                  value={com.tenants}
                  onChange={setComInput("tenants")}
                  className="bg-white"
                />
              </Field>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>5 · Documents & data</CardTitle>
          <CardDescription>
            {kind === "commercial"
              ? "Upload the offering memorandum and anything else you have: rent roll, T-12 / operating statement, leases, tax bills, appraisal, CoStar or Crexi comp exports, photos. PDF, Excel, Word, images."
              : "Optional: prior appraisal, inspection report, survey, floor plan, photos, or comps you want considered."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            data-testid="file-input"
            accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.txt,.jpg,.jpeg,.png,.heic,.zip"
            onChange={e => addFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            className="w-full rounded-xl border-2 border-dashed border-border bg-white hover:border-primary/50 py-8 flex flex-col items-center gap-2 text-sm text-muted-foreground"
          >
            <FileUp className="size-6 text-primary" />
            <span>
              <strong className="text-foreground">Choose files</strong> or drag
              them here
            </span>
            <span className="text-xs">
              Up to 25 files, {MAX_FILE_MB} MB each
            </span>
          </button>
          {kept.length > 0 && (
            <ul
              className="divide-y rounded-lg border bg-white"
              data-testid="kept-list"
            >
              {kept.map(a => (
                <li
                  key={a.storageId}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <Paperclip className="size-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{a.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {fmtSize(a.size)} · already uploaded
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${a.name}`}
                    onClick={() =>
                      setKept(cur =>
                        cur.filter(c => c.storageId !== a.storageId),
                      )
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {files.length > 0 && (
            <ul
              className="divide-y rounded-lg border bg-white"
              data-testid="file-list"
            >
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${f.size}`}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
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
          {kind === "commercial" && (
            <Field
              label="Other data sources"
              hint="e.g. CoStar comp IDs, links to the listing or OM (MRED and Crexi comps are pulled automatically)"
            >
              <Input
                value={com.dataSources}
                onChange={setComInput("dataSources")}
                className="bg-white"
              />
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>6 · Pricing & delivery</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label={
              kind === "commercial"
                ? "Owner's price expectation"
                : "Seller's price expectation"
            }
          >
            <Input
              placeholder="$"
              value={form.sellerPriceExpectation}
              onChange={setInput("sellerPriceExpectation")}
              className="bg-white"
            />
          </Field>
          <Field
            label={
              kind === "commercial" ? "Owner's timeline" : "Seller's timeline"
            }
          >
            <Input
              placeholder="e.g. list in spring, ASAP"
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
          <Field label="Branding on the CMA">
            <Choice
              value={form.branding}
              onChange={set("branding")}
              options={BRANDING}
            />
          </Field>
          {kind !== "commercial" && (
            <Field label="Schools for this address" hint={SCHOOLS_HINT}>
              <Choice
                id="cma-schools"
                value={form.schools}
                onChange={set("schools")}
                options={SCHOOL_OPTIONS}
                placeholder="Not set (filed before this option)"
              />
            </Field>
          )}
          <Field
            label="Comp preferences"
            className="sm:col-span-2"
            hint="Optional: radius, subdivisions to use or avoid, specific MLS #s"
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
          data-testid="submit-cma"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {editId
            ? "Save changes"
            : kind === "commercial"
              ? "Submit commercial CMA request"
              : "Submit CMA request"}
        </Button>
      </div>
      {uploadMsg && (
        <p
          className="text-right text-sm text-muted-foreground"
          data-testid="upload-msg"
        >
          {uploadMsg}
        </p>
      )}
    </form>
  );
}
