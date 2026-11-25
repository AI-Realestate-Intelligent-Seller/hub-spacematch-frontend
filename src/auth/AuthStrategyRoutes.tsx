import { lazy, Suspense } from "react";
import { ViktorEmbedBridge } from "@/components/ViktorEmbedBridge";
import { Skeleton } from "@/components/hub/FormState";
import {
  useViktorSpaceAccess,
  ViktorSpaceAccessProvider,
} from "@/lib/viktor-spaces-access/ViktorSpaceAccessProvider";

const PublicAppRoutes = lazy(() =>
  import("./public/PublicAppRoutes").then(module => ({
    default: module.PublicAppRoutes,
  })),
);
const AuthenticatedAppRoutes = lazy(() =>
  import("./authenticated/AuthenticatedAppRoutes").then(module => ({
    default: module.AuthenticatedAppRoutes,
  })),
);

export function AuthStrategyRoutes() {
  return (
    <ViktorSpaceAccessProvider>
      {/* Inside the router, outside the app's own routes: the dashboard's
          embed bridge must report the very first route, whichever it is. */}
      <ViktorEmbedBridge />
      <AuthStrategyRoutesInner />
    </ViktorSpaceAccessProvider>
  );
}

function AuthStrategyRoutesInner() {
  const { authEnabled } = useViktorSpaceAccess();

  const routes = authEnabled ? <AuthenticatedAppRoutes /> : <PublicAppRoutes />;

  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-4 py-8"><Skeleton label="Loading the Hub" /></main>}>
      {routes}
    </Suspense>
  );
}
