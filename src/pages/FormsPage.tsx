import { useCurrentUser } from "@/auth/session";
import { Check, Copy, Download, ExternalLink, Mail, MessageSquare, QrCode, Send } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiErrorMessage, useApiData } from "@/lib/apiData";
import { formsApi } from "@/lib/formsApi";
import { listingsApi } from "@/lib/listingsApi";
import { FORMS, type FormDef, GROUPS } from "../../convex/formDefs";

function ShareDialog({ form, initialListing, onClose }: { form: FormDef; initialListing?: string; onClose: () => void }) {
  const user = useCurrentUser();
  const isClient = form.audience === "client";
  const isOpenHouse = form.id === "open-house-signin";
  const canLinkListing = isOpenHouse || form.id === "seller-intake" || form.id === "coop-feedback";
  const { data: listings, error: listingError } = useApiData(canLinkListing ? "forms:listings" : null, listingsApi.pick);
  const { data: agents } = useApiData(isClient ? "forms:agents" : null, formsApi.agents);
  const [agentId, setAgentId] = useState(user?._id ?? "");
  const [listingId, setListingId] = useState(initialListing ?? "");
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!url) return;
    let active = true;
    void QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: "#0A0A0A", light: "#FFFFFF" } })
      .then(image => { if (active) setQr(image); })
      .catch(() => { if (active) toast.error("Could not create the QR code."); });
    return () => { active = false; };
  }, [url]);

  function resetLink() {
    setUrl("");
    setQr("");
  }

  const createLink = async () => {
    setBusy(true);
    try {
      const { link } = await formsApi.share(form.id, { listingId: listingId || undefined, agentId: agentId || undefined });
      const next = new URL(`/f/${form.id}`, window.location.origin);
      next.searchParams.set("link", link);
      setUrl(next.toString());
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const msg = `Hi! Here's a quick form from SpaceMatch — ${form.title}: ${url}`;
  const copy = async () => { await navigator.clipboard.writeText(url); setCopied(true); toast.success("Link copied"); setTimeout(() => setCopied(false), 1500); };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-['Playfair_Display'] text-xl">{form.title}</DialogTitle>
          <DialogDescription>{form.blurb}</DialogDescription>
        </DialogHeader>
        {canLinkListing && (
          <label className="text-sm font-medium">
            Listing {isOpenHouse ? "(required)" : "(optional)"}
            <select value={listingId} disabled={busy || !listings} onChange={e => { setListingId(e.target.value); resetLink(); }} className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5">
              <option value="">{listings ? "Choose a listing" : "Loading listings…"}</option>
              {listings?.items.map(l => <option key={l._id} value={l._id}>{l.address}</option>)}
            </select>
            {listingError && <span role="alert" className="text-red-800">{apiErrorMessage(listingError)}</span>}
          </label>
        )}
        {isClient && !listingId && !isOpenHouse && (
          <label className="text-sm font-medium">
            Answers go to
            <select value={agentId} disabled={busy} onChange={e => { setAgentId(e.target.value); resetLink(); }} className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5">
              <option value="">Team inbox</option>
              {agents?.items.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        )}
        {listingId && <p className="text-sm text-stone-600">Responses go to the listing agent. {isOpenHouse && "Each submitted sign-in updates the seller portal count."}</p>}
        {!url && <button type="button" disabled={busy || (isOpenHouse && !listings?.items.some(l => l._id === listingId))} onClick={() => void createLink()} className="rounded-xl bg-[#0A0A0A] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Creating link…" : "Create share link"}</button>}
        {url && <>
        <div className="flex items-center gap-2 rounded-xl bg-[#F7F5F1] p-2 pl-3">
          <span className="truncate text-sm flex-1">{url}</span>
          <button type="button" onClick={copy} className="rounded-lg bg-[#0A0A0A] px-3 py-2 text-xs font-semibold text-white">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {isClient ? (
            <>
              <a href={`sms:?&body=${encodeURIComponent(msg)}`} className="flex flex-col items-center gap-1 rounded-xl bg-white p-3 ring-1 ring-stone-200 text-sm font-medium"><MessageSquare className="size-5 text-[#9C7434]" />Text</a>
              <a href={`mailto:?subject=${encodeURIComponent(`SpaceMatch — ${form.title}`)}&body=${encodeURIComponent(msg)}`} className="flex flex-col items-center gap-1 rounded-xl bg-white p-3 ring-1 ring-stone-200 text-sm font-medium"><Mail className="size-5 text-[#9C7434]" />Email</a>
            </>
          ) : (
            <a href={url} className="col-span-2 flex flex-col items-center gap-1 rounded-xl bg-[#9C7434] p-3 text-sm font-semibold text-white"><Send className="size-5" />Fill it out now</a>
          )}
          <a href={url} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 rounded-xl bg-white p-3 ring-1 ring-stone-200 text-sm font-medium"><ExternalLink className="size-5 text-[#9C7434]" />Preview</a>
        </div>
        {qr && (
          <div className="flex items-center gap-4 rounded-xl bg-white p-3 ring-1 ring-stone-200">
            <img src={qr} alt="QR code" className="size-28" />
            <div className="text-sm">
              <div className="font-semibold flex items-center gap-1"><QrCode className="size-4" /> QR code</div>
              <div className="text-stone-500 text-xs mt-1">Print it for open houses or show it on your phone.</div>
              <a href={qr} download={`${form.id}-qr.png`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#9C7434]"><Download className="size-3.5" />Download</a>
            </div>
          </div>
        )}
        </>}
        <p className="text-xs text-stone-500">Responses appear in the Hub inbox.</p>
      </DialogContent>
    </Dialog>
  );
}

export function FormsPage() {
  const [params, setParams] = useSearchParams();
  const [group, setGroup] = useState<string>("All");
  const openId = params.get("open");
  const open = openId ? FORMS.find(f => f.id === openId) : undefined;
  const shown = GROUPS.filter(g => group === "All" || g.id === group);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-['Playfair_Display'] text-3xl font-bold text-[#0A0A0A]">Forms</h1>
        <p className="text-stone-500 mt-1">Share forms by text, email or QR code. Responses come back to your Hub inbox.</p>
      </div>
      <div className="-mx-4 px-4 flex gap-2 overflow-x-auto pb-1">
        {["All", ...GROUPS.map(g => g.id)].map(g => (
          <button key={g} type="button" onClick={() => setGroup(g)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm ring-1 ${group === g ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white text-stone-600 ring-stone-200"}`}>
            {g === "All" ? "All" : GROUPS.find(x => x.id === g)?.label}
          </button>
        ))}
      </div>
      {shown.map(g => (
        <section key={g.id}>
          <div className="flex items-baseline gap-3 mb-2">
            <h2 className="font-['Playfair_Display'] text-xl font-semibold">{g.label}</h2>
            <span className="text-xs text-stone-500">{g.blurb}</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FORMS.filter(f => f.group === g.id).map((f, i) => (
              <button key={f.id} type="button" onClick={() => setParams({ open: f.id })} className="group text-left rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da] hover:ring-[#9C7434] hover:shadow-md transition-all">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-[#F7F5F1] text-[11px] font-bold text-[#9C7434]">{i + 1}</span>
                  <span className="font-semibold">{f.title}</span>
                  {f.lead && <span className="ml-auto rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">LEAD</span>}
                </div>
                <p className="mt-1.5 text-[13px] text-stone-500 leading-snug">{f.blurb}</p>
                <div className="mt-3 text-xs font-semibold text-[#9C7434]">{f.audience === "client" ? "Send to client →" : "Fill out →"}</div>
              </button>
            ))}
          </div>
        </section>
      ))}
      {open && <ShareDialog key={open.id} form={open} initialListing={params.get("listing") ?? undefined} onClose={() => setParams({})} />}
    </div>
  );
}
