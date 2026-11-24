import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/auth/session";
import { ApiError } from "@/lib/api";
import { authApi, authErrorMessage } from "@/lib/authApi";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

// Sign-in against the new backend (/api/v1/auth). Kept from the old Hub (Michael 2026-10-29):
// catch email typos, plain errors, and a no-email "forgot password" path via the office.
const HUB_DOMAIN = "spacematchinc.com";
function lev(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
export function emailTypoFix(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  const [user, domain] = e.split("@");
  if (!user || !domain || domain === HUB_DOMAIN) return null;
  if (domain.startsWith("spacematch") || lev(domain, HUB_DOMAIN) <= 3) return `${user}@${HUB_DOMAIN}`;
  return null;
}
function TypoHint({ value, onFix }: { value: string; onFix: (v: string) => void }) {
  const fix = emailTypoFix(value);
  if (!fix) return null;
  return (
    <button type="button" onClick={() => onFix(fix)} className="w-full rounded-lg bg-amber-50 px-3 py-2 text-left text-sm text-amber-900" data-testid="email-typo">
      Did you mean <b>{fix}</b>? Tap to fix.
    </button>
  );
}
export const OFFICE = "(773) 985-7153";
export const JUNK_NOTE = "Check Junk, Spam or Promotions if you don't see it in a minute.";

function ErrorText({ error }: { error: string }) {
  if (!error) return null;
  return <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>;
}

type Step =
  | "signIn"
  | { type: "verify"; email: string; password: string }
  | { type: "forgot"; email?: string }
  | { type: "reset-code"; email: string }
  | { type: "new-password"; email: string; code: string };

export function SignIn() {
  const { refresh } = useSession();
  const [step, setStep] = useState<Step>("signIn");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  const go = (next: Step) => {
    setError("");
    setInfo("");
    setStep(next);
  };

  if (step === "signIn") {
    return (
      <Card variant="elevated">
        <CardContent className="pt-6">
          <form
            onSubmit={async e => {
              e.preventDefault();
              setError("");
              setLoading(true);
              const password = String(new FormData(e.currentTarget).get("password") ?? "");
              try {
                await authApi.signIn(email, password);
                await refresh(); // PublicOnlyRoute then moves the user on
              } catch (err) {
                if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") {
                  // Account exists but the email was never confirmed: send a fresh code and ask for it.
                  await authApi.sendCode(email, "email-verification").catch(() => undefined);
                  go({ type: "verify", email: email.trim().toLowerCase(), password });
                } else {
                  setError(authErrorMessage(err));
                }
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@spacematchinc.com"
                autoComplete="email"
                className="h-11"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => setEmail(email.trim().toLowerCase())}
                required
              />
              <TypoHint value={email} onFix={setEmail} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Button
                  type="button"
                  variant="link"
                  className="px-0 h-auto text-xs text-muted-foreground hover:text-primary"
                  onClick={() => go({ type: "forgot", email })}
                >
                  Forgot password?
                </Button>
              </div>
              <Input id="password" name="password" type="password" placeholder="••••••••" autoComplete="current-password" className="h-11" required />
            </div>
            <ErrorText error={error} />
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (step.type === "verify") {
    return (
      <Card variant="elevated">
        <CardContent className="pt-6">
          <CodeHeader title="Confirm your email" email={step.email} />
          <form
            onSubmit={async e => {
              e.preventDefault();
              setError("");
              setLoading(true);
              const code = String(new FormData(e.currentTarget).get("code") ?? "");
              try {
                await authApi.verifyEmail(step.email, code);
                await authApi.signIn(step.email, step.password);
                await refresh();
              } catch (err) {
                setError(authErrorMessage(err));
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-4"
          >
            <CodeInput label="Verification Code" />
            {info && <p className="text-sm text-muted-foreground">{info}</p>}
            <ErrorText error={error} />
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Verifying..." : "Verify and sign in"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={async () => {
                setError("");
                try {
                  await authApi.sendCode(step.email, "email-verification");
                  setInfo("A new code is on its way.");
                } catch (err) {
                  setError(authErrorMessage(err));
                }
              }}
            >
              Resend code
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => go("signIn")}>
              <ArrowLeft className="size-4" />
              Back to sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (step.type === "forgot") {
    return (
      <Card variant="elevated">
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <h2 className="font-semibold text-lg">Forgot your password?</h2>
          </div>
          <div className="mb-5 rounded-xl bg-[#F7F5F1] p-4 text-[15px] leading-relaxed" data-testid="reset-by-text">
            <b>Fastest:</b> text the office at{" "}
            <a href="sms:+17739857153" className="font-semibold text-[#7a5a26] underline">{OFFICE}</a> or ask Cris. They reset it in the Hub and text you a temporary password. No email needed.
          </div>
          <p className="mb-3 text-sm text-muted-foreground">Or get a reset code by email:</p>
          <form
            onSubmit={async e => {
              e.preventDefault();
              setError("");
              setLoading(true);
              const typed = email.trim().toLowerCase();
              try {
                await authApi.requestPasswordReset(typed);
                go({ type: "reset-code", email: typed });
              } catch (err) {
                setError(authErrorMessage(err, `Couldn't send a code right now. Text the office at ${OFFICE} for a temporary password.`));
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@spacematchinc.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className="h-11" required />
              <TypoHint value={email} onFix={setEmail} />
            </div>
            <ErrorText error={error} />
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Sending..." : "Email me a code"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => go("signIn")}>
              <ArrowLeft className="size-4" />
              Back to sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (step.type === "reset-code") {
    return (
      <Card variant="elevated">
        <CardContent className="pt-6">
          <CodeHeader title="Check your email" email={step.email} extra={`No code? Text the office at ${OFFICE}.`} />
          <form
            onSubmit={e => {
              e.preventDefault();
              const code = String(new FormData(e.currentTarget).get("code") ?? "");
              go({ type: "new-password", email: step.email, code });
            }}
            className="space-y-4"
          >
            <CodeInput label="Reset Code" />
            <ErrorText error={error} />
            <Button type="submit" className="w-full h-11">
              Continue
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => go({ type: "forgot", email: step.email })}>
              Resend code
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated">
      <CardContent className="pt-6">
        <div className="text-center mb-6">
          <h2 className="font-semibold text-lg">Set New Password</h2>
          <p className="text-sm text-muted-foreground">At least 8 characters</p>
        </div>
        <form
          onSubmit={async e => {
            e.preventDefault();
            setError("");
            setLoading(true);
            const newPassword = String(new FormData(e.currentTarget).get("newPassword") ?? "");
            try {
              await authApi.resetPassword(step.email, step.code, newPassword);
              await authApi.signIn(step.email, newPassword);
              await refresh();
            } catch (err) {
              const msg = authErrorMessage(err, "Could not reset password. The code may have expired.");
              if (err instanceof ApiError && ["INVALID_OTP", "OTP_EXPIRED", "TOO_MANY_ATTEMPTS"].includes(err.code)) {
                go({ type: "forgot", email: step.email });
              }
              setError(msg);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input id="newPassword" name="newPassword" type="password" placeholder="••••••••" minLength={8} autoComplete="new-password" className="h-11" required />
          </div>
          <ErrorText error={error} />
          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Resetting..." : "Reset Password"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => go("signIn")}>
            <ArrowLeft className="size-4" />
            Cancel
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function CodeHeader({ title, email, extra }: { title: string; email: string; extra?: string }) {
  return (
    <div className="text-center mb-6">
      <div className="mx-auto size-12 rounded-full bg-primary flex items-center justify-center mb-4">
        <Mail className="size-6 text-primary-foreground" />
      </div>
      <h2 className="font-semibold text-lg">{title}</h2>
      <p className="text-sm text-muted-foreground">We sent a 6-digit code to {email}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {JUNK_NOTE}
        {extra ? ` ${extra}` : ""}
      </p>
    </div>
  );
}

export function CodeInput({ label }: { label: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="code">{label}</Label>
      <Input
        id="code"
        name="code"
        type="text"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        placeholder="Enter code"
        autoComplete="one-time-code"
        className="h-11 text-center tracking-[0.5em] font-mono"
        required
      />
    </div>
  );
}
