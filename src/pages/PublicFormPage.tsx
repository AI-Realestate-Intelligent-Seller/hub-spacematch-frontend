import { OFFICE_ADDRESS } from "../../convex/officeDefs";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { AGENTS, agentBySlug } from "@/lib/agents";
import { type Field, formById } from "../../convex/formDefs";
import { apiErrorMessage, useApiData } from "@/lib/apiData";
import { formsApi } from "@/lib/formsApi";

const inputCls = "w-full rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-[16px] outline-none focus:border-[#9C7434] focus:ring-2 focus:ring-[#9C7434]/20";

function FieldInput({ f, value, onChange }: { f: Field; value: string; onChange: (v: string) => void }) {
  const id = `form-field-${f.id}`;
  switch (f.type) {
    case "textarea":
      return <textarea id={id} className={`${inputCls} min-h-[96px]`} value={value} placeholder={f.placeholder} onChange={e => onChange(e.target.value)} />;
    case "select":
      return (
        <select id={id} className={inputCls} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Select…</option>
          {f.options?.map(o => <option key={o}>{o}</option>)}
        </select>
      );
    case "agent":
      return (
        <select id={id} className={inputCls} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Select…</option>
          {AGENTS.map(a => <option key={a.name}>{a.name}</option>)}
        </select>
      );
    case "radio":
      return (
        <div className="flex flex-wrap gap-2">
          {f.options?.map(o => (
            <button key={o} type="button" onClick={() => onChange(value === o ? "" : o)} className={`rounded-full px-4 py-2 text-sm ring-1 transition-colors ${value === o ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white text-stone-700 ring-stone-200"}`}>
              {o}
            </button>
          ))}
        </div>
      );
    case "checks": {
      const set = new Set(value ? value.split(", ") : []);
      return (
        <div className="flex flex-wrap gap-2">
          {f.options?.map(o => (
            <button key={o} type="button" onClick={() => { set.has(o) ? set.delete(o) : set.add(o); onChange([...set].join(", ")); }} className={`rounded-full px-4 py-2 text-sm ring-1 transition-colors ${set.has(o) ? "bg-[#9C7434] text-white ring-[#9C7434]" : "bg-white text-stone-700 ring-stone-200"}`}>
              {o}
            </button>
          ))}
        </div>
      );
    }
    case "rating":
      return (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" onClick={() => onChange(String(n))} aria-label={`${n} stars`}>
              <Star className={`size-9 ${Number(value) >= n ? "fill-[#9C7434] text-[#9C7434]" : "text-stone-300"}`} />
            </button>
          ))}
        </div>
      );
    case "money":
      return (
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">$</span>
          <input id={id} inputMode="numeric" className={`${inputCls} pl-7`} value={value} onChange={e => onChange(e.target.value.replace(/[^\d.,]/g, ""))} />
        </div>
      );
    default:
      return (
        <input
          id={id}
          className={inputCls}
          type={f.type === "number" ? "text" : f.type}
          inputMode={f.type === "number" ? "decimal" : f.type === "tel" ? "tel" : undefined}
          autoComplete={f.id === "fullName" ? "name" : f.type === "email" ? "email" : f.type === "tel" ? "tel" : undefined}
          value={value}
          placeholder={f.placeholder}
          onChange={e => onChange(e.target.value)}
        />
      );
  }
}

