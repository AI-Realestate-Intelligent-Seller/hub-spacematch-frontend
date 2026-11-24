import { Link } from "react-router";
import { SignUp } from "@/components/SignUp";
import { Button } from "@/components/ui/button";

// Creates an account on the new backend. Allowed: @spacematchinc.com emails, or invited people.
export function SignupPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 right-1/4 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 size-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto mb-2 flex h-16 w-full max-w-[220px] items-center justify-center rounded-2xl bg-[#0A0A0A] px-6">
            <img src="/logo-white.png" alt="SpaceMatch" className="h-7" />
          </div>
          <h1 className="font-['Playfair_Display'] text-3xl font-bold tracking-tight">Create your Hub login</h1>
          <p className="text-muted-foreground text-[15px]">
            Use your @spacematchinc.com email. Invited guests use the email they were invited with.
          </p>
        </div>

        <SignUp />

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Button variant="link" className="p-0 h-auto font-medium" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </p>
      </div>
    </div>
  );
}
