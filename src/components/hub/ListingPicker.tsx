// "Pick a listing": fills a tool's form from a Hub listing so agents never retype
// the address (CMA, Reel Studio, Seller lists). Michael 2026-11-02 "go all".
import { Home } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { listingsApi, type PickedListing, useListingsData } from "@/lib/listingsApi";

export type { PickedListing };

export function ListingPicker({ onPick, label = "Use one of your listings", hint, className = "" }: {
  onPick: (l: PickedListing) => void;
  label?: string;
  hint?: string;
  className?: string;
}) {
  const rows = useListingsData("listings:pick", () => listingsApi.pick()).data?.items;
  const [params] = useSearchParams();
  const [value, setValue] = useState("");
  const fromUrl = useRef(false);

  // /new?listing=<id> (from the listing page's "Use this listing" buttons).
  useEffect(() => {
    const id = params.get("listing");
    if (!rows || fromUrl.current || !id) return;
    fromUrl.current = true;
    const l = rows.find(r => r._id === id);
    if (l) { setValue(l._id); onPick(l); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  if (!rows || rows.length === 0) return null;
  return (
    <div className={`rounded-2xl border border-[#D9BC8C]/60 bg-[#F7F5F1] p-3 ${className}`} data-testid="listing-picker">
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-stone-700 sm:flex-row sm:items-center sm:gap-3">
        <span className="inline-flex shrink-0 items-center gap-1.5"><Home className="size-4 text-[#9C7434]" />{label}</span>
        <select
          aria-label={label}
          value={value}
          onChange={e => {
            setValue(e.target.value);
            const l = rows.find(r => r._id === e.target.value);
            if (l) onPick(l);
          }}
          className="w-full min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[15px] font-normal text-[#0A0A0A]"
        >
          <option value="">Pick a listing to fill this in…</option>
          {rows.map(r => (
            <option key={r._id} value={r._id}>
              {r.address} · {r.status}{r.price ? ` · ${r.price}` : ""}{rows.some(x => x.agentEmail !== r.agentEmail) ? ` · ${r.agentName}` : ""}
            </option>
          ))}
        </select>
      </label>
      {hint && <p className="mt-1.5 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
