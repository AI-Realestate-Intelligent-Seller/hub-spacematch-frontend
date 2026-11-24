import { Navigate, Route, Routes } from "react-router";
import { OAUTH_CALLBACK_PATH } from "@/auth/oauthReturn";
import { SpaceSession } from "@/auth/SpaceSession";
import { RosterGate } from "@/components/RosterGate";
import { TeamRosterPage } from "@/pages/TeamRosterPage";
import { AppLayout } from "@/components/AppLayout";
import { GrowthPage } from "@/pages/GrowthPage";
import { HelpPage } from "@/pages/HelpPage";
import { FeedbackPage } from "@/pages/FeedbackPage";
import { GuidePage } from "@/pages/GuidePage";
import { MusePage } from "@/pages/MusePage";
import { ReelStudioPage } from "@/pages/ReelStudioPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicLayout } from "@/components/PublicLayout";
import { PublicOnlyRoute } from "@/components/PublicOnlyRoute";
import { LandingPage, LoginPage, SettingsPage, SignupPage } from "@/pages";
import { LeaseRequestPage } from "@/pages/LeaseRequestPage";
import { NewRequestPage } from "@/pages/NewRequestPage";
import { TemplatesPage } from "@/pages/TemplatesPage";
import { TrainingPage } from "@/pages/TrainingPage";
import { PresentationsPage } from "@/pages/PresentationsPage";
import { PlaybooksPage } from "@/pages/PlaybooksPage";
import { AnnouncementsPage } from "@/pages/AnnouncementsPage";
import { RequestsPage } from "@/pages/RequestsPage";
import { ViktorOAuthCallbackPage } from "@/pages/ViktorOAuthCallbackPage";
import { SessionProvider, SIGNED_IN_HOME, useSession } from "@/auth/session";
import { HomePage } from "@/pages/HomePage";
import { FormsPage } from "@/pages/FormsPage";
import { ToolsPage } from "@/pages/ToolsPage";
import { MomentPage } from "@/pages/MomentPage";
import { ReviewsPage } from "@/pages/ReviewsPage";
import { ReviewLandingPage } from "@/pages/ReviewLandingPage";
import { BusinessCardPage } from "@/pages/BusinessCardPage";
import { PublicCardPage } from "@/pages/PublicCardPage";
import { OpenHousesPage } from "@/pages/OpenHousesPage";
import { PastClientsPage } from "@/pages/PastClientsPage";
import { PostIdeasPage } from "@/pages/PostIdeasPage";
import { MarketUpdatePage } from "@/pages/MarketUpdatePage";
import { InboxPage } from "@/pages/InboxPage";
import { PublicFormPage } from "@/pages/PublicFormPage";
import { CommissionRentalsPage } from "@/pages/CommissionRentalsPage";
import { ResourcesPage } from "@/pages/ResourcesPage";
import { ListingsPage } from "@/pages/ListingsPage";
import { ListingDetailPage } from "@/pages/ListingDetailPage";
import { ListingPlanPage } from "@/pages/ListingPlanPage";
import { AdOrdersPage } from "@/pages/AdOrdersPage";
import { AdoptionPage } from "@/pages/AdoptionPage";
import { AgentLoginsPage } from "@/pages/AgentLoginsPage";
import { BrollPage } from "@/pages/BrollPage";
import { AgentVideosPage } from "@/pages/AgentVideosPage";
import { SellerPortalPage } from "@/pages/SellerPortalPage";
import { DemoSellerPage } from "@/pages/DemoSellerPage";
import { MailersPage } from "@/pages/MailersPage";
import { PayReturnPage } from "@/pages/PayReturnPage";
import { SellerListsPage } from "@/pages/SellerListsPage";
import { MailerLandingPage } from "@/pages/MailerLandingPage";
import { WhyPage } from "@/pages/WhyPage";
import { WhyToolPage } from "@/pages/WhyToolPage";
import { DeskPage } from "@/pages/DeskPage";
import { NewLeadsPage } from "@/pages/NewLeadsPage";
import { AppointmentsPage } from "@/pages/AppointmentsPage";
import { AgentApptPage } from "@/pages/AgentApptPage";
import { EmailsPage } from "@/pages/EmailsPage";
import { NetSheetPage } from "@/pages/NetSheetPage";
import { SignaturePage } from "@/pages/SignaturePage";

