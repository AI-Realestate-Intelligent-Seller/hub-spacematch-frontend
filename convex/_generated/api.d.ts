/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ViktorSpacesEmail from "../ViktorSpacesEmail.js";
import type * as adKit from "../adKit.js";
import type * as adOrders from "../adOrders.js";
import type * as address from "../address.js";
import type * as adminAccounts from "../adminAccounts.js";
import type * as adoption from "../adoption.js";
import type * as agentCopy from "../agentCopy.js";
import type * as agentVideoFolders from "../agentVideoFolders.js";
import type * as agentVideos from "../agentVideos.js";
import type * as agentsData from "../agentsData.js";
import type * as announcements from "../announcements.js";
import type * as auth from "../auth.js";
import type * as broll from "../broll.js";
import type * as cardDefs from "../cardDefs.js";
import type * as cardPay from "../cardPay.js";
import type * as cardPayE2e from "../cardPayE2e.js";
import type * as cma from "../cma.js";
import type * as cmaWorker from "../cmaWorker.js";
import type * as commissionBuildings from "../commissionBuildings.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as desk from "../desk.js";
import type * as deskActions from "../deskActions.js";
import type * as deskDefs from "../deskDefs.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as feedback from "../feedback.js";
import type * as feedbackDefs from "../feedbackDefs.js";
import type * as formDefs from "../formDefs.js";
import type * as forms from "../forms.js";
import type * as fub from "../fub.js";
import type * as functions from "../functions.js";
import type * as gateway from "../gateway.js";
import type * as growth from "../growth.js";
import type * as growthDefs from "../growthDefs.js";
import type * as growthScore from "../growthScore.js";
import type * as growthScoreDefs from "../growthScoreDefs.js";
import type * as help from "../help.js";
import type * as helpDue from "../helpDue.js";
import type * as http from "../http.js";
import type * as hubAdminOps from "../hubAdminOps.js";
import type * as hubLogins from "../hubLogins.js";
import type * as hubMe from "../hubMe.js";
import type * as hubStats from "../hubStats.js";
import type * as hubStatsAcct from "../hubStatsAcct.js";
import type * as hubToday from "../hubToday.js";
import type * as launchSteps from "../launchSteps.js";
import type * as leadTrack from "../leadTrack.js";
import type * as leadTrackActions from "../leadTrackActions.js";
import type * as leadTrackDefs from "../leadTrackDefs.js";
import type * as listingAds from "../listingAds.js";
import type * as listingMail from "../listingMail.js";
import type * as listingPlans from "../listingPlans.js";
import type * as listings from "../listings.js";
import type * as lob from "../lob.js";
import type * as lobDefs from "../lobDefs.js";
import type * as lobSend from "../lobSend.js";
import type * as lofty from "../lofty.js";
import type * as loginHelp from "../loginHelp.js";
import type * as mailOrders from "../mailOrders.js";
import type * as mailers from "../mailers.js";
import type * as marketDefs from "../marketDefs.js";
import type * as marketMe from "../marketMe.js";
import type * as notify from "../notify.js";
import type * as officeDefs from "../officeDefs.js";
import type * as paidAds from "../paidAds.js";
import type * as phiConsoleStatics from "../phiConsoleStatics.js";
import type * as phiLogging from "../phiLogging.js";
import type * as pricingReview from "../pricingReview.js";
import type * as proIntro from "../proIntro.js";
import type * as push from "../push.js";
import type * as reelDefs from "../reelDefs.js";
import type * as reelOrders from "../reelOrders.js";
import type * as reels from "../reels.js";
import type * as roster from "../roster.js";
import type * as rosterRows from "../rosterRows.js";
import type * as rosterSync from "../rosterSync.js";
import type * as sellerLists from "../sellerLists.js";
import type * as showingtime from "../showingtime.js";
import type * as showingtimeParse from "../showingtimeParse.js";
import type * as spaceSessionAuth from "../spaceSessionAuth.js";
import type * as suggestions from "../suggestions.js";
import type * as toolSetup from "../toolSetup.js";
import type * as training from "../training.js";
import type * as trainingDefs from "../trainingDefs.js";
import type * as trainingFiles from "../trainingFiles.js";
import type * as users from "../users.js";
import type * as vendors from "../vendors.js";
import type * as viktorEdgeHandoffAuth from "../viktorEdgeHandoffAuth.js";
import type * as viktorMembership from "../viktorMembership.js";
import type * as viktorSpaceAuthConfig from "../viktorSpaceAuthConfig.js";
import type * as viktorSpaceAuthEnv from "../viktorSpaceAuthEnv.js";
import type * as viktorSpeech from "../viktorSpeech.js";
import type * as viktorSpeechErrors from "../viktorSpeechErrors.js";
import type * as viktorTools from "../viktorTools.js";
import type * as voiceFill from "../voiceFill.js";
import type * as whyDefs from "../whyDefs.js";
import type * as whyLinks from "../whyLinks.js";
import type * as youtube from "../youtube.js";
import type * as zillow from "../zillow.js";
import type * as zillowParse from "../zillowParse.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ViktorSpacesEmail: typeof ViktorSpacesEmail;
  adKit: typeof adKit;
  adOrders: typeof adOrders;
  address: typeof address;
  adminAccounts: typeof adminAccounts;
  adoption: typeof adoption;
  agentCopy: typeof agentCopy;
  agentVideoFolders: typeof agentVideoFolders;
  agentVideos: typeof agentVideos;
  agentsData: typeof agentsData;
  announcements: typeof announcements;
  auth: typeof auth;
  broll: typeof broll;
  cardDefs: typeof cardDefs;
  cardPay: typeof cardPay;
  cardPayE2e: typeof cardPayE2e;
  cma: typeof cma;
  cmaWorker: typeof cmaWorker;
  commissionBuildings: typeof commissionBuildings;
  constants: typeof constants;
  crons: typeof crons;
  desk: typeof desk;
  deskActions: typeof deskActions;
  deskDefs: typeof deskDefs;
  emailTemplates: typeof emailTemplates;
  feedback: typeof feedback;
  feedbackDefs: typeof feedbackDefs;
  formDefs: typeof formDefs;
  forms: typeof forms;
  fub: typeof fub;
  functions: typeof functions;
  gateway: typeof gateway;
  growth: typeof growth;
  growthDefs: typeof growthDefs;
  growthScore: typeof growthScore;
  growthScoreDefs: typeof growthScoreDefs;
  help: typeof help;
  helpDue: typeof helpDue;
  http: typeof http;
  hubAdminOps: typeof hubAdminOps;
  hubLogins: typeof hubLogins;
  hubMe: typeof hubMe;
  hubStats: typeof hubStats;
  hubStatsAcct: typeof hubStatsAcct;
  hubToday: typeof hubToday;
  launchSteps: typeof launchSteps;
  leadTrack: typeof leadTrack;
  leadTrackActions: typeof leadTrackActions;
  leadTrackDefs: typeof leadTrackDefs;
  listingAds: typeof listingAds;
  listingMail: typeof listingMail;
  listingPlans: typeof listingPlans;
  listings: typeof listings;
  lob: typeof lob;
  lobDefs: typeof lobDefs;
  lobSend: typeof lobSend;
  lofty: typeof lofty;
  loginHelp: typeof loginHelp;
  mailOrders: typeof mailOrders;
  mailers: typeof mailers;
  marketDefs: typeof marketDefs;
  marketMe: typeof marketMe;
  notify: typeof notify;
  officeDefs: typeof officeDefs;
  paidAds: typeof paidAds;
  phiConsoleStatics: typeof phiConsoleStatics;
  phiLogging: typeof phiLogging;
  pricingReview: typeof pricingReview;
  proIntro: typeof proIntro;
  push: typeof push;
  reelDefs: typeof reelDefs;
  reelOrders: typeof reelOrders;
  reels: typeof reels;
  roster: typeof roster;
  rosterRows: typeof rosterRows;
  rosterSync: typeof rosterSync;
  sellerLists: typeof sellerLists;
  showingtime: typeof showingtime;
  showingtimeParse: typeof showingtimeParse;
  spaceSessionAuth: typeof spaceSessionAuth;
  suggestions: typeof suggestions;
  toolSetup: typeof toolSetup;
  training: typeof training;
  trainingDefs: typeof trainingDefs;
  trainingFiles: typeof trainingFiles;
  users: typeof users;
  vendors: typeof vendors;
  viktorEdgeHandoffAuth: typeof viktorEdgeHandoffAuth;
  viktorMembership: typeof viktorMembership;
  viktorSpaceAuthConfig: typeof viktorSpaceAuthConfig;
  viktorSpaceAuthEnv: typeof viktorSpaceAuthEnv;
  viktorSpeech: typeof viktorSpeech;
  viktorSpeechErrors: typeof viktorSpeechErrors;
  viktorTools: typeof viktorTools;
  voiceFill: typeof voiceFill;
  whyDefs: typeof whyDefs;
  whyLinks: typeof whyLinks;
  youtube: typeof youtube;
  zillow: typeof zillow;
  zillowParse: typeof zillowParse;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
