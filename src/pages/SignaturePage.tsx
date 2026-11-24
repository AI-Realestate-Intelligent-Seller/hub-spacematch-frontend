// Email signature maker (Michael 2026-11-12: "agents can create their own in our app", "their own
// instagram facebook etc"). Same SpaceMatch x Real design as Michael's own Gmail signature, filled in
// with the agent's details. Runs in the browser only: nothing is stored on the server and no AI.
import { useQuery } from "convex/react";
import { Check, Code2, Copy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { TextField, btnDark, btnLight, card, copyText, inputCls, labelCls, useSigner } from "@/components/hub/EmailBits";
import { AGENTS } from "@/lib/agents";
import { NO_LINKS, SIG_HOST, SOCIALS, type SigInput, type SocialKey, buildSignature, plainSignature, sigDefaults } from "@/lib/emailSignature";
import { api } from "../../convex/_generated/api";

const KEY = (email: string) => `sm-signature-v1:${email}`;
const BLANK: SigInput = { name: "", title: "", cell: "", email: "", photo: "", showOffice: true, showStats: true, showCta: true, extra: "", links: NO_LINKS, booking: "" };

function Toggle({ label, hint, on, set, testId }: { label: string; hint?: string; on: boolean; set: (b: boolean) => void; testId?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
      <input type="checkbox" data-testid={testId} className="mt-1 size-5 shrink-0 accent-[#0A0A0A]" checked={on} onChange={e => set(e.target.checked)} />
      <span>
        <span className="block text-[15px] font-semibold text-[#0A0A0A]">{label}</span>
        {hint && <span className="block text-[13px] text-stone-500">{hint}</span>}
      </span>
    </label>
  );
}

export function SignaturePage() {
  const me = useQuery(api.hubMe.me);
  const signer = useSigner();
  const [s, setS] = useState<SigInput>(BLANK);
  const [filePhoto, setFilePhoto] = useState(""); // the headshot we have on file for this agent
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Start from what the Hub already knows about the agent, then whatever they saved last time on this device.
  useEffect(() => {
    if (!me || ready) return;
    const d = sigDefaults(me.agentName ?? me.name);
    setFilePhoto(d.photo);
    let saved: Partial<SigInput> = {};
    try { saved = JSON.parse(localStorage.getItem(KEY(me.email)) ?? "{}"); } catch { /* start fresh */ }
    setS({
      ...BLANK,
      name: me.isShared ? "The SpaceMatch Team" : me.name,
      title: me.isShared ? "Residential | Lease | Commercial" : d.title,
      cell: me.isShared ? "" : signer.phone,
      email: signer.email,
      photo: d.photo,
      ...saved,
      links: { ...NO_LINKS, ...(saved.links ?? {}) },
    });
    setReady(true);
  }, [me, ready, signer.phone, signer.email]);
  useEffect(() => {
    if (ready && me) localStorage.setItem(KEY(me.email), JSON.stringify(s));
  }, [s, ready, me]);

  // Office staff and the shared team login can start a signature for any agent on the team.
  const [forAgent, setForAgent] = useState("");
  function startFor(agentName: string) {
    setForAgent(agentName);
    const ag = AGENTS.find(x => x.name === agentName);
    if (!ag) return;
    const d = sigDefaults(ag.name);
    setFilePhoto(d.photo);
    setS(p => ({ ...BLANK, showOffice: p.showOffice, showStats: p.showStats, showCta: p.showCta, name: ag.name, title: d.title, cell: ag.phone ?? "", email: ag.email, photo: d.photo }));
  }

  const set = <K extends keyof SigInput>(k: K, v: SigInput[K]) => setS(p => ({ ...p, [k]: v }));
  const setLink = (k: SocialKey, v: string) => setS(p => ({ ...p, links: { ...p.links, [k]: v } }));
  const html = useMemo(() => buildSignature(s), [s]);
  // On screen the pictures load from this site, so the preview also works before a deploy and on preview builds.
  const previewHtml = useMemo(() => buildSignature(s, window.location.origin), [s]);

  async function copyRich() {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2500); toast.success("Signature copied. Now paste it into your email settings."); };
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plainSignature(s)], { type: "text/plain" }),
      })]);
      done();
    } catch {
      // Older browsers: select the preview and copy it the classic way.
      const node = previewRef.current;
      const sel = window.getSelection();
      if (!node || !sel) return toast.error("Couldn't copy. Select the preview and copy it by hand.");
      const range = document.createRange();
      range.selectNodeContents(node);
      sel.removeAllRanges();
      sel.addRange(range);
      const ok = document.execCommand("copy");
      sel.removeAllRanges();
      if (ok) done(); else toast.error("Couldn't copy. Select the preview and copy it by hand.");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[30px] font-semibold leading-tight md:text-[36px]">Email signature</h1>
        <p className="mt-1 max-w-2xl text-[16px] text-stone-600">Your own SpaceMatch and Real signature in about a minute. Fill in your details, copy it, and paste it into Gmail.</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)]">
        <div className="min-w-0 space-y-5">
          <section className={card}>
            <h2 className="text-[18px] font-semibold">Your details</h2>
            {!!me?.agents.length && (
              <label className="mt-3 block">
                <span className={labelCls}>Make it for</span>
                <select className={`${inputCls} mt-1`} value={forAgent} onChange={e => startFor(e.target.value)} data-testid="sig-for">
                  <option value="">{forAgent ? "Pick an agent" : "Pick an agent to fill in their details"}</option>
                  {me.agents.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="mt-1 block text-[13px] text-stone-500">Office only. Fills in that agent's name, cell, email and photo. Add their social links below.</span>
              </label>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField label="Name" value={s.name} onChange={v => set("name", v)} testId="sig-name" />
              <TextField label="Title" value={s.title} onChange={v => set("title", v)} placeholder="Real Estate Broker" testId="sig-title" />
              <TextField label="Cell" value={s.cell} onChange={v => set("cell", v)} placeholder="(773) 555-0123" type="tel" testId="sig-cell" />
              <TextField label="Email" value={s.email} onChange={v => set("email", v)} type="email" testId="sig-email" />
            </div>
            <div className="mt-3">
              <TextField label="Designations (optional)" value={s.extra} onChange={v => set("extra", v)} placeholder="CLHMS · ABR · Se habla español" hint="One short line under the team numbers. Only list designations you hold today." testId="sig-extra" />
            </div>
          </section>

          <section className={card}>
            <h2 className="text-[18px] font-semibold">Your social links</h2>
            <p className="mt-1 text-[14px] text-stone-600">Type your handle or paste the link. Leave a box empty and it stays off your signature.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {SOCIALS.map(x => (
                <TextField key={x.key} label={x.label} value={s.links[x.key]} onChange={v => setLink(x.key, v)} placeholder={x.hint} testId={`sig-link-${x.key}`} />
              ))}
            </div>
            <div className="mt-3">
              <TextField label="Booking link (optional)" value={s.booking ?? ""} onChange={v => set("booking", v)} placeholder="calendly.com/yourname" hint="Your Calendly or other booking page. Adds “Book a consultation” to your signature." testId="sig-booking" />
            </div>
          </section>

          <section className={card}>
            <h2 className="text-[18px] font-semibold">What to show</h2>
            <div className="mt-2 divide-y divide-[#ebe5da]">
              {filePhoto ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1"><Toggle label="My photo" hint="The headshot we have on file for you." on={!!s.photo} set={b => set("photo", b ? filePhoto : "")} testId="sig-photo" /></div>
                  <img src={filePhoto} alt="" className="size-12 rounded-full ring-2 ring-[#D9BC8C]" />
                </div>
              ) : (
                <p className="py-2.5 text-[14px] text-stone-600">We don't have a headshot on file for you yet, so your signature starts without a photo. Email one to team@spacematchinc.com and it will appear here.</p>
              )}
              <Toggle label="Office line" hint="(773) 985-7153 next to your cell." on={s.showOffice} set={b => set("showOffice", b)} testId="sig-office" />
              <Toggle label="Team numbers" hint="#19 Chicago team, 115 five-star reviews, $297M+ sold, 500+ homes and 100+ businesses sold." on={s.showStats} set={b => set("showStats", b)} testId="sig-stats" />
              <Toggle label="Home value link" hint="“What's your home worth?” goes to the home value page on spacematchinc.com." on={s.showCta} set={b => set("showCta", b)} testId="sig-cta" />
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-5 lg:sticky lg:top-4">
          <section className={card}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[18px] font-semibold">Preview</h2>
              <span className="text-[13px] text-stone-500">Updates as you type</span>
            </div>
            <div className="mt-3 overflow-x-auto rounded-xl bg-white p-4 ring-1 ring-[#ebe5da]">
              <p className="mb-4 text-[14px] text-stone-500">Thanks, talk soon.</p>
              {/* biome-ignore lint/security/noDangerouslySetInnerHtml: built locally from escaped form values */}
              <div ref={previewRef} data-testid="sig-preview" className="max-sm:[zoom:0.7]" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button type="button" className={`${btnDark} min-h-12`} onClick={copyRich} data-testid="sig-copy">
                {copied ? <Check className="size-4 text-[#D9BC8C]" /> : <Copy className="size-4 text-[#D9BC8C]" />} {copied ? "Copied" : "Copy signature"}
              </button>
              <button type="button" className={`${btnLight} min-h-12`} onClick={() => copyText(html, "HTML code copied")} data-testid="sig-copy-html">
                <Code2 className="size-4" /> Copy HTML code
              </button>
            </div>
            <p className="mt-2 text-[13px] text-stone-500">The address, logos and legal line are set by the office, so every signature on the team matches.</p>
          </section>

          <section className={card}>
            <h2 className="text-[18px] font-semibold">Add it to Gmail</h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[15px] text-stone-700">
              <li>On a computer, tap <b>Copy signature</b> above.</li>
              <li>Open Gmail, click the gear, then <b>See all settings</b>.</li>
              <li>Scroll to <b>Signature</b>, click <b>Create new</b>, and paste.</li>
              <li>Pick it under “For new emails use”, then <b>Save changes</b> at the bottom.</li>
            </ol>
            <p className={`${labelCls} mt-4`}>On your phone</p>
            <p className="mt-1 text-[14px] text-stone-600">The Gmail app uses the same signature. If yours doesn't show, open the app's Settings, tap your account, and turn off Mobile Signature.</p>
            <p className={`${labelCls} mt-3`}>Outlook, Apple Mail and others</p>
            <p className="mt-1 text-[14px] text-stone-600">Paste it into that app's signature box the same way. If it asks for code, use <b>Copy HTML code</b>.</p>
          </section>
        </div>
      </div>
      <span className="hidden" data-testid="sig-host">{SIG_HOST}</span>
    </div>
  );
}
