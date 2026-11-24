import { useCurrentUser } from "@/auth/session";
import { Check, Copy, Download, ExternalLink, Mail, MessageSquare, QrCode, Send } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AGENTS, agentByEmail, agentSlug } from "@/lib/agents";
import { FORMS, type FormDef, GROUPS } from "../../convex/formDefs";

function ShareDialog({ form, onClose }: { form: FormDef; onClose: () => void }) {
  const user = useCurrentUser(); // new backend session
  const me = agentByEmail(user?.email);
  const [agentName, setAgentName] = useState<string>("");
  const [prop, setProp] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (me && !agentName) setAgentName(me.name); }, [me, agentName]);

  const url = useMemo(() => {
    const u = new URL(`/f/${form.id}`, window.location.origin);
    if (form.audience === "client" && agentName) u.searchParams.set("a", agentSlug(agentName));
    if (prop.trim()) u.searchParams.set("p", prop.trim());
    return u.toString();
  }, [form, agentName, prop]);

  useEffect(() => {
    QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: "#0A0A0A", light: "#FFFFFF" } }).then(setQr);
  }, [url]);

  const msg = `Hi! Here's a quick form from SpaceMatch — ${form.title}: ${url}`;
  const copy = async () => { await navigator.clipboard.writeText(url); setCopied(true); toast.success("Link copied"); setTimeout(() => setCopied(false), 1500); };
  const isClient = form.audience === "client";

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-['Playfair_Display'] text-xl">{form.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-stone-500 -mt-2">{form.blurb}</p>
        {isClient && (
          <div className="grid gap-3">
            <label className="text-sm font-medium">
              Answers go to
              <select value={agentName} onChange={e => setAgentName(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5">
                <option value="">The team inbox (no agent)</option>
                {AGENTS.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
              </select>
            </label>
            {(form.id === "open-house-signin" || form.id === "coop-feedback") && (
              <label className="text-sm font-medium">
                Property (prefilled on the form)
                <input value={prop} onChange={e => setProp(e.target.value)} placeholder="e.g. 1824 W Wolfram St" className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5" />
              </label>
            )}
          </div>
        )}
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
        <p className="text-xs text-stone-500">
          {isClient
            ? "When your client submits, it lands in your Hub inbox and you get an email (team@ gets a copy)."
            : "Goes to the team inbox — Michael, Cris and Atom get an email."}
        </p>
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
        <p className="text-stone-500 mt-1">25 forms, one for each step. Tap a form to text, email or QR your personal link — answers come back to your inbox.</p>
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
      {open && <ShareDialog form={open} onClose={() => setParams({})} />}
    </div>
  );
}
