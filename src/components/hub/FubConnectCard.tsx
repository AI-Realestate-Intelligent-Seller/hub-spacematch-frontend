// Settings → Follow Up Boss. Agent pastes their own FUB API key once; Hub leads
// routed to them are then copied into their FUB (Lofty still gets every lead).
import { useAction, useMutation, useQuery } from "convex/react";
import { CheckCircle2, Link2, Loader2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "../../../convex/_generated/api";

const when = (t: number) =>
  new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function FubConnectCard() {
  const conn = useQuery(api.fub.mine);
  const connect = useAction(api.fub.connect);
  const setEnabled = useMutation(api.fub.setEnabled);
  const disconnect = useMutation(api.fub.disconnect);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await connect({ apiKey: key });
      toast.success(`Connected to ${r.accountLabel}`);
      setKey("");
      setEditing(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.replace(/^.*Uncaught Error: /s, "").split("\n")[0]);
    } finally {
      setBusy(false);
    }
  };

  const showForm = conn === null || editing;

  return (
    <Card data-testid="fub-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <img src="/tools/fub.png" alt="" className="size-5 rounded" /> Follow Up Boss
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Use your own Follow Up Boss too? Connect it and every Hub lead sent to you (open house sign-ins, form replies, mailer QR
          scans, Why SpaceMatch, website pricing reviews) is copied into your FUB with the answers attached. Lofty still gets every
          lead as usual.
        </p>
        {conn === undefined ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            {conn && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2" data-testid="fub-connected">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    {conn.accountLabel || "Connected"}
                    <span className="text-xs font-normal text-muted-foreground">key {conn.keyHint}</span>
                  </div>
                  <Switch
                    checked={conn.enabled}
                    onCheckedChange={c => void setEnabled({ enabled: c })}
                    aria-label="Send Hub leads to Follow Up Boss"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {conn.enabled ? "On" : "Paused"} · {conn.pushedCount} lead{conn.pushedCount === 1 ? "" : "s"} sent
                  {conn.lastPushAt ? `, last ${when(conn.lastPushAt)}` : ""}
                </p>
                {conn.lastError && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-700">
                    <TriangleAlert className="size-3.5 mt-0.5 shrink-0" />
                    Last try failed{conn.lastErrorAt ? ` (${when(conn.lastErrorAt)})` : ""}: {conn.lastError}
                  </p>
                )}
                {!editing && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                      Change key
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => void disconnect().then(() => toast.success("Follow Up Boss disconnected"))}
                    >
                      Disconnect
                    </Button>
                  </div>
                )}
              </div>
            )}
            {showForm && (
              <form onSubmit={save} className="space-y-2">
                <label htmlFor="fub-key" className="text-sm font-medium">
                  Your FUB API key
                </label>
                <div className="flex gap-2">
                  <Input
                    id="fub-key"
                    data-testid="fub-key"
                    type="password"
                    autoComplete="off"
                    placeholder="Paste the key"
                    value={key}
                    onChange={e => setKey(e.target.value)}
                    className="bg-white"
                  />
                  <Button type="submit" disabled={busy || !key.trim()} data-testid="fub-connect">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                    Connect
                  </Button>
                </div>
                {error && (
                  <p className="text-sm text-destructive" data-testid="fub-error">
                    {error}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  In Follow Up Boss: <b>Admin → API</b> → Create API key, then copy it here. Only you can see this setting; the key is
                  stored on the Hub's server and never shown again.
                </p>
              </form>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
