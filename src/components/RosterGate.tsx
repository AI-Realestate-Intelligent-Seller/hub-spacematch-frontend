import { useQuery } from "convex/react";
import { type ReactNode, useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { setAgents } from "../../convex/agentsData";

// Loads the live team roster (Team roster screen adds/removes) into AGENTS before the app renders,
// so every agent picker, form link, mailer and meet-me page sees agents added in the Hub.
// If it is slow, the app renders with the built-in list after 4s and picks up the live one later.
export function RosterGate({ children }: { children: ReactNode }) {
  const list = useQuery(api.roster.publicList);
  const [ready, setReady] = useState(false);
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!list) return;
    setAgents(list);
    setReady(true);
  }, [list]);
  useEffect(() => {
    const t = setTimeout(() => setLate(true), 4000);
    return () => clearTimeout(t);
  }, []);
  return ready || late ? <>{children}</> : null;
}
