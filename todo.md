# Add agent screen (Full) — Michael 11-16, #team-app-design 1794618955.995589

- [x] schema: rosterAgents table (email, name, phone, title, lic, bio, photoUrl/photoId, folderId, status, by/at)
- [x] agentsData: SEED + mutable AGENTS/REMOVED_EMAILS + applyRoster()
- [x] convex/roster.ts: syncRoster(ctx), publicList, list (staff), add/update/remove/restore actions, photo upload url, Drive folder create
- [x] sync in functions.ts wrappers + hubViewer + raw handlers in roster-using files
- [x] auth: email-code + reset blocked for DB-removed; removal scrambles password + revokes sessions
- [x] frontend: RosterGate in App; profiles for added agents (meet page), signature photo, mailer landing photo, mailer PDF/Wise Pelican photo + lic, video folder
- [x] /team page + menu link (admins + ops)
- [x] e2e test-team-roster (add → appears in pickers/logins/meet page → remove); run existing test-signature, test-why, test-login-help unchanged
- [x] sync:build, deploy prod, Slack report with screenshots

# Agent Hub build (2026-10-17)
- [x] M1 core: HubLayout (top nav + mobile tabs), Home (search, tiles, Today, tools, team), PWA manifest/sw/icons, CMA caps (2/agent/mo, 40 team, approval)
- [x] M2 forms: 25 defs, public /f/:id?a=slug, submitForm, inbox, email agent + team@, 1h escalation, QR
- [x] M3 resources: vendors table, add vendor, preferred/hide, seed, RESPA note, vCard
- [x] e2e tests, screenshots, deploy prod, Slack update
- [ ] later: Lofty push, vendor harvest, launch portal

# Home polish + Lofty Today (2026-10-18, Michael #team-app-design 1792335372.684739)
- [ ] convex/address.ts formatAddress (title case, N/S/E/W, St/Ave/Dr, strip dup city/state/zip) → Today, Requests, submit
- [ ] hubMe identity: greet by agent name, initials avatar, shared team@ banner, admin "view as"
- [ ] Hide empty Announcements
- [ ] Tool favicons (public/tools) + Lofty, connectMLS, dotloop first
- [ ] 5 tabs (CMA folded into Home)
- [ ] Lofty Today: loftyToday table, refreshAll cron 3x/day + refresh button; new leads 72h, tasks due/overdue, appointments today, stale hot leads
- [ ] Growth Playbook /growth: checklist progress per user + team progress (admin/staff)
- [ ] Request help: helpRequests table, dialog on team cards, email person, /help list, Today items for staff
- [ ] e2e, screenshots, deploy prod, Slack

# Pay by card (Stripe) — 2026-11-10, Michael #team-app-design 1794327422.530699
- [x] convex/cardPay.ts: stripeConfig (key server-only, admin pastes in Hub) + cardPayments, Checkout Session, verify by retrieve (return page + scheduled checks, no webhook)
- [x] adapters: sellerLists (list + Mail it for me → startDrop), lob (own list → startLobSend), reelOrders (→ queued), adOrders (pay ahead → paid)
- [x] UI: PayByCard button on the 4 pay screens, /pay/return, Settings card (confirmers only: key + who pays the 3% fee)
- [x] e2e scripts/test-card-pay.ts (STRIPE_MOCK=1 on dev), sync:build, deploy prod, Slack with key steps

# Email signature easier to find — 2026-11-12, Michael DM 1794501329.524029 ("make it more noticeable I cannot find it")
- [x] Home: one-tap card "Make your email signature" (New badge) with the two existing one-tap cards
- [x] Search: "signature" → Email signature (was matching "sign" → Marketing request)
- [x] Account menu item; Marketing chip moved to 2nd with New tag; Emails page link; Home Marketing tile text
- [x] Guide entry (TOOLS_GUIDE) + muse pack version
- [x] e2e scripts/test-signature-find.ts + existing test-signature, test-ux-round, test-home-today; sync:build; deploy; Slack

# Findability round 2 — 2026-11-22, Michael DM 1795360151.449479 ("I like it", "all tools button + categorized", "All of it")
- [x] src/lib/catalog.ts (CATALOG groups, MOMENTS, My tools localStorage), /tools ToolsPage, /do/:id MomentPage, routes, avatar All tools, search intents
- [x] Home: Today first → moments → My tools + All tools + Get help → New this week (closable) → Desk/News → Your apps (removed 3 promo cards + more-areas)
- [ ] Readability CSS: min small text ~16px, stone-400/500 text darker
- [ ] Update tests test-ux-round, test-signature-find, test-seller-lists-buildings (act-mail); new test-findability.ts
- [ ] sync:build, screenshots, deploy, Slack
# Market myself, per agent (round 3, "All of it")
- [ ] Google review requests (agent review link, fallback team GBP, no gating, /r/:token, counts)
- [ ] Business card (QR → Why link, vCard)
- [ ] Open house calendar (slots on team listings, claim)
- [ ] Past-client touch plan (agent's clients, anniversaries, due this month)
- [ ] Monthly post ideas (static, agent's area)
- [ ] Market update kit (agent enters 4 MLS numbers → script + caption; no estimates)
