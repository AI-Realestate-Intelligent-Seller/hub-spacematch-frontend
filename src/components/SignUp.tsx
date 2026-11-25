import { ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/auth/session";
import { ALLOWED_EMAIL_DOMAIN, authApi, authErrorMessage, isAllowedSignupEmail } from "@/lib/authApi";
import { CodeHeader, CodeInput, resendLabel, useCodeTimer } from "./SignIn";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { PasswordInput } from "./ui/password-input";
import { Label } from "./ui/label";

// Sign-up against the new backend: create account → 6-digit email code → signed in.
// Only @linchpin.net emails (ALLOWED_EMAIL_DOMAIN) can sign up; the backend enforces it too.
type Step = "signUp" | { email: string; password: string };

export function SignUp() {
  const { refresh } = useSession();
  const [step, setStep] = useState<Step>("signUp");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const timer = useCodeTimer();

  if (step === "signUp") {
    return (
      <Card variant="elevated">
        <CardContent className="pt-6">
          <form
            onSubmit={async e => {
              e.preventDefault();
              setError("");
              const form = new FormData(e.currentTarget);
              const name = String(form.get("name") ?? "");
              const email = String(form.get("email") ?? "").trim().toLowerCase();
              const password = String(form.get("password") ?? "");
              if (!isAllowedSignupEmail(email)) {
                setError(`Only @${ALLOWED_EMAIL_DOMAIN} email addresses can sign up.`);
                return;
              }
              setLoading(true);
              try {
                await authApi.signUp(name, email, password);
                timer.restart(); // code just sent: start the 10-minute countdown
                setStep({ email, password });
              } catch (err) {
                setError(authErrorMessage(err, "Could not create account. Please try again."));
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" type="text" placeholder="Your name" autoComplete="name" className="h-11" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`} autoComplete="email" className="h-11" required />
              <p className="text-xs text-muted-foreground">Use your @{ALLOWED_EMAIL_DOMAIN} work email</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput id="password" name="password" placeholder="••••••••" minLength={8} maxLength={128} autoComplete="new-password" className="h-11" required />
              <p className="text-xs text-muted-foreground">At least 8 characters</p>
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated">
      <CardContent className="pt-6">
        <CodeHeader title="Check your email" email={step.email} timer={timer} />
        <form
          onSubmit={async e => {
            e.preventDefault();
            setError("");
            setLoading(true);
            const code = String(new FormData(e.currentTarget).get("code") ?? "");
            try {
              await authApi.verifyEmail(step.email, code);
              await authApi.signIn(step.email, step.password);
              await refresh(); // PublicOnlyRoute then moves the user on
            } catch (err) {
              setError(authErrorMessage(err, "Invalid or expired code. Please try again."));
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <CodeInput label="Verification Code" />
          {info && <p className="text-sm text-muted-foreground">{info}</p>}
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
          <Button type="submit" className="w-full h-11" disabled={loading || timer.expired}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Verifying..." : "Verify Email"}
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
          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("signUp")}>
            <ArrowLeft className="size-4" />
            Back to sign up
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
