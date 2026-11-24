import { Mail, MessageSquare, Phone, UserPlus } from "lucide-react";
import { Link, useParams } from "react-router";
import { AGENTS, agentSlug } from "@/lib/agents";
import { downloadText, vcard } from "@/lib/marketMe";
import { profileFor } from "@/lib/rosterProfiles";

// /c/:slug — public digital business card (no login): call, text, email, save contact (vCard).
const tel = (p: string) => p.replace(/[^\d+]/g, "");

export function PublicCardPage() {
  const { slug = "" } = useParams();
  const a = AGENTS.find(x => agentSlug(x.name) === slug.toLowerCase());
  const prof = profileFor(slug);
  if (!a)
    return <div className="grid min-h-svh place-items-center bg-[#F7F5F1] p-6 text-[18px] text-stone-700">Card not found. Call SpaceMatch at (773) 985-7153.</div>;
  const first = a.name.split(" ")[0];
  const title = prof?.title ?? "Real Estate Broker · SpaceMatch Inc.";
  const save = () =>
    downloadText(`${slug}.vcf`, vcard({ name: a.name, phone: a.phone, email: a.email, title, url: `${window.location.origin}/m/${slug}` }), "text/vcard");
  const big = "flex min-h-[56px] items-center justify-center gap-2 rounded-2xl text-[18px] font-bold";
  return (
    <div className="min-h-svh bg-[#F7F5F1]" data-testid="public-card">
      <div className="bg-[#0A0A0A] px-5 pb-8 pt-5 text-white">
        <img src="/logo-white.png" alt="SpaceMatch" className="h-6" />
        <div className="mt-6 flex flex-col items-center text-center">
          {prof?.photo ? (
            <img src={prof.photo} alt={a.name} className="size-28 rounded-full object-cover ring-4 ring-[#D9BC8C]" />
          ) : (
            <div className="grid size-28 place-items-center rounded-full bg-[#1c1a17] font-['Playfair_Display'] text-4xl text-[#D9BC8C]">{first[0]}</div>
          )}
          <h1 className="mt-3 font-['Playfair_Display'] text-[30px] font-semibold">{a.name}</h1>
          <div className="text-[17px] text-[#D9BC8C]">{title}</div>
        </div>
      </div>
      <main className="mx-auto -mt-4 max-w-md space-y-3 px-5 pb-8">
        <button type="button" onClick={save} className={`${big} w-full bg-[#9C7434] text-white`} data-testid="card-save">
          <UserPlus className="size-5" /> Save my contact
        </button>
        <div className="grid grid-cols-3 gap-2">
          <a href={`tel:${tel(a.phone)}`} className={`${big} bg-[#0A0A0A] text-white`}><Phone className="size-5" /> Call</a>
          <a href={`sms:${tel(a.phone)}`} className={`${big} bg-white text-[#0A0A0A] ring-2 ring-[#0A0A0A]`}><MessageSquare className="size-5" /> Text</a>
          <a href={`mailto:${a.email}`} className={`${big} bg-white text-[#0A0A0A] ring-2 ring-[#0A0A0A]`}><Mail className="size-5" /> Email</a>
        </div>
        <Link to={`/m/${slug}`} className={`${big} w-full bg-white text-[#0A0A0A] ring-1 ring-[#ddd6ca]`}>Why work with {first}</Link>
        <p className="pt-2 text-center text-[15px] leading-relaxed text-stone-700">
          {a.phone} · {a.email}
          <br />
          SpaceMatch Inc. · a team of Real Broker, LLC
          <br />
          2822 Central St., Evanston, IL 60201 · (773) 985-7153
        </p>
      </main>
    </div>
  );
}
