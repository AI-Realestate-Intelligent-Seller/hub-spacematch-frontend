import { useMutation, useQuery } from "convex/react";
import {
  DollarSign,
  Download,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { formatAddress } from "../../convex/address";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const STATUS: Record<string, { label: string; cls: string }> = {
  submitted: { label: "Queued", cls: "bg-stone-200 text-stone-800" },
  building: { label: "Building", cls: "bg-amber-100 text-amber-900" },
  needs_info: { label: "Needs info", cls: "bg-orange-100 text-orange-900" },
  approval: { label: "Waiting for Michael", cls: "bg-violet-100 text-violet-900" },
  ready: { label: "Ready", cls: "bg-emerald-100 text-emerald-900" },
  revision: { label: "Updating", cls: "bg-sky-100 text-sky-900" },
  failed: { label: "Problem", cls: "bg-red-100 text-red-900" },
};

const money = (n?: number, lease?: "residential" | "commercial") =>
  n === undefined
    ? ""
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: lease === "commercial" ? 2 : 0,
      }) +
      (lease === "commercial"
        ? "/SF/yr"
        : lease === "residential"
          ? "/mo"
          : "");

type PriceTarget = {
  id: Id<"cmaRequests">;
  // Lease CMAs price rent: residential $/mo, commercial $/SF/yr.
  lease?: "residential" | "commercial";
  address: string;
  listPrice?: number;
  recommended?: number;
  low?: number;
  high?: number;
};

const parseMoney = (s: string) => {
  const t = s
    .trim()
    .toLowerCase()
    .replace(/[$,\s]/g, "");
  const m = t.match(/^(\d+(?:\.\d+)?)([km]?)$/);
  if (!m) return Number.NaN;
  const mult = m[2] === "m" ? 1_000_000 : m[2] === "k" ? 1_000 : 1;
  return Math.round(Number(m[1]) * mult * 100) / 100;
};

