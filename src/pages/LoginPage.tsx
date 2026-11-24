import { Link } from "react-router";
import { SignIn } from "@/components/SignIn";

// Signs in through the new backend (/api/v1/auth). Viktor one-click sign-in is gone with Viktor.
export function LoginPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 size-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto mb-2 flex h-16 w-full max-w-[220px] items-center justify-center rounded-2xl bg-[#0A0A0A] px-6">
            <img src="/logo-white.png" alt="SpaceMatch" className="h-7" />
          </div>
          <h1 className="font-['Playfair_Display'] text-3xl font-bold tracking-tight">Agent Hub</h1>
          <p className="text-muted-foreground text-[15px]">
            Sign in with your @spacematchinc.com email. You'll stay signed in on this phone.
          </p>
        </div>

        <SignIn />

        <p className="text-center text-sm text-muted-foreground" data-testid="new-agent-note">
          New to the team? Cris sets up your login. Text the office at (773) 985-7153.
          <br />
          <Link to="/signup" className="text-xs underline-offset-2 hover:underline">
            Create my own account instead
          </Link>
        </p>
      </div>
    </div>
  );
}