function RootRoute() {
  const { isAuthenticated, isLoading } = useSession();
  if (!isLoading && isAuthenticated) return <Navigate to={SIGNED_IN_HOME} replace />;
  return <LandingPage />;
}

export function AuthenticatedRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<RootRoute />} />
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>
      </Route>

      {/* Return leg of "Sign in with Viktor" — outside the auth guards
          because it owns the loading/outcome handling itself. */}
      {/* Client-facing forms: no login */}
      <Route path="/f/:formId" element={<PublicFormPage />} />
      {/* Seller Launch Portal: private token link, no login */}
      <Route path="/s/:token" element={<SellerPortalPage />} />
      <Route path="/demo/seller" element={<DemoSellerPage />} />
      {/* Seller mailer QR codes: public, no login */}
      <Route path="/v/:code" element={<MailerLandingPage />} />
      <Route path="/m/:slug" element={<WhyPage />} />
      {/* Market myself (11-22): client review page + digital business card, no login */}
      <Route path="/r/:token" element={<ReviewLandingPage />} />
      <Route path="/c/:slug" element={<PublicCardPage />} />
      {/* Lead Desk one-tap link for the booked agent (token, no login) */}
      <Route path="/a/:token" element={<AgentApptPage />} />

      <Route path={OAUTH_CALLBACK_PATH} element={<ViktorOAuthCallbackPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/do/:id" element={<MomentPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/card" element={<BusinessCardPage />} />
          <Route path="/open-houses" element={<OpenHousesPage />} />
          <Route path="/past-clients" element={<PastClientsPage />} />
          <Route path="/post-ideas" element={<PostIdeasPage />} />
          <Route path="/market-update" element={<MarketUpdatePage />} />
          <Route path="/why" element={<WhyToolPage />} />
          <Route path="/desk" element={<DeskPage />} />
          <Route path="/new-leads" element={<NewLeadsPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/forms" element={<FormsPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/commission-rentals" element={<CommissionRentalsPage />} />
          <Route path="/listings" element={<ListingsPage />} />
          <Route path="/listings/:id" element={<ListingDetailPage />} />
          <Route path="/listings/:id/plan" element={<ListingPlanPage />} />
          <Route path="/ad-orders" element={<AdOrdersPage />} />
          <Route path="/adoption" element={<AdoptionPage />} />
          <Route path="/logins" element={<AgentLoginsPage />} />
          <Route path="/team" element={<TeamRosterPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/broll" element={<BrollPage />} />
          <Route path="/my-videos" element={<AgentVideosPage />} />
          <Route path="/reels" element={<ReelStudioPage />} />
          <Route path="/mailers" element={<MailersPage />} />
          <Route path="/seller-lists" element={<SellerListsPage />} />
          <Route path="/emails" element={<EmailsPage />} />
          <Route path="/net-sheet" element={<NetSheetPage />} />
          <Route path="/signature" element={<SignaturePage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/presentations" element={<PresentationsPage />} />
          <Route path="/playbooks" element={<PlaybooksPage />} />
          <Route path="/growth" element={<GrowthPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/muse" element={<MusePage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/announce" element={<AnnouncementsPage />} />
          <Route path="/playbooks/:id" element={<PlaybooksPage />} />
          <Route path="/new" element={<NewRequestPage />} />
          <Route path="/lease" element={<LeaseRequestPage />} />
          <Route path="/lease/:id/edit" element={<LeaseRequestPage />} />
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/requests/:id/edit" element={<NewRequestPage />} />
          <Route path="/pay/return" element={<PayReturnPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function AuthenticatedAppRoutes() {
  return (
    <SessionProvider>
      <SpaceSession>
        <RosterGate>
          <AuthenticatedRoutes />
        </RosterGate>
      </SpaceSession>
    </SessionProvider>
  );
}