function ListPriceDialog({
  target,
  onClose,
}: {
  target: PriceTarget | null;
  onClose: () => void;
}) {
  const setListPrice = useMutation(api.cma.setListPrice);
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const L = target?.lease;
  const n = L ? parseMoney(price) : Math.round(parseMoney(price));
  const valid = Number.isFinite(n) && n >= (L ? 1 : 10000);
  const word = L ? "asking rent" : "list price";
  const outside =
    valid &&
    target?.low !== undefined &&
    target?.high !== undefined &&
    (n < target.low || n > target.high);

  const save = async () => {
    if (!target || !valid) return;
    setSaving(true);
    try {
      await setListPrice({
        id: target.id,
        listPrice: n,
        note: note || undefined,
      });
      toast.success(
        `${L ? "Asking rent" : "List price"} saved. Viktor is updating the PDF and workbook.`,
      );
      setPrice("");
      setNote("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={o => !o && onClose()}>
      <DialogContent data-testid="list-price-dialog">
        <DialogHeader>
          <DialogTitle>Change the {word}</DialogTitle>
          <DialogDescription>
            {target?.address}. Viktor rebuilds the PDF and comps workbook at
            your {word}. The {L ? "rent" : "value"} range stays as built.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-muted px-3 py-2">
              <div className="text-xs text-muted-foreground">
                {L ? "Rent range" : "Value range"}
              </div>
              <div className="font-medium">
                {money(target?.low, L)}–{money(target?.high, L)}
              </div>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2">
              <div className="text-xs text-muted-foreground">
                Viktor's suggested {L ? "rent" : "list"}
              </div>
              <div className="font-medium">
                {money(target?.recommended ?? target?.listPrice, L)}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-list-price">
              New {word}
              {L === "commercial" ? " ($/SF/yr)" : L ? " ($/mo)" : ""}
            </Label>
            <Input
              id="new-list-price"
              data-testid="new-list-price"
              inputMode="numeric"
              placeholder={
                L === "commercial"
                  ? "e.g. 28.50"
                  : L
                    ? "e.g. 2,450"
                    : "e.g. 499,900"
              }
              value={price}
              onChange={e => setPrice(e.target.value)}
              className="bg-white"
              autoFocus
            />
            {valid && (
              <p className="text-xs text-muted-foreground">
                {money(n, L)}
                {outside && (
                  <span className="text-amber-700">
                    {" "}
                    · outside the value range. That's fine if it's your call,
                    but the report will show it.
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="list-price-note">Why (optional)</Label>
            <Textarea
              id="list-price-note"
              placeholder="e.g. seller wants to test the market at 499; new roof not in comps"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="bg-white"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={!valid || saving}
            data-testid="save-list-price"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Update CMA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const lz = (r: { reportType?: string; kind?: string }) =>
  r.reportType === "lease"
    ? r.kind === "commercial"
      ? ("commercial" as const)
      : ("residential" as const)
    : undefined;

export function RequestsPage() {
  const rows = useQuery(api.cma.list);
  const me = useQuery(api.cma.me);
  const [priceTarget, setPriceTarget] = useState<PriceTarget | null>(null);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {me?.isAdmin ? "All agents" : "Your requests"}
          </p>
          <h1 className="text-3xl font-bold">CMA requests</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/lease">
              <Plus className="size-4" /> Lease CMA
            </Link>
          </Button>
          <Button asChild>
            <Link to="/new">
              <Plus className="size-4" /> New request
            </Link>
          </Button>
        </div>
      </div>

      {rows === undefined ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No requests yet.{" "}
            <Link to="/new" className="text-primary underline">
              Request your first CMA
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map(r => {
            const s = STATUS[r.status] ?? STATUS.submitted;
            return (
              <Card key={r._id} data-testid="request-row">
                <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">
                        {formatAddress(r)}
                      </span>
                      <Badge className={`${s.cls} border-0`}>{s.label}</Badge>
                      {r.kind === "commercial" && (
                        <Badge variant="outline">Commercial</Badge>
                      )}
                      {r.reportType === "lease" && (
                        <Badge variant="outline" data-testid="lease-badge">
                          Lease
                        </Badge>
                      )}
                      {r.investor && Object.keys(r.investor).length > 0 && (
                        <Badge variant="outline" data-testid="investor-badge">
                          Investor
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {r.clientName} · {r.agentName} · submitted{" "}
                      {new Date(r._creationTime).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    {r.listPrice !== undefined && (
                      <p className="text-sm" data-testid="price-line">
                        {lz(r) ? "Rent" : "Value"} {money(r.valueLow, lz(r))}–
                        {money(r.valueHigh, lz(r))} ·{" "}
                        {lz(r) ? "ask" : "list at"}{" "}
                        <strong>{money(r.listPrice, lz(r))}</strong>
                        {r.agentListPrice !== undefined &&
                          r.recommendedListPrice !== undefined &&
                          r.recommendedListPrice !== r.agentListPrice && (
                            <span className="text-muted-foreground">
                              {" "}
                              (agent's price; Viktor suggested{" "}
                              {money(r.recommendedListPrice, lz(r))})
                            </span>
                          )}
                      </p>
                    )}
                    {r.attachments.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {r.attachments.length} document
                        {r.attachments.length === 1 ? "" : "s"} attached:{" "}
                        {r.attachments.map((a, i) => (
                          <span key={a.storageId}>
                            {i > 0 && ", "}
                            {a.url ? (
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className="underline"
                              >
                                {a.name}
                              </a>
                            ) : (
                              a.name
                            )}
                          </span>
                        ))}
                      </p>
                    )}
                    {r.statusNote && (
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {r.statusNote}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap sm:justify-end sm:max-w-[16rem]">
                    {r.pdfUrl && (
                      <Button size="sm" asChild>
                        <a href={r.pdfUrl} target="_blank" rel="noreferrer">
                          <Download className="size-4" /> CMA PDF
                        </a>
                      </Button>
                    )}
                    {r.workbookUrl && (
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={r.workbookUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileSpreadsheet className="size-4" /> Comps
                        </a>
                      </Button>
                    )}
                    {(r.status === "ready" || r.status === "revision") &&
                      r.listPrice !== undefined && (
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid="edit-list-price"
                          onClick={() =>
                            setPriceTarget({
                              id: r._id,
                              lease: lz(r),
                              address: formatAddress(r),
                              listPrice: r.listPrice,
                              recommended: r.recommendedListPrice,
                              low: r.valueLow,
                              high: r.valueHigh,
                            })
                          }
                        >
                          <DollarSign className="size-4" />{" "}
                          {lz(r) ? "Asking rent" : "List price"}
                        </Button>
                      )}
                    <Button
                      size="sm"
                      variant="ghost"
                      asChild
                      data-testid="edit-details"
                    >
                      <Link
                        to={
                          r.reportType === "lease"
                            ? `/lease/${r._id}/edit`
                            : `/requests/${r._id}/edit`
                        }
                      >
                        <Pencil className="size-4" /> Edit details
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <ListPriceDialog
        target={priceTarget}
        onClose={() => setPriceTarget(null)}
      />
    </div>
  );
}
