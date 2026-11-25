import { Loader2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { authErrorMessage, ROLE_LABEL, usersApi } from "@/lib/authApi";

type Form = { name: string; phone: string; title: string; licenseNo: string; bio: string };

// Edit your own profile on the new backend (PATCH /api/v1/users/me).
export function ProfileCard() {
  const { user, refresh } = useSession();
  const initial = (): Form => ({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    title: user?.title ?? "",
    licenseNo: user?.licenseNo ?? "",
    bio: user?.bio ?? "",
  });
  const [form, setForm] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Pick up the latest values when the session reloads (e.g. after saving).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the stored user changes
  useEffect(() => setForm(initial()), [user]);

  if (!user) return null;
  const dirty = JSON.stringify(form) !== JSON.stringify(initial());
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }));
  const orNull = (v: string) => (v.trim() ? v.trim() : null);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="size-4 text-muted-foreground" />
          Profile
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={async e => {
            e.preventDefault();
            setError("");
            if (!form.name.trim()) {
              setError("Your name can't be empty.");
              return;
            }
            setSaving(true);
            try {
              await usersApi.updateMe({
                name: form.name.trim(),
                phone: orNull(form.phone),
                title: orNull(form.title),
                licenseNo: orNull(form.licenseNo),
                bio: orNull(form.bio),
              });
              await refresh(); // header name/initials update straight away
              toast.success("Profile saved");
            } catch (err) {
              setError(authErrorMessage(err, "Could not save your profile. Please try again."));
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="profile-name">Full name</Label>
              <Input id="profile-name" value={form.name} onChange={set("name")} maxLength={120} autoComplete="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" value={user.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-role">Role</Label>
              <Input id="profile-role" value={ROLE_LABEL[user.role]} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">Phone</Label>
              <Input id="profile-phone" value={form.phone} onChange={set("phone")} maxLength={40} inputMode="tel" autoComplete="tel" placeholder="(312) 555-0100" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-title">Title</Label>
              <Input id="profile-title" value={form.title} onChange={set("title")} maxLength={120} placeholder="e.g. Broker" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="profile-license">License no.</Label>
              <Input id="profile-license" value={form.licenseNo} onChange={set("licenseNo")} maxLength={60} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="profile-bio">Bio</Label>
              <Textarea id="profile-bio" value={form.bio} onChange={set("bio")} maxLength={2000} rows={4} placeholder="A few lines about you" />
            </div>
          </div>
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={!dirty || saving} onClick={() => setForm(initial())}>
              Cancel
            </Button>
            <Button type="submit" disabled={!dirty || saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
