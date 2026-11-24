import { useMutation, useQuery } from "convex/react";
import { Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { profileFor } from "@/lib/rosterProfiles";
import { api } from "../../convex/_generated/api";

// /r/:token — public page a client opens from a review request (no login). No review gating:
// the Google button is always shown; the private note is optional and separate.
export function ReviewLandingPage() {
  const { token = "" } = useParams();
  const r = useQuery(api.marketMe.reviewView, { token });
  const ping = useMutation(api.marketMe.reviewPing);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const opened = useRef(false);
  useEffect(() => {
    if (r && !opened.current) {
      opened.current = true;
      ping({ token, event: "open" }).catch(() => {});
    }
  }, [r, token, ping]);

  if (r === undefined) return <div className="min-h-svh bg-[#F7F5F1]" />;
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
          onClick={() => ping({ token, event: "click" }).catch(() => {})}
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
                onChange={e => setNote(e.target.value)}
                rows={4}
                className="w-full rounded-xl border-2 border-stone-300 p-3 text-[17px] outline-none focus:border-[#0A0A0A]"
                data-testid="review-note"
              />
              <button
                type="button"
                disabled={!note.trim()}
                onClick={() => ping({ token, event: "note", note }).then(() => setSent(true))}
                className="mt-2 min-h-[48px] w-full rounded-xl bg-[#0A0A0A] text-[17px] font-bold text-white disabled:opacity-50"
                data-testid="review-note-send"
              >
                Send privately
              </button>
            </>
          )}
        </section>
        <p className="text-center text-[15px] text-stone-700">SpaceMatch Inc. · a team of Real Broker, LLC · (773) 985-7153</p>
      </main>
    </div>
  );
}
