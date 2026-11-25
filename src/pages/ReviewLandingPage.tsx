import { Loader2, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { FieldError } from "@/components/hub/FormState";
import { apiErrorMessage, useApiData } from "@/lib/apiData";
import { marketMeApi } from "@/lib/marketApi";
import { profileFor } from "@/lib/rosterProfiles";

const MAX_NOTE = 1000;

// /r/:token — public page a client opens from a review request (no login). No review gating:
// the Google button is always shown; the private note is optional and separate.
export function ReviewLandingPage() {
  const { token = "" } = useParams();
  const res = useApiData(`review:${token}`, () => marketMeApi.reviewView(token));
  // undefined = loading, null = link not found
  const r = res.notFound ? null : res.data;
  const [note, setNote] = useState("");
  const [noteErr, setNoteErr] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const opened = useRef(false);
  useEffect(() => {
    if (r && !opened.current) {
      opened.current = true;
      marketMeApi.reviewPing(token, "open").catch(() => {});
    }
  }, [r, token]);
  const sendNote = async () => {
    const t = note.trim();
    if (!t) return setNoteErr("Write a note first.");
    if (t.length > MAX_NOTE) return setNoteErr(`Your note is too long (${MAX_NOTE} characters max).`);
    setSending(true);
    try {
      await marketMeApi.reviewNote(token, t);
      setSent(true);
    } catch (e) {
      setNoteErr(apiErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  if (r === undefined && res.error) return (
    <div className="grid min-h-svh place-items-center bg-[#F7F5F1] p-6 text-center">
      <div className="text-[18px] text-stone-700">
        Couldn't load this page. Check your connection.
        <button type="button" onClick={() => void res.reload()} className="mt-3 block w-full rounded-xl bg-[#0A0A0A] py-3 text-[17px] font-bold text-white">Try again</button>
      </div>
    </div>
  );
  if (r === undefined) return <div className="grid min-h-svh place-items-center bg-[#F7F5F1]"><Loader2 className="size-7 animate-spin text-[#9C7434]" aria-label="Loading" /></div>;
  if (r === null)
    return (
      <div className="grid min-h-svh place-items-center bg-[#F7F5F1] p-6 text-center text-[18px] text-stone-700">
        This link isn't active anymore. Please contact your agent.
      </div>
    );
  const agentFirst = r.agentName.split(" ")[0];
  const photo = profileFor(r.agentSlug)?.photo;

  return (
    <div className="min-h-svh bg-[#F7F5F1]" data-testid="review-landing">
      <div className="bg-[#0A0A0A] px-5 py-4">
        <img src="/logo-white.png" alt="SpaceMatch" className="h-6" />
      </div>
      <main className="mx-auto max-w-md space-y-5 px-5 py-6">
        <div className="flex items-center gap-4">
          {photo ? (
            <img src={photo} alt={r.agentName} className="size-20 rounded-full object-cover ring-4 ring-[#D9BC8C]" />
          ) : (
            <div className="grid size-20 place-items-center rounded-full bg-[#0A0A0A] font-['Playfair_Display'] text-2xl text-[#D9BC8C]">{agentFirst[0]}</div>
          )}
          <div>
            <div className="text-[17px] text-stone-700">Hi {r.clientFirst},</div>
            <h1 className="font-['Playfair_Display'] text-[26px] font-semibold leading-tight text-[#0A0A0A]">Thank you for working with {agentFirst}</h1>
          </div>
        </div>
        <p className="text-[18px] leading-relaxed text-[#1c1917]">
          Would you share how it went? A Google review takes about a minute and helps other families find {agentFirst}.
          {r.team && <> Please mention <b>{agentFirst}</b> by name.</>}
        </p>
        <a
          href={r.reviewUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => { marketMeApi.reviewPing(token, "click").catch(() => {}); }}
          className="flex min-h-[60px] items-center justify-center gap-2 rounded-2xl bg-[#9C7434] px-5 text-[19px] font-bold text-white"
          data-testid="review-google"
        >
          <Star className="size-5" /> Leave a Google review
        </a>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da]">
          <h2 className="text-[18px] font-bold text-[#0A0A0A]">Anything we could do better?</h2>
          <p className="mb-2 text-[16px] text-stone-700">Optional and private. Only {agentFirst} and the SpaceMatch team see it.</p>
          {sent || r.noteSent ? (
            <p className="text-[17px] font-semibold text-[#0A0A0A]" data-testid="review-note-sent">Thank you. We got your note.</p>
          ) : (
            <>
              <textarea
                value={note}
                onChange={e => { setNote(e.target.value.slice(0, MAX_NOTE)); if (noteErr) setNoteErr(""); }}
                maxLength={MAX_NOTE}
                rows={4}
                aria-label="Your private note"
                aria-invalid={!!noteErr}
                className={`w-full rounded-xl border-2 p-3 text-[17px] outline-none focus:border-[#0A0A0A] ${noteErr ? "border-red-400" : "border-stone-300"}`}
                data-testid="review-note"
              />
              <div className="flex items-start justify-between gap-3"><FieldError msg={noteErr} /><span className="ml-auto mt-1 text-sm text-stone-500">{note.length}/{MAX_NOTE}</span></div>
              <button
                type="button"
                disabled={!note.trim() || sending}
                onClick={sendNote}
                className="mt-2 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] text-[17px] font-bold text-white disabled:opacity-50"
                data-testid="review-note-send"
              >
                {sending && <Loader2 className="size-5 animate-spin" />}{sending ? "Sending…" : "Send privately"}
              </button>
            </>
          )}
        </section>
        <p className="text-center text-[15px] text-stone-700">SpaceMatch Inc. · a team of Real Broker, LLC · (773) 985-7153</p>
      </main>
    </div>
  );
}
