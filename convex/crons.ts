import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Seller Launch Portal (UTC: 14:00 ≈ 9am CT, 15:00 ≈ 10am CT, 22:00 ≈ 5pm CT).
crons.interval("showingtime scan", { hours: 2 }, internal.showingtime.scan, {});
crons.weekly("monday numbers reminder", { dayOfWeek: "monday", hourUTC: 14, minuteUTC: 0 }, internal.listingMail.mondayReminders, {});
crons.weekly("tuesday ops nudge", { dayOfWeek: "tuesday", hourUTC: 15, minuteUTC: 0 }, internal.listingMail.tuesdayNudge, {});
crons.weekly("seller weekly report", { dayOfWeek: "monday", hourUTC: 22, minuteUTC: 0 }, internal.listingMail.sellerWeekly, {});

// Lofty "Today" per agent: ~6am, 11am, 4pm Chicago (CDT).
crons.daily("lofty today 6am", { hourUTC: 11, minuteUTC: 0 }, internal.hubToday.refreshAll, {});
crons.daily("lofty today 11am", { hourUTC: 16, minuteUTC: 0 }, internal.hubToday.refreshAll, {});
crons.daily("lofty today 4pm", { hourUTC: 21, minuteUTC: 0 }, internal.hubToday.refreshAll, {});

// Listing web pages (Google Analytics) for "Your ad campaigns": ~7am and 5pm Chicago.
crons.daily("listing web 7am", { hourUTC: 12, minuteUTC: 10 }, internal.listingAds.refreshAllWeb, {});
crons.daily("listing web 5pm", { hourUTC: 22, minuteUTC: 10 }, internal.listingAds.refreshAllWeb, {});

// Seller page numbers without typing: Zillow daily report emails (arrive ~7am CT)
// and Instagram Reel views. ~8:30am and 1:30pm CT; Reels again ~6:45pm CT.
crons.daily("zillow reports 830am", { hourUTC: 13, minuteUTC: 30 }, internal.zillow.scan, {});
crons.daily("zillow reports 130pm", { hourUTC: 18, minuteUTC: 30 }, internal.zillow.scan, {});
crons.daily("reel views 845am", { hourUTC: 13, minuteUTC: 45 }, internal.reels.refresh, {});
crons.daily("reel views 645pm", { hourUTC: 23, minuteUTC: 45 }, internal.reels.refresh, {});
// YouTube Short views (@spacematchinc uploads): ~8:50am and 6:50pm CT.
crons.daily("youtube views 850am", { hourUTC: 13, minuteUTC: 50 }, internal.youtube.refresh, {});
crons.daily("youtube views 650pm", { hourUTC: 23, minuteUTC: 50 }, internal.youtube.refresh, {});

// Meta Ads + Google Ads campaign numbers on the listing ad cards (~8:20am, 5:20pm CT).
crons.daily("paid ads 820am", { hourUTC: 13, minuteUTC: 20 }, internal.paidAds.refresh, {});
crons.daily("paid ads 520pm", { hourUTC: 22, minuteUTC: 20 }, internal.paidAds.refresh, {});

// Hub adoption scoreboard → Michael, Mondays ~8:30am CDT / 7:30am CST (last full week).
crons.weekly("adoption monday email", { dayOfWeek: "monday", hourUTC: 13, minuteUTC: 30 }, internal.adoption.mondayEmail, {});

// Lead Desk: 30-min unanswered alerts, client reminder texts, "how did it go?" asks.
crons.interval("lead desk tick", { minutes: 10 }, internal.desk.tick, {});
// Lead Desk intake: Peak Presence YouTube lead + booking emails in team@ → "To vet".
crons.interval("lead desk intake", { minutes: 5 }, internal.deskActions.scanIntake, {});
// New Leads tracker (Michael 2026-11-08): new Lofty leads + texts/calls/replies, every 5 min.
crons.interval("new leads sync", { minutes: 5 }, internal.leadTrackActions.sync, {});

// Growth Scores: re-check every agent Mondays ~6am CT; ranking email to Michael on the first Monday ~9am CT.
crons.weekly("growth scores check", { dayOfWeek: "monday", hourUTC: 12, minuteUTC: 0 }, internal.growthScore.checkAll, {});
crons.weekly("growth scores email", { dayOfWeek: "monday", hourUTC: 15, minuteUTC: 0 }, internal.growthScore.monthlyEmail, {});

// Reel Studio phone uploads never ordered: free the storage after 30 days (~4am CT).
crons.daily("reel uploads cleanup", { hourUTC: 10, minuteUTC: 0 }, internal.reelOrders.cleanupClipUploads, {});

export default crons;
