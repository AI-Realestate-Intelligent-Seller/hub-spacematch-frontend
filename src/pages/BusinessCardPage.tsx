import { Download, ExternalLink, MessageSquare, Phone } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { btnDark, btnLight, Card, CopyBtn, H2, PageHead } from "@/components/hub/mm";
import { smsLink } from "@/lib/marketMe";
import { profileFor } from "@/lib/rosterProfiles";
import { useApiData } from "@/lib/apiData";
import { marketMeApi } from "@/lib/marketApi";

// /card — each agent's digital business card: QR + text-able link to /c/:slug (public).
export function BusinessCardPage() {
  const s = useApiData("market-me:settings", () => marketMeApi.settings()).data; // new backend
  const [qr, setQr] = useState<string | null>(null);
  const url = s?.slug ? `${window.location.origin}/c/${s.slug}` : "";
  useEffect(() => {
    if (url) QRCode.toDataURL(url, { width: 720, margin: 1 }).then(setQr).catch(() => setQr(null));
  }, [url]);
  if (!s) return <div className="p-6 text-[17px] text-stone-700">Loading…</div>;
  if (!s.slug)
    return (
      <div className="mx-auto max-w-2xl">
        <PageHead title="My business card" sub="A digital card clients can save to their phone." />
        <Card>
          <p className="text-[17px] text-stone-700">Your login isn't on the team roster, so there's no card to show. Ask Michael or Cris to add you on the Team roster.</p>
        </Card>
      </div>
    );
  const prof = profileFor(s.slug);
  const first = s.name.split(" ")[0];
  const msg = `Hi! Here's my contact card. Tap to save my number: ${url} – ${first}, SpaceMatch`;
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6" data-testid="card-page">
      <PageHead title="My business card" sub="Text it, or let people scan the QR code. They can save your contact in one tap." />
      <div className="overflow-hidden rounded-3xl bg-[#0A0A0A] p-5 text-white shadow-lg" data-testid="card-preview">
        <img src="/logo-white.png" alt="SpaceMatch" className="h-6" />
        <div className="mt-5 flex items-center gap-4">
          {prof?.photo ? (
            <img src={prof.photo} alt="" className="size-20 rounded-full object-cover ring-4 ring-[#D9BC8C]" />
          ) : (
            <div className="grid size-20 place-items-center rounded-full bg-[#1c1a17] font-['Playfair_Display'] text-3xl text-[#D9BC8C]">{first[0]}</div>
          )}
          <div className="min-w-0">
            <div className="font-['Playfair_Display'] text-[26px] font-semibold leading-tight">{s.name}</div>
            <div className="text-[16px] text-[#D9BC8C]">{prof?.title ?? "Real Estate Broker · SpaceMatch Inc."}</div>
          </div>
        </div>
        <div className="mt-4 space-y-1 text-[17px]">
          {s.phone && <div>Cell {s.phone}</div>}
          <div className="break-all">{s.email}</div>
          <div className="text-[15px] text-stone-300">2822 Central St., Evanston, IL 60201 · (773) 985-7153</div>
        </div>
      </div>

      <Card testid="card-share">
        <H2>Share it</H2>
        <div className="flex flex-wrap gap-2">
          <a href={smsLink(msg)} className={btnDark} data-testid="card-text"><MessageSquare className="size-[18px]" /> Text my card</a>
          <CopyBtn text={url} label="Copy link" light testid="card-copy" />
          <a href={url} target="_blank" rel="noreferrer" className={btnLight}><ExternalLink className="size-[18px]" /> See what they see</a>
        </div>
      </Card>

      <Card testid="card-qr">
        <H2>QR code</H2>
        <p className="mb-3 text-[16px] text-stone-700">Show it on your phone at open houses, or print it on a sign or flyer.</p>
        {qr && <img src={qr} alt="QR code for your card" className="mx-auto size-56 rounded-xl ring-1 ring-black/10" data-testid="card-qr-img" />}
        {qr && (
          <a href={qr} download={`${s.slug}-card-qr.png`} className={`${btnDark} mt-3 w-full`}>
            <Download className="size-[18px]" /> Download QR
          </a>
        )}
      </Card>
      <p className="flex items-center gap-2 text-[15px] text-stone-700"><Phone className="size-4" /> Wrong cell or photo? Ask Cris to update you on the Team roster.</p>
    </div>
  );
}