export function PublicFormPage() {
  const { formId = "" } = useParams();
  const [params] = useSearchParams();
  const def = formById(formId);
  const agent = agentBySlug(params.get("a"));
  const link = params.get("link");
  const { data: context, error: contextError } = useApiData(link && def ? `public-form:${link}` : null, () => formsApi.context(formId, link!));
  const [submissionId] = useState(() => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const p = params.get("p");
    if (p) setAnswers(a => ({ ...a, propertyAddress: a.propertyAddress ?? p }));
    if (def) document.title = `${def.title} · SpaceMatch`;
  }, [params, def]);

  const sections = useMemo(() => {
    const out: { title?: string; fields: Field[] }[] = [];
    for (const f of def?.fields ?? []) {
      if (f.section || out.length === 0) out.push({ title: f.section, fields: [] });
      out[out.length - 1].fields.push(f);
    }
    return out;
  }, [def]);

  if (!def) {
    return <div className="min-h-svh grid place-items-center bg-[#F7F5F1] p-6 text-center text-stone-600">This form link isn't valid anymore. Please ask your agent for a new one.</div>;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const missing = def.fields.find(f => f.required && !((f.id === "propertyAddress" ? context?.address : null) ?? answers[f.id] ?? "").trim());
    if (missing) return setErr(`Please fill in “${missing.label}”`);
    if (def.audience === "client" && !answers.email?.trim() && !answers.phone?.trim()) {
      return setErr("Please add an email or a phone number so we can reach you");
    }
    setBusy(true);
    try {
      await formsApi.submit(def.id, { submissionId, link: link ?? undefined, agent: params.get("a") ?? undefined, answers, website: hp || undefined });
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (x) {
      setErr(apiErrorMessage(x));
    } finally {
      setBusy(false);
    }
  };

  const contactCard = context?.agentName ? <p className="mt-4 text-sm text-[#ddd6ca]">{context.agentName}</p> : agent ? (
    <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 mt-5 ring-1 ring-white/15">
      <span className="flex size-11 items-center justify-center rounded-full bg-[#9C7434] font-semibold">{agent.name.split(" ").map(s => s[0]).slice(0, 2).join("")}</span>
      <div className="text-sm">
        <div className="font-semibold">{agent.name}</div>
        <div className="text-[#cfc7b9]">{agent.phone} · {agent.email}</div>
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-svh bg-[#F7F5F1]">
      <header className="bg-[#0A0A0A] text-white">
        <div className="mx-auto max-w-2xl px-5 pt-6 pb-8">
          <img src="/logo-white.png" alt="SpaceMatch" className="h-6" />
          <h1 className="font-['Playfair_Display'] text-3xl font-bold mt-6">{def.title}</h1>
          {!done && <p className="text-[#ddd6ca] mt-2">{def.intro}</p>}
          {contactCard}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6">
        {contextError ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{apiErrorMessage(contextError)}</p> : link && !context ? <p role="status">Loading form…</p> : done ? (
          <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-[#ebe5da]">
            <CheckCircle2 className="mx-auto size-14 text-[#9C7434]" />
            <h2 className="font-['Playfair_Display'] text-2xl font-semibold mt-3">Thank you!</h2>
            <p className="text-stone-600 mt-2">
              {def.audience === "client"
                ? `${(context?.agentName ?? agent?.name)?.split(" ")[0] ?? "Your SpaceMatch agent"} has your answers and will be in touch shortly.`
                : "Sent to the team. You'll hear back soon."}
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            {sections.map((s, i) => (
              <section key={i} className="rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]">
                {s.title && <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9C7434] mb-4">{s.title}</h2>}
                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-4">
                  {s.fields.map(f => (
                    <div key={f.id} className={f.half ? "" : "sm:col-span-2"}>
                      <label htmlFor={`form-field-${f.id}`} className="block text-[15px] font-medium text-[#0A0A0A] mb-1.5">
                        {f.label}{f.required && <span className="text-[#9C7434]"> *</span>}
                      </label>
                      {f.id === "propertyAddress" && context?.address
                        ? <input id={`form-field-${f.id}`} className={inputCls} value={context.address} readOnly />
                        : <FieldInput f={f} value={answers[f.id] ?? ""} onChange={v => setAnswers(a => ({ ...a, [f.id]: v }))} />}
                      {f.help && <p className="text-xs text-stone-500 mt-1">{f.help}</p>}
                    </div>
                  ))}
                </div>
                {i === 0 && def.audience === "client" && (
                  <p className="text-xs text-stone-500 mt-3">Please add an email or a phone number so we can reach you.</p>
                )}
              </section>
            ))}
            <input tabIndex={-1} autoComplete="off" value={hp} onChange={e => setHp(e.target.value)} name="website" className="hidden" aria-hidden />
            {err && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{err}</div>}
            <button type="submit" disabled={busy} className="w-full rounded-2xl bg-[#0A0A0A] py-4 text-base font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 className="mx-auto size-5 animate-spin" /> : "Submit"}
            </button>
            <p className="text-center text-xs text-stone-500 pb-6">
              SpaceMatch Inc. · a team of Real Broker, LLC · {OFFICE_ADDRESS} · (773) 985-7153
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
