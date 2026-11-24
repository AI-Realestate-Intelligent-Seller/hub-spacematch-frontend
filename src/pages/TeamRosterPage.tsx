import { useAction, useMutation, useQuery } from "convex/react";
import { Camera, Check, Copy, FolderOpen, Loader2, MessageSquare, Pencil, RotateCcw, Search, UserMinus, UserPlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { agentSlug } from "@/lib/agents";
import { profileBySlug } from "@/lib/agentProfiles";

// Original team: their generated headshot; agents added here: the uploaded one.
const photoOf = (r: { name: string; photo: string }) => r.photo || profileBySlug(agentSlug(r.name))?.photo || "";

// Team roster (Michael 2026-11-16 "full"): admins + ops add, edit and remove agents. Adding someone puts
// them in every agent picker, form link, lead routing, Lead Desk, mailers, signature maker and meet-me
// page, creates their login (temporary password to text) and their Drive video upload folder.

type Row = NonNullable<ReturnType<typeof useQuery<typeof api.roster.list>>>["agents"][number];
type Form = { email: string; name: string; phone: string; title: string; lic: string; bio: string; photo: string; photoId?: Id<"_storage">; isNew: boolean; added: boolean };
const BLANK: Form = { email: "", name: "", phone: "", title: "", lic: "", bio: "", photo: "", isNew: true, added: true };
const errMsg = (e: unknown) => String(e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? "Something went wrong. Try again.";
const initials = (n: string) => n.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const fmtPhone = (s: string) => {
  const d = s.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : s.trim();
};

// Center-crop to a 600px square JPEG: one file works for the meet page, signature and print mailers.
async function squareJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    // Portraits: keep the top of the frame (faces sit high), landscapes: center.
    const sx = (img.naturalWidth - side) / 2;
    const sy = img.naturalHeight > img.naturalWidth ? Math.min((img.naturalHeight - side) * 0.2, img.naturalHeight - side) : 0;
    const c = document.createElement("canvas");
    c.width = c.height = 600;
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, 600, 600);
    g.drawImage(img, sx, sy, side, side, 0, 0, 600, 600);
    return await new Promise<Blob>((ok, bad) => c.toBlob(b => (b ? ok(b) : bad(new Error("Couldn't read that photo"))), "image/jpeg", 0.88));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Avatar({ photo, name, size = "size-12" }: { photo?: string; name: string; size?: string }) {
  return photo
    ? <img src={photo} alt={name} className={`${size} shrink-0 rounded-full object-cover ring-1 ring-[#ebe5da]`} />
    : <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-[#F7F5F1] text-sm font-semibold text-[#9C7434] ring-1 ring-[#ebe5da]`}>{initials(name)}</span>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[14px] font-semibold text-stone-800">{label}</span>
      {hint && <span className="ml-1.5 text-[13px] text-stone-500">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}
const inputCls = "h-11 w-full rounded-xl bg-white px-3 text-[16px] ring-1 ring-[#ebe5da] outline-none focus:ring-2 focus:ring-[#9C7434]";

export function TeamRosterPage() {
  const data = useQuery(api.roster.list);
  const save = useAction(api.roster.save);
  const remove = useAction(api.roster.remove);
  const restore = useAction(api.roster.restore);
  const retryFolder = useAction(api.roster.retryFolder);
  const uploadUrl = useMutation(api.roster.uploadUrl);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; email: string; password: string | null; loginError: string | null; restored?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  if (data === undefined) return <div className="py-16 text-center text-stone-500">Loading…</div>;
  if (data === null) return <div className="py-16 text-center text-stone-600">The team roster is for admins and ops.</div>;

  const set = <K extends keyof Form>(k: K, val: Form[K]) => setForm(f => (f ? { ...f, [k]: val } : f));
  const open = (f: Form) => {
    setForm(f);
    setDone(null);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const edit = (r: Row) => open({ email: r.email, name: r.name, phone: r.phone, title: r.title, lic: r.lic, bio: r.bio, photo: photoOf(r), isNew: false, added: r.added });

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const jpg = await squareJpeg(file);
      const url = await uploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: jpg });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      setForm(f => (f ? { ...f, photoId: storageId, photo: URL.createObjectURL(jpg) } : f));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    if (!form) return;
    setBusy("form");
    try {
      const r = await save({
        email: form.email,
        name: form.name,
        phone: fmtPhone(form.phone),
        title: form.title,
        lic: form.lic,
        bio: form.added ? form.bio : undefined,
        photoId: form.photoId,
        isNew: form.isNew,
      });
      if (form.isNew) setDone({ name: form.name.trim(), email: form.email.trim().toLowerCase(), password: r.password, loginError: r.loginError });
      toast.success(form.isNew ? `${form.name.trim()} added to the team` : "Saved");
      setForm(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const doRemove = async (r: Row) => {
    setBusy(r.email);
    try {
      await remove({ email: r.email });
      toast.success(`${r.name} removed. They can't sign in anymore.`);
      setConfirm(null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  const doRestore = async (email: string) => {
    setBusy(email);
    try {
      const r = await restore({ email });
      setDone({ name: r.name, email, password: r.password, loginError: r.loginError, restored: true });
      toast.success(`${r.name} is back on the team`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  const doFolder = async (email: string) => {
    setBusy(`folder-${email}`);
    try {
      const r = await retryFolder({ email });
      if (r.error) toast.error(`Drive: ${r.error}`);
      else toast.success("Video folder created");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const list = data.agents.filter(r => `${r.name} ${r.email} ${r.phone}`.toLowerCase().includes(q.toLowerCase()));
  const newest = done ? data.agents.find(a => a.email === done.email) : undefined;
  const msg = done?.password
    ? `Hi ${done.name.split(" ")[0]}, welcome to SpaceMatch! Your Agent Hub login: ${location.origin}/login\nEmail: ${done.email}\nTemporary password: ${done.password}\nAdd it to your home screen and you'll stay signed in.`
    : "";

  return (
    <div className="space-y-5" data-testid="team-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-['Playfair_Display'] text-3xl font-bold">Team roster</h1>
          <p className="mt-1 text-[15px] text-stone-600">
            {data.agents.length} agents. Adding someone puts them everywhere in the Hub: agent pickers, client form links, lead routing, Lead Desk, mailers, email signature and their meet-me page.
          </p>
        </div>
        <button type="button" onClick={() => open({ ...BLANK })} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A0A0A] px-4 py-2.5 text-[15px] font-semibold text-white" data-testid="add-agent">
          <UserPlus className="size-4" /> Add agent
        </button>
      </div>

      {done && (
        <div className="rounded-2xl bg-[#0A0A0A] p-4 text-white" data-testid="agent-added">
          <div className="flex items-start gap-3">
            <Avatar photo={newest?.photo} name={done.name} />
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-semibold">{done.name} {done.restored ? "is back on the team" : "is on the team"}</div>
              <ul className="mt-2 space-y-1 text-[14px] text-white/80">
                <li className="flex items-center gap-2"><Check className="size-4 text-[#D9BC8C]" /> In agent pickers, form links, lead routing, mailers and the signature maker</li>
                <li className="flex items-center gap-2">{done.password ? <Check className="size-4 text-[#D9BC8C]" /> : <X className="size-4 text-red-400" />} {done.password ? "Hub login created" : `Login not created: ${done.loginError}. Use Agent logins to make one.`}</li>
                <li className="flex items-center gap-2">
                  {newest?.folderUrl ? <Check className="size-4 text-[#D9BC8C]" /> : newest?.folderError ? <X className="size-4 text-red-400" /> : <Loader2 className="size-4 animate-spin text-[#D9BC8C]" />}
                  {newest?.folderUrl
                    ? <span>Drive video folder ready · <a href={newest.folderUrl} target="_blank" rel="noreferrer" className="underline">open it</a> and share it with {done.email} (Editor) so they can upload</span>
                    : newest?.folderError ? `Drive video folder failed: ${newest.folderError}` : "Creating their Drive video folder…"}
                </li>
              </ul>
            </div>
          </div>
          {done.password && (
            <>
              <div className="mt-4 text-sm text-white/60">Temporary password</div>
              <div className="font-mono text-2xl font-semibold tracking-wide text-[#D9BC8C]" data-testid="new-password">{done.password}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => navigator.clipboard.writeText(msg).then(() => toast.success("Copied"))} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold">
                  <Copy className="size-4" /> Copy welcome text
                </button>
                <a href={`sms:${newest?.phone.replace(/\D/g, "") ?? ""}?&body=${encodeURIComponent(msg)}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[#9C7434] px-3 py-2 text-sm font-semibold">
                  <MessageSquare className="size-4" /> Text it
                </a>
              </div>
              <p className="mt-2 text-xs text-white/50">Shown once. If it gets lost, reset it on Agent logins.</p>
            </>
          )}
          <p className="mt-3 border-t border-white/10 pt-3 text-xs text-white/50">Made by hand, ask Viktor: their Cloud CMA packet pages, the “Your agent” slide in listing decks and guides, and any intro video.</p>
          <button type="button" onClick={() => setDone(null)} className="mt-2 text-sm text-white/60 underline">Done</button>
        </div>
      )}

      {form && (
        <div ref={formRef} className="scroll-mt-20 rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da] md:p-5" data-testid="agent-form">
          <div className="flex items-center justify-between">
            <h2 className="text-[19px] font-semibold">{form.isNew ? "Add an agent" : `Edit ${form.name}`}</h2>
            <button type="button" onClick={() => setForm(null)} className="rounded-lg p-1.5 text-stone-500" aria-label="Close"><X className="size-5" /></button>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <Avatar photo={form.photo} name={form.name || "New agent"} size="size-20" />
            <div>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 rounded-lg bg-[#F7F5F1] px-3 py-2 text-sm font-semibold ring-1 ring-[#ebe5da]">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />} {form.photo ? "Change headshot" : "Add headshot"}
              </button>
              <p className="mt-1 text-[13px] text-stone-500">Cropped to a square. Used on their meet-me page, email signature and mailers.</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => pickPhoto(e.target.files?.[0])} data-testid="agent-photo" />
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Full name"><input value={form.name} onChange={e => set("name", e.target.value)} className={inputCls} placeholder="First Last" data-testid="agent-name" /></Field>
            <Field label="SpaceMatch email">
              <input value={form.email} onChange={e => set("email", e.target.value)} disabled={!form.isNew} className={`${inputCls} disabled:bg-stone-50 disabled:text-stone-500`} placeholder="name@spacematchinc.com" inputMode="email" autoCapitalize="none" data-testid="agent-email" />
            </Field>
            <Field label="Cell"><input value={form.phone} onChange={e => set("phone", e.target.value)} onBlur={e => set("phone", fmtPhone(e.target.value))} className={inputCls} placeholder="(312) 555-0100" inputMode="tel" data-testid="agent-phone" /></Field>
            <Field label="Title" hint="optional"><input value={form.title} onChange={e => set("title", e.target.value)} className={inputCls} placeholder="Real Estate Broker" data-testid="agent-title" /></Field>
            <Field label="Illinois license #" hint="optional"><input value={form.lic} onChange={e => set("lic", e.target.value)} className={inputCls} placeholder="475.123456" data-testid="agent-lic" /></Field>
          </div>
          {form.added ? (
            <div className="mt-3">
              <Field label="Short bio" hint="for their meet-me page, 2–4 sentences">
                <textarea value={form.bio} onChange={e => set("bio", e.target.value)} rows={4} className="w-full rounded-xl bg-white p-3 text-[16px] ring-1 ring-[#ebe5da] outline-none focus:ring-2 focus:ring-[#9C7434]" placeholder="Where they work, who they help, what they're known for." data-testid="agent-bio" />
              </Field>
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-stone-500">Their meet-me bio was written with them. Ask Viktor to change it.</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={submit} disabled={busy === "form" || uploading} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A0A0A] px-4 py-2.5 text-[15px] font-semibold text-white disabled:opacity-60" data-testid="agent-save">
              {busy === "form" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {form.isNew ? "Add to team" : "Save"}
            </button>
            {form.isNew && <span className="text-[13px] text-stone-500">Creates their login and Drive video folder too.</span>}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-[#ebe5da]">
        <Search className="size-4 text-stone-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find an agent" className="h-11 flex-1 bg-transparent outline-none" />
      </label>

      <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe5da]" data-testid="roster-list">
        {list.map(r => (
          <li key={r.email} className="px-4 py-3" data-testid={`roster-${r.email}`}>
            <div className="flex items-center gap-3">
              <Avatar photo={photoOf(r)} name={r.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span className="truncate text-[16px] font-semibold">{r.name}</span>
                  {r.added && <span className="rounded-full bg-[#F1E3C8] px-2 py-0.5 text-[12px] font-semibold text-[#7a5a26]">Added in Hub</span>}
                  {!r.hasLogin && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[12px] font-semibold text-red-700">No login yet</span>}
                </div>
                <div className="truncate text-sm text-stone-500">{r.email} · {r.phone}</div>
                {r.added && !r.folderUrl && (
                  <button type="button" onClick={() => doFolder(r.email)} disabled={busy === `folder-${r.email}`} className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-semibold text-[#9C7434]">
                    {busy === `folder-${r.email}` ? <Loader2 className="size-3.5 animate-spin" /> : <FolderOpen className="size-3.5" />} {r.folderError ? "Retry Drive video folder" : "Create Drive video folder"}
                  </button>
                )}
              </div>
              <button type="button" onClick={() => edit(r)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#F7F5F1] px-3 py-2 text-sm font-semibold" data-testid={`edit-${r.email}`}>
                <Pencil className="size-4" /> <span className="hidden sm:inline">Edit</span>
              </button>
              {r.canRemove && (
                <button type="button" onClick={() => setConfirm(confirm === r.email ? null : r.email)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-stone-500" aria-label={`Remove ${r.name}`} data-testid={`remove-${r.email}`}>
                  <UserMinus className="size-4" />
                </button>
              )}
            </div>
            {confirm === r.email && (
              <div className="mt-3 rounded-xl bg-red-50 p-3 text-[14px] text-red-900" data-testid={`confirm-${r.email}`}>
                Remove {r.name} from the team? They're signed out right away and can't sign in again. Their leads, forms and history stay.
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => doRemove(r)} disabled={busy === r.email} className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white" data-testid={`confirm-remove-${r.email}`}>
                    {busy === r.email && <Loader2 className="size-4 animate-spin" />} Remove
                  </button>
                  <button type="button" onClick={() => setConfirm(null)} className="rounded-lg px-3 py-2 text-sm font-semibold">Cancel</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {data.removed.length > 0 && (
        <div>
          <h2 className="text-[15px] font-semibold text-stone-700">Former members</h2>
          <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe5da]" data-testid="removed-list">
            {data.removed.map(r => (
              <li key={r.email} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-stone-600">{r.name}</div>
                  <div className="truncate text-sm text-stone-500">{r.email}{r.removedAt ? ` · removed ${new Date(r.removedAt).toLocaleDateString()}` : ""}</div>
                </div>
                <button type="button" onClick={() => doRestore(r.email)} disabled={busy === r.email} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#F7F5F1] px-3 py-2 text-sm font-semibold" data-testid={`restore-${r.email}`}>
                  {busy === r.email ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
