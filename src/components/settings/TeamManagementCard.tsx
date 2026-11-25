import { Loader2, MailPlus, RotateCcw, UserMinus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ALLOWED_EMAIL_DOMAIN,
  authErrorMessage,
  type HubUser,
  type Invitation,
  isAllowedSignupEmail,
  ROLE_LABEL,
  type Role,
  usersApi,
} from "@/lib/authApi";

const ROLES: Role[] = ["agent", "ops", "admin", "guest"];
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "never");

function RoleSelect({ value, onChange, disabled, id }: { value: Role; onChange: (r: Role) => void; disabled?: boolean; id?: string }) {
  return (
    <Select value={value} onValueChange={v => onChange(v as Role)} disabled={disabled}>
      <SelectTrigger id={id} className="h-9 w-[130px]" aria-label="Role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map(r => (
          <SelectItem key={r} value={r}>
            {ROLE_LABEL[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Admin-only team management on the new backend: users (role, remove/restore) and invitations.
export function TeamManagementCard() {
  const { user: me } = useSession();
  const [users, setUsers] = useState<HubUser[] | null>(null);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // id/email of the row being changed
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("agent");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const [u, i] = await Promise.all([usersApi.list(), usersApi.listInvitations()]);
      setUsers(u.items);
      setInvites(i.items);
    } catch (err) {
      setLoadError(authErrorMessage(err, "Couldn't load the team. Please try again."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateUser = async (u: HubUser, patch: { role?: Role; status?: "active" | "removed" }, done: string) => {
    setBusy(u.id);
    try {
      const updated = await usersApi.update(u.id, patch);
      setUsers(list => list?.map(x => (x.id === u.id ? updated : x)) ?? null);
      toast.success(done);
    } catch (err) {
      toast.error(authErrorMessage(err, "Couldn't save the change."));
    } finally {
      setBusy(null);
      setConfirmRemove(null);
    }
  };

  const visible = (users ?? []).filter(u => showRemoved || u.status === "active");
  const removedCount = (users ?? []).filter(u => u.status === "removed").length;
  const pending = invites.filter(i => !i.acceptedAt && !i.revokedAt);
  const past = invites.filter(i => i.acceptedAt || i.revokedAt);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-muted-foreground" />
          Team
          {users && <span className="text-sm font-normal text-muted-foreground">· {users.filter(u => u.status === "active").length} active</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ---- Invite ---- */}
        <form
          className="space-y-2"
          onSubmit={async e => {
            e.preventDefault();
            setInviteError("");
            const email = inviteEmail.trim().toLowerCase();
            if (!isAllowedSignupEmail(email)) {
              setInviteError(`Only @${ALLOWED_EMAIL_DOMAIN} emails can be invited.`);
              return;
            }
            setInviting(true);
            try {
              const inv = await usersApi.invite(email, inviteRole);
              setInvites(list => [inv, ...list.filter(i => i.email !== inv.email)]);
              setInviteEmail("");
              toast.success(`Invited ${email} as ${ROLE_LABEL[inviteRole]}. They can now sign up.`);
            } catch (err) {
              setInviteError(authErrorMessage(err, "Couldn't send the invitation."));
            } finally {
              setInviting(false);
            }
          }}
        >
          <Label htmlFor="invite-email">Invite someone</Label>
          <p className="text-xs text-muted-foreground">
            Anyone with an @{ALLOWED_EMAIL_DOMAIN} email can sign up as an Agent. Invite them to give a different role from the start.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              id="invite-email"
              type="email"
              className="h-9 min-w-0 flex-1 basis-56"
              placeholder={`name@${ALLOWED_EMAIL_DOMAIN}`}
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              required
            />
            <RoleSelect id="invite-role" value={inviteRole} onChange={setInviteRole} />
            <Button type="submit" size="sm" className="h-9" disabled={inviting}>
              {inviting ? <Loader2 className="size-4 animate-spin" /> : <MailPlus className="size-4" />}
              {inviting ? "Inviting..." : "Invite"}
            </Button>
          </div>
          {inviteError && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{inviteError}</p>}
        </form>

        {/* ---- Members ---- */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Members</p>
            {removedCount > 0 && (
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setShowRemoved(s => !s)}>
                {showRemoved ? "Hide removed" : `Show removed (${removedCount})`}
              </Button>
            )}
          </div>

          {loadError && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {loadError}
              <Button size="sm" variant="outline" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          )}
          {!users && !loadError && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading team…
            </div>
          )}

          <ul className="divide-y rounded-lg border" data-testid="team-list">
            {visible.map(u => {
              const isMe = u.id === me?.id;
              const removed = u.status === "removed";
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-sm font-medium">
                      {u.name} {isMe && <span className="text-muted-foreground">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.email} · last sign-in {fmtDate(u.lastLoginAt)}
                    </p>
                  </div>
                  {removed ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      Removed
                    </Badge>
                  ) : (
                    <RoleSelect
                      value={u.role}
                      disabled={isMe || busy === u.id}
                      onChange={r => void updateUser(u, { role: r }, `${u.name} is now ${ROLE_LABEL[r]}`)}
                    />
                  )}
                  {!isMe &&
                    (removed ? (
                      <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => void updateUser(u, { status: "active" }, `${u.name} restored`)}>
                        {busy === u.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                        Restore
                      </Button>
                    ) : confirmRemove === u.id ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="destructive" disabled={busy === u.id} onClick={() => void updateUser(u, { status: "removed" }, `${u.name} removed and signed out`)}>
                          {busy === u.id && <Loader2 className="size-4 animate-spin" />}
                          Confirm remove
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmRemove(u.id)}>
                        <UserMinus className="size-4" />
                        Remove
                      </Button>
                    ))}
                </li>
              );
            })}
            {users && visible.length === 0 && <li className="p-3 text-sm text-muted-foreground">No members yet.</li>}
          </ul>
          <p className="text-xs text-muted-foreground">Removing someone signs them out everywhere and blocks sign-in. You can restore them later.</p>
        </div>

        {/* ---- Invitations ---- */}
        {(pending.length > 0 || past.length > 0) && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Invitations</p>
            <ul className="divide-y rounded-lg border">
              {[...pending, ...past].map(i => {
                const state = i.acceptedAt ? "Joined" : i.revokedAt ? "Revoked" : "Pending";
                return (
                  <li key={i.email} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate text-sm">{i.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABEL[i.role]} · invited by {i.invitedBy} · {fmtDate(i.createdAt)}
                      </p>
                    </div>
                    <Badge variant={state === "Pending" ? "secondary" : "outline"}>{state}</Badge>
                    {state === "Pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === i.email}
                        onClick={async () => {
                          setBusy(i.email);
                          try {
                            const r = await usersApi.revokeInvitation(i.email);
                            setInvites(list => list.map(x => (x.email === r.email ? r : x)));
                            toast.success(`Invitation for ${i.email} revoked`);
                          } catch (err) {
                            toast.error(authErrorMessage(err, "Couldn't revoke the invitation."));
                          } finally {
                            setBusy(null);
                          }
                        }}
                      >
                        {busy === i.email && <Loader2 className="size-4 animate-spin" />}
                        Revoke
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
