import { type ReactNode, useEffect, useState } from "react";
import { setAgents } from "../../convex/agentsData";
import { Skeleton } from "./hub/FormState";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/agents";

// Loads the team roster from the new backend (active agents and admins in the users table) into
// AGENTS before the app renders, so every agent picker, form link, business card, mailer and
// meet-me page shows the people who have Hub accounts. Re-checked when the tab comes back into view.
// If the backend can't be reached, the app renders with the built-in list after 4 s.
export function RosterGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [late, setLate] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<{ items: (Agent & { photo?: string | null })[] }>("/public/roster")
        .then(r => {
          if (!alive) return;
          setAgents(r.items.map(a => ({ ...a, photo: a.photo ?? undefined })));
          setReady(true);
        })
        .catch(e => {
          console.warn("[roster] couldn't load the team roster; using the built-in list", e);
          if (alive) setLate(true);
        });
    void load();
    const onFocus = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onFocus);
    const t = setTimeout(() => setLate(true), 4000);
    return () => {
      alive = false;
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);
  return ready || late ? <>{children}</> : (
    <main className="mx-auto max-w-6xl px-4 py-8"><Skeleton label="Loading the Hub" /></main>
  );
}
