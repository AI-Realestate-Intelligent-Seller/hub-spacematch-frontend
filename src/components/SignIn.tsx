import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/auth/session";
import { ApiError } from "@/lib/api";
import { ALLOWED_EMAIL_DOMAIN, authApi, authErrorMessage } from "@/lib/authApi";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { PasswordInput } from "./ui/password-input";
import { Label } from "./ui/label";

// Sign-in against the new backend (/api/v1/auth). Kept from the old Hub (Michael 2026-10-29):
// catch email typos, plain errors, and a no-email "forgot password" path via the office.
const HUB_DOMAIN = ALLOWED_EMAIL_DOMAIN; // typo helper suggests the company domain
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
  if (domain.startsWith(HUB_DOMAIN.split(".")[0] ?? HUB_DOMAIN) || lev(domain, HUB_DOMAIN) <= 3) return `${user}@${HUB_DOMAIN}`;
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

/** Email codes are valid for 10 minutes (backend: config.auth.otpExpiresInSeconds = 600). */
export const CODE_TTL_SECONDS = 600;

/** Countdown for the current code. restart() when a new code has been sent. */
export function useCodeTimer() {
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + CODE_TTL_SECONDS * 1000);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const restart = useCallback(() => {
    const t = Date.now();
    setExpiresAt(t + CODE_TTL_SECONDS * 1000);
    setNow(t);
  }, []);
  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  return { secondsLeft, expired: secondsLeft === 0, restart };
}
export type CodeTimerState = ReturnType<typeof useCodeTimer>;

export const formatCountdown = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** "This code expires in 10 minutes · 09:41" → "This code has expired. Send a new code." */
export function CodeTimer({ timer }: { timer: CodeTimerState }) {
  return timer.expired ? (
    <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert" data-testid="code-expired">
      This code has expired. Send a new code below.
    </p>
  ) : (
    <p className="mt-3 text-sm text-muted-foreground" aria-live="off" data-testid="code-timer">
      This code expires in 10 minutes ·{" "}
      <span className="font-mono font-semibold tabular-nums text-foreground">{formatCountdown(timer.secondsLeft)}</span> left
    </p>
  );
}

/** Label for a resend button: only usable once the current code has expired. */
export const resendLabel = (timer: CodeTimerState, resending: boolean) =>
  resending ? "Sending..." : timer.expired ? "Send a new code" : `New code available in ${formatCountdown(timer.secondsLeft)}`;

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
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState("");
  const timer = useCodeTimer();

  const go = (next: Step) => {
    setError("");
    setInfo("");
    // A code was just sent when we enter a code step: start its 10-minute countdown.
    if (typeof next === "object" && (next.type === "verify" || next.type === "reset-code")) timer.restart();
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
                placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
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
              <PasswordInput id="password" name="password" placeholder="••••••••" autoComplete="current-password" className="h-11" required />
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
          <CodeHeader title="Confirm your email" email={step.email} timer={timer} />
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
            <Button type="submit" className="w-full h-11" disabled={loading || timer.expired}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Verifying..." : "Verify and sign in"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={resending || loading || !timer.expired}
              onClick={async () => {
                setError("");
                setInfo("");
                setResending(true);
                try {
                  await authApi.sendCode(step.email, "email-verification");
                  setInfo("A new code is on its way.");
                  timer.restart();
                } catch (err) {
                  setError(authErrorMessage(err));
                } finally {
                  setResending(false);
                }
              }}
            >
              {resending && <Loader2 className="size-4 animate-spin" />}
              {resendLabel(timer, resending)}
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
              <Input id="email" name="email" type="email" placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className="h-11" required />
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
          <CodeHeader
            title="Check your email"
            email={step.email}
            ifRegistered
            extra={`No code? Text the office at ${OFFICE}.`}
            timer={timer}
          />
          <form
            onSubmit={async e => {
              e.preventDefault();
              setError("");
              setLoading(true);
              const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
              try {
                // Check the code now, so a typo is caught before choosing a new password.
                await authApi.checkResetCode(step.email, code);
                setError("");
                setInfo("");
                setStep({ type: "new-password", email: step.email, code });
              } catch (err) {
                setError(authErrorMessage(err, "That code is wrong or has expired. Request a new one."));
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-4"
          >
            <CodeInput label="Reset Code" />
            {info && <p className="text-sm text-muted-foreground">{info}</p>}
            <ErrorText error={error} />
            <Button type="submit" className="w-full h-11" disabled={loading || timer.expired}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Checking code..." : "Continue"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={resending || !timer.expired}
              onClick={async () => {
                setError("");
                setInfo("");
                setResending(true);
                try {
                  await authApi.requestPasswordReset(step.email);
                  setInfo("A new code is on its way.");
                  timer.restart();
                } catch (err) {
                  setError(authErrorMessage(err));
                } finally {
                  setResending(false);
                }
              }}
            >
              {resending && <Loader2 className="size-4 animate-spin" />}
              {resendLabel(timer, resending)}
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
          <h2 className="font-semibold text-lg">Create a new password</h2>
          <p className="text-sm text-muted-foreground">For {step.email} · at least 8 characters</p>
        </div>
        <form
          onSubmit={async e => {
            e.preventDefault();
            setError("");
            const form = new FormData(e.currentTarget);
            const newPassword = String(form.get("newPassword") ?? "");
            if (newPassword.length < 8) {
              setError("Your password must be at least 8 characters.");
              return;
            }
            if (newPassword !== String(form.get("confirmPassword") ?? "")) {
              setError("The two passwords don't match.");
              return;
            }
            setLoading(true);
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
            <PasswordInput id="newPassword" name="newPassword" placeholder="••••••••" minLength={8} maxLength={128} autoComplete="new-password" className="h-11" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <PasswordInput id="confirmPassword" name="confirmPassword" placeholder="••••••••" minLength={8} maxLength={128} autoComplete="new-password" className="h-11" required />
          </div>
          <ErrorText error={error} />
          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Saving..." : "Save password and sign in"}
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

export function CodeHeader({
  title,
  email,
  extra,
  timer,
  ifRegistered,
}: {
  title: string;
  email: string;
  extra?: string;
  timer?: CodeTimerState;
  /** Password reset: a code is only sent when the email has an account (we don't reveal which). */
  ifRegistered?: boolean;
}) {
  return (
    <div className="text-center mb-6">
      <div className="mx-auto size-12 rounded-full bg-primary flex items-center justify-center mb-4">
        <Mail className="size-6 text-primary-foreground" />
      </div>
      <h2 className="font-semibold text-lg">{title}</h2>
      <p className="text-sm text-muted-foreground">
        {ifRegistered ? `If ${email} has a Hub account, we've sent it a 6-digit code.` : `We sent a 6-digit code to ${email}`}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {JUNK_NOTE}
        {extra ? ` ${extra}` : ""}
      </p>
      {timer && <CodeTimer timer={timer} />}
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
