// Done-for-you email library (Michael 2026-10-31, from his talk with Angel). One kickoff email to
// everyone (replies sort people into groups), then a short series per group. Written to sound like
// an agent, not a brand: short lines, no buzzwords, no market stats we can't back up.
// Fields in {braces} get filled by the Hub, or turned into Lofty merge fields on "Copy for Lofty".
// The sign-off is added by the Hub (agent name, phone, team line), or becomes #signature# in Lofty.

export type LibEmail = { id: string; step: string; subject: string; body: string };
export type Segment = {
  id: string;
  label: string;
  who: string;
  cadence: string;
  lofty: string; // suggested Lofty tag / Smart Plan name
  emails: LibEmail[];
};

export const FIELDS: { key: string; label: string; lofty: string; sample: string }[] = [
  { key: "first_name", label: "Client first name", lofty: "#lead_first_name#", sample: "Jordan" },
  // Only Lofty merge fields we've confirmed (#lead_first_name#, #agent_name#, #signature#) are mapped.
  // The rest get the copying agent's own values.
  { key: "agent_first", label: "Your first name", lofty: "", sample: "Angel" },
  { key: "agent_name", label: "Your full name", lofty: "#agent_name#", sample: "Angel Zhang" },
  { key: "agent_phone", label: "Your phone", lofty: "", sample: "(312) 479-2800" },
  { key: "neighborhood", label: "Neighborhood", lofty: "", sample: "Lakeview" },
];

const e = (id: string, step: string, subject: string, body: string): LibEmail => ({ id, step, subject, body: body.trim() });

export const SEGMENTS: Segment[] = [
  {
    id: "kickoff",
    label: "Everyone (send first)",
    who: "Your whole database, once. Their reply tells you which group they belong in.",
    cadence: "Once",
    lofty: "SM Kickoff",
    emails: [
      e("kickoff-1", "Send once", "Quick question, {first_name}", `
Hi {first_name},

I'm cleaning up my list so I only send you things that actually help. Quick question: where are you at with real estate right now?

1. Thinking about buying in the next few months
2. Maybe buying in the next year or two
3. Thinking about selling
4. Renting and happy for now
5. Just keep me posted on the market

Just reply with a number. If something else is going on, tell me that instead. I read every reply myself.`),
    ],
  },
  {
    id: "renters",
    label: "Renters who could buy",
    who: "Renters you've helped or met who might buy in the next couple of years.",
    cadence: "Every 3 months",
    lofty: "SM Renters",
    emails: [
      e("renters-1", "Email 1", "What your rent could buy", `
Hi {first_name},

Most renters I talk to have never seen their rent next to a mortgage payment. Fair enough, nobody shows you.

So here's the offer: tell me what you pay now and what you could stretch to each month, even $300 or $500 more. I'll send back what that buys in {neighborhood}, the full monthly breakdown (taxes, HOA, all of it), and what it looks like in 5 and 10 years if you sold.

No pressure and no lender calls. Just the numbers, so you know where you stand.`),
      e("renters-2", "Email 2", "The lease renewal question", `
Hi {first_name},

When your renewal shows up, most people just sign it. Before you do, it's worth 10 minutes to compare.

Three things decide whether buying makes sense for you: how long you'd stay (5 years is the usual line), what you have saved for a down payment, and what you'd pay each month compared to rent.

A lot of first-time buyers put down less than they think. There are 3% and 3.5% down loans and some Illinois down payment help programs, depending on income.

If your lease is up in the next 6 months, reply "lease" and I'll run your numbers before you sign anything.`),
      e("renters-3", "Email 3", "Where your rent goes after 5 years", `
Hi {first_name},

Here's the math nobody does on rent.

At $2,500 a month, five years of rent is $150,000, and that's before any increases. When you move out, you get your deposit back and that's it.

When you own, part of every payment pays down your loan. When you sell, that part comes back to you, along with any rise in value, minus selling costs.

It doesn't always win. Five years is about the break-even, and it depends on the place and the rate. That's exactly why I like to show people their own numbers instead of a sales pitch. Want me to run yours?`),
      e("renters-4", "Email 4", "Still renting?", `
Hi {first_name},

Checking in. Are you still renting, or did anything change?

If buying is still a "someday" thing, here's one easy step for this year: get a free pre-approval check with a lender I trust. It doesn't commit you to anything, and it tells you your real number instead of guessing.

Reply "intro" and I'll connect you. And if you'd rather I stop sending these, just say so. No hard feelings.`),
    ],
  },
  {
    id: "buyers-0-3",
    label: "Buyers, 0–3 months",
    who: "Ready now or very soon. They need a call, not a newsletter. These back up your calls.",
    cadence: "Every 2 weeks",
    lofty: "SM Buyers 0-3",
    emails: [
      e("b03-1", "Email 1", "Your next 3 steps", `
Hi {first_name},

Great talking with you. Here's how we get you into a home without surprises:

1. Pre-approval. A real one, not an online estimate. I can connect you with a lender I trust today.
2. Your must-haves. Location, beds, parking, budget. I'll set up a search so you see new listings the day they hit.
3. Tours. We'll see a few places together so you get a feel for what your budget buys.

Reply with the best days for showings this week and I'll line them up.`),
      e("b03-2", "Email 2", "What to expect at closing", `
Hi {first_name},

Quick heads-up on the money side so nothing catches you off guard.

Besides your down payment, plan for closing costs of about 2–3% of the price. In Chicago that includes the city transfer tax the buyer pays ($3.75 per $500 of price). Your lender's Loan Estimate will spell it out line by line.

Sometimes we can ask the seller to cover part of it with a credit. That depends on the home and the market, and I'll tell you honestly when it's realistic.

Any questions, call me. That's what I'm here for.`),
      e("b03-3", "Email 3", "How we win the one you love", `
Hi {first_name},

When the right place comes up, it can move fast. Here's what makes an offer stronger without overpaying:

- A clean pre-approval letter, ready to go
- A quick attorney review and inspection timeline
- Flexibility on the seller's closing date
- Knowing the comps, so we're not guessing on price

I'll pull the recent sales for any home you like before we write. Send me anything that catches your eye, even if it's a little over budget.`),
      e("b03-4", "Email 4", "Still looking?", `
Hi {first_name},

Checking in on your search. Have you seen anything you liked, or has your timing changed?

If you want, I can widen the search a bit, add a neighborhood, or look at homes that have been sitting where the seller might take less. Reply and let me know what's working and what isn't.`),
    ],
  },
  {
    id: "buyers-3-6",
    label: "Buyers, 3–6 months",
    who: "Planning to buy soon but not touring yet.",
    cadence: "Every month",
    lofty: "SM Buyers 3-6",
    emails: [
      e("b36-1", "Email 1", "Getting ready to buy", `
Hi {first_name},

Three to six months out is the perfect time to get ready, because the prep is what makes the search easy later.

The one thing I'd do now: talk to a lender. Not to apply, just to see your number and if anything in your credit needs fixing. Small things, like paying down a card, can move your rate.

Want an intro to someone I trust? Just reply "lender."`),
      e("b36-2", "Email 2", "What your budget buys in {neighborhood}", `
Hi {first_name},

I'd love to show you what's actually selling in {neighborhood} in your price range. Not the listing photos, the real sale prices and how fast they went.

It's the best way to set expectations before you fall for something. Reply with your budget and I'll send a short list of recent sales.`),
      e("b36-3", "Email 3", "Your down payment options", `
Hi {first_name},

A lot of buyers think they need 20% down. Most don't.

Conventional loans can go as low as 3% down for first-time buyers, FHA is 3.5%, and VA loans can be 0% for veterans. Illinois also has down payment help through IHDA if you qualify on income.

Less down means a bigger monthly payment and usually mortgage insurance, so it's a trade-off. I'll walk you through it with real numbers whenever you're ready.`),
      e("b36-4", "Email 4", "Ready to start touring?", `
Hi {first_name},

You mentioned buying in the next few months. Is that still the plan?

If so, let's set up a search with your must-haves so new listings come to you the day they hit. And when you're ready, we'll go see a few to get your eyes calibrated. Reply "start" and I'll set it up.`),
    ],
  },
  {
    id: "buyers-6-12",
    label: "Buyers, 6–12 months",
    who: "Buying sometime in the next year.",
    cadence: "Every 3 months",
    lofty: "SM Buyers 6-12",
    emails: [
      e("b612-1", "Email 1", "A year out? Here's the plan", `
Hi {first_name},

If you're buying in the next year, here's a simple plan:

Now: check your credit and talk to a lender once, so you know your number.
3–6 months out: decide on neighborhoods and must-haves.
2–3 months out: start touring.

Each step is easy if you do it in order. Want me to send a lender intro so you can knock out step one?`),
      e("b612-2", "Email 2", "Saving for a down payment", `
Hi {first_name},

If you're saving up to buy, two things help more than people expect:

1. Keep the money somewhere easy to document. Lenders want to see where it came from, so big cash deposits right before you buy can slow things down.
2. Gift money from family is allowed on most loans. It just needs a simple gift letter.

Questions on either? Reply and I'll get you an answer.`),
      e("b612-3", "Email 3", "What rent vs. buying looks like for you", `
Hi {first_name},

Want to see your rent next to a mortgage payment, with real numbers?

Tell me your rent and what you'd be comfortable paying each month. I'll send back what that buys, the monthly breakdown, and what you'd walk away with in 5 and 10 years compared to renting. It takes me a few minutes and it's a lot more useful than a mortgage calculator.`),
      e("b612-4", "Email 4", "Still planning to buy?", `
Hi {first_name},

Quick check-in. Is buying still on your list for this year?

If yes, we're getting close to when I'd start your search. If your timing moved, no problem. Reply with a rough month and I'll keep you posted on the right things.`),
    ],
  },
  {
    id: "buyers-1-3y",
    label: "Buyers, 1–3 years",
    who: "Someday buyers. Stay helpful and stay in touch.",
    cadence: "Every 3 months",
    lofty: "SM Buyers 1-3 yrs",
    emails: [
      e("b13-1", "Email 1", "Buying in a year or two?", `
Hi {first_name},

No rush here. I just want to be useful while you get there.

Every few months I'll send one short email with something worth knowing about buying in Chicago. No spam, and you can tell me to stop anytime.

If you ever want to see what your rent could buy instead, reply and I'll run the numbers.`),
      e("b13-2", "Email 2", "The credit score thing", `
Hi {first_name},

One thing that pays off a year or two before you buy: your credit score. A better score can mean a lower rate, which can be real money every month for the life of the loan.

The basics: pay on time, keep card balances under about 30% of the limit, and don't open new credit right before you apply. A lender can tell you exactly what would help most. Want an intro?`),
      e("b13-3", "Email 3", "Neighborhoods worth a look", `
Hi {first_name},

If you're starting to think about where you'd buy, I'm happy to tell you what I'm seeing: which areas give the most for the money, what HOAs run in different buildings, and where prices have held up.

Reply with a couple of neighborhoods you like and I'll send you a quick honest take.`),
      e("b13-4", "Email 4", "Checking in", `
Hi {first_name},

It's been a little while. Anything new on your end? New job, lease ending, growing family?

If buying moved up, I can help you plan the next steps. If not, I'll keep sending the occasional useful note. Either way, I'm here when you need me.`),
    ],
  },
  {
    id: "sellers",
    label: "Potential sellers",
    who: "Owners who've mentioned selling someday, plus mailer and website leads.",
    cadence: "Every 3 months",
    lofty: "SM Potential Sellers",
    emails: [
      e("sell-1", "Email 1", "What would you walk away with?", `
Hi {first_name},

If you've thought about selling, the first question is usually: what would I actually walk away with?

I can put together a quick net sheet for you: a realistic price from recent sales near you, minus commission, transfer taxes, title, attorney and your loan payoff. It's a real number, not a Zestimate.

No commitment. Reply "net sheet" and I'll send it over.`),
      e("sell-2", "Email 2", "Selling and buying at the same time", `
Hi {first_name},

The biggest worry I hear from owners is "where do I go?" Selling and buying at the same time sounds stressful, but there are a few ways to do it:

- Sell first, then rent back from the buyer for a bit
- Buy first using a bridge loan or a HELOC
- Line up both closings on the same day

Which one fits depends on your equity and your timing. Happy to walk you through it whenever you're curious.`),
      e("sell-3", "Email 3", "The 3 things that move your price", `
Hi {first_name},

When a home sells for more than the neighbors, it's usually not luck. It's three things:

1. Price it right from day one. Overpriced homes sit, and sitting costs money.
2. Make it look its best. Clean, bright, decluttered, with professional photos and video.
3. Get it in front of buyers on day one, not just on the MLS.

I'm happy to walk your place and tell you what's worth doing and what's not, even if you're a year out.`),
      e("sell-4", "Email 4", "Your home's value, any time", `
Hi {first_name},

Just a reminder that I'm happy to pull a fresh value for your home whenever you want one, based on what actually sold near you recently.

Thinking about a refinance, an appeal of your property tax, or just curious? Reply "value" and I'll send it over this week.`),
    ],
  },
  {
    id: "past-buyers",
    label: "Past clients: buyers",
    who: "People you helped buy. Stay their go-to for anything house-related.",
    cadence: "Every 3 months",
    lofty: "SM Past Buyers",
    emails: [
      e("pb-1", "Email 1", "Check your property tax bill", `
Hi {first_name},

One thing I remind all my past buyers: check your Cook County tax bill for the homeowner exemption. It lowers your tax every year, but it doesn't always carry over after a purchase, so it's worth a look.

You can check it on the Cook County Assessor's website with your PIN. If it's missing, you can apply there too.

If you want help reading your bill, just send me a photo.`),
      e("pb-2", "Email 2", "Need a good contractor?", `
Hi {first_name},

Hope the place is treating you well. If you've got projects on your list, I keep a list of contractors, plumbers, electricians, handymen and cleaners my clients have actually used and liked.

Reply with what you need and I'll send you a name or two.`),
      e("pb-3", "Email 3", "What's your home worth now?", `
Hi {first_name},

Ever wonder what your place would sell for today? I'm happy to pull the recent sales in your building or on your block and send you a value. Takes me a few minutes.

It's useful even if you're staying put: for a refinance, a tax appeal, insurance, or just knowing your equity.`),
      e("pb-4", "Email 4", "A quick favor", `
Hi {first_name},

I hope you're doing great. Most of my business comes from people like you passing my name along, and I appreciate it more than you know.

If a friend, coworker or family member mentions buying, selling or renting, I'd love to help them the same way I helped you. You can just reply with their name and I'll take it from there.`),
    ],
  },
  {
    id: "past-sellers",
    label: "Past clients: sellers",
    who: "People you helped sell. Many will buy, sell or invest again.",
    cadence: "Every 3 months",
    lofty: "SM Past Sellers",
    emails: [
      e("ps-1", "Email 1", "How's the new place?", `
Hi {first_name},

It's been a little while since we closed, and I wanted to check in. How's the new place?

If you need anything at all, from a contractor to a mover for a friend, I'm here.`),
      e("ps-2", "Email 2", "Your old neighborhood", `
Hi {first_name},

Curious what's happened in your old neighborhood since you sold? I'm happy to send a quick update on what's sold nearby and for how much. Some people like knowing they timed it right.

And if you're thinking about your next move, buying an investment property or upsizing, let's talk about it early. Planning is where the money is made.`),
      e("ps-3", "Email 3", "Thinking about an investment property?", `
Hi {first_name},

A lot of past clients ask me about buying a rental or a 2-flat at some point. If that's ever on your mind, I can show you what rents and prices look like in a few areas, and what the numbers look like after taxes, insurance and HOA.

No pitch. Just real numbers, whenever you want them.`),
      e("ps-4", "Email 4", "Thank you", `
Hi {first_name},

Just a note to say thank you again for trusting me with your sale. If anyone you know is thinking about selling or buying, I'd be grateful for the intro and I'll take great care of them.

Reply with their name, or just pass along my number.`),
    ],
  },
  {
    id: "vendors",
    label: "Vendors and network",
    who: "Lenders, attorneys, contractors and people you meet networking.",
    cadence: "Every 3 months",
    lofty: "SM Vendors",
    emails: [
      e("v-1", "Email 1", "Great meeting you", `
Hi {first_name},

Great meeting you. I like to keep a short list of people I trust so I can send my clients to someone good.

What kind of client is the best fit for you? Tell me and I'll keep you in mind. And if you ever have someone thinking about buying, selling or renting in Chicago, I'll take great care of them.`),
      e("v-2", "Email 2", "Referral swap", `
Hi {first_name},

Quick one. I've had a few clients lately who needed exactly what you do. Would you be open to me sending them your way?

And if anyone you work with mentions a move, I'm happy to help. Let's grab a coffee sometime and figure out how to send each other business.`),
      e("v-3", "Email 3", "What I'm seeing in the market", `
Hi {first_name},

Thought you'd find this useful since a lot of your clients are homeowners too. If any of them ever want a free, honest value on their home, or a net sheet showing what they'd walk away with, I'm happy to do it. No pressure on them.

Just pass along my number or reply with an intro.`),
      e("v-4", "Email 4", "Checking in", `
Hi {first_name},

Hope business is good. Just checking in to keep in touch. If there's anything I can do for you or your clients, let me know.`),
    ],
  },
  {
    id: "mailer",
    label: "Postcard QR scans",
    who: "Homeowners who scanned your postcard QR. Lofty tags them \"Mailer\". November, then January, then February for spring.",
    cadence: "Day 0, about 6 weeks, about 12 weeks",
    lofty: "SM Mailer Follow-up",
    emails: [
      e("mail-1", "November", "Thanks for checking out my postcard", `
Hi {first_name},

Thanks for scanning my postcard. I'm the agent who sent it.

If you were curious what your home would sell for, I'm happy to put together a real number from recent sales near you, plus what you'd walk away with after costs. It's free, and there's no obligation.

Reply "value" or call me and I'll get it to you this week.`),
      e("mail-2", "January", "Thinking about spring?", `
Hi {first_name},

Spring is when a lot of homes in your area go up for sale, and the sellers who do best start planning now.

If selling this year is a possibility, let's walk your home together. I'll tell you what's worth fixing, what to skip, and what timing makes the most sense for you. No pressure either way.`),
      e("mail-3", "February", "Your spring game plan", `
Hi {first_name},

If you're thinking about selling this spring, now is the time to get on the calendar for photos, small repairs and pricing.

Want a simple plan with dates and a net sheet for your home? Reply "plan" and I'll put it together.`),
    ],
  },
  // ---------- Added 2026-10-31 (Michael: "all of them") ----------
  {
    id: "under-contract",
    label: "Under contract updates",
    who: "Your buyer or seller clients once you have an accepted offer. Send each one as you hit the step, so they're never wondering what's happening.",
    cadence: "At each step of the deal",
    lofty: "SM Under Contract",
    emails: [
      e("uc-1", "Offer accepted", "We're under contract!", `
Hi {first_name},

Congratulations, we're officially under contract!

Here's what happens next:
1. Attorney review: both attorneys go over the contract, usually within 5 business days.
2. Inspection: we schedule it right away and go over the report together.
3. Appraisal and loan approval, if there's a loan.
4. Final walkthrough, then closing.

I'll email you at each step so you always know where things stand. If anything comes up in between, call or text me any time.`),
      e("uc-2", "Attorney review / inspection", "Attorney review and inspection update", `
Hi {first_name},

Quick update. Attorney review and the inspection are the next big steps.

Your attorney will reach out about the contract, and any repair requests from the inspection usually get handled through the attorneys too. This is normal and it's where most small issues get worked out.

I'll let you know as soon as attorney review is closed out. If you have any questions about the report or the requests, call me and we'll go through it together.`),
      e("uc-3", "Appraisal / loan", "Appraisal and loan update", `
Hi {first_name},

Another step done. We're now waiting on the appraisal and the final loan approval.

Nothing you need to do right now except one thing: if you're the buyer, don't open new credit cards, finance a car or move large amounts of money until after closing. Lenders re-check right before closing.

I'll update you the moment we hear back.`),
      e("uc-4", "Clear to close", "We're clear to close", `
Hi {first_name},

Great news, we're clear to close!

Next up:
- Final walkthrough, usually the day before or the morning of closing
- Your attorney or the title company will send the final numbers and wiring instructions

One important thing: always call to confirm wiring instructions by phone with a number you already know before you send money. Wire fraud is real and it targets closings.

Almost there.`),
      e("uc-5", "Closing day", "Congratulations, it's official!", `
Hi {first_name},

It's official, congratulations! Thank you for trusting me with this. It's been a pleasure.

A few things for the next couple of weeks:
- Keep your closing documents somewhere safe
- If you bought, change the locks and set up utilities in your name
- Check that your homeowner exemption is on your next Cook County tax bill

If you need a contractor, a cleaner or anything else, just ask. I'm still your agent after closing.`),
    ],
  },
  {
    id: "reviews",
    label: "Review and referral ask",
    who: "Every client after closing. One asks for a Google review, the next asks for a referral.",
    cadence: "2 weeks and 60 days after closing",
    lofty: "SM Review + Referral",
    emails: [
      e("rev-1", "2 weeks after closing", "Would you do me a quick favor?", `
Hi {first_name},

I hope you're settling in. Would you do me a quick favor and leave a short Google review about working with me? It takes about a minute and helps more than you'd think. A couple of sentences is plenty.

Reply "yes" and I'll send you the link.

Thank you again for trusting me.`),
      e("rev-2", "60 days after closing", "Know anyone thinking about a move?", `
Hi {first_name},

It's been a couple of months since closing, and I hope everything is going well.

Most of my business comes from clients passing my name along. If a friend, coworker or family member mentions buying, selling or renting, I'd love to help them the same way I helped you.

Just reply with their name and number, or pass along mine. I'll take great care of them.`),
    ],
  },
  {
    id: "expired",
    label: "Expired and withdrawn listings",
    who: "Owners whose listing expired or was withdrawn. Only after it's off the market. Never contact owners whose home is still listed with another agent.",
    cadence: "Day 0, day 3, day 7, day 14",
    lofty: "SM Expired",
    emails: [
      e("exp-1", "Day 0", "Your home in {neighborhood}", `
Hi {first_name},

I saw your home came off the market. I know that's frustrating, especially after all the work of getting it ready and keeping it show-ready.

If you still want to sell, I'd be happy to take an honest look at why it didn't sell and what I'd do differently. No pressure, and I won't tell you what you want to hear just to get the listing.

Would a 15-minute call this week work?`),
      e("exp-2", "Day 3", "Why homes don't sell", `
Hi {first_name},

When a home doesn't sell, it almost always comes down to one of three things:

1. Price: priced above what recent sales support, so buyers skip it
2. Presentation: photos, video or condition that don't show it at its best
3. Exposure: it never really got in front of the right buyers

The good news is all three can be fixed. I'm happy to tell you which one I think it was for your home.`),
      e("exp-3", "Day 7", "What you'd walk away with", `
Hi {first_name},

If you're deciding whether to try again, it helps to know your real number.

I can put together a net sheet for your home: a realistic price from recent sales near you, minus commission, transfer taxes, title, attorney and your payoff. Then you can decide with real numbers.

Reply "net sheet" and I'll send it over.`),
      e("exp-4", "Day 14", "A fresh relaunch plan", `
Hi {first_name},

One last note from me. If you relist, the relaunch matters more than the first time, because buyers have already seen it.

Here's what I'd do: fresh photos and video, a price based on what's actually selling right now, and a real marketing push in the first week, not just the MLS.

If you want to see the plan for your home, just reply. If you've decided to stay, I completely understand and wish you the best.`),
    ],
  },
  {
    id: "open-house",
    label: "Open house follow-up",
    who: "Everyone who signed in at your open house.",
    cadence: "Same day, day 3, day 10",
    lofty: "SM Open House",
    emails: [
      e("oh-1", "Same day", "Thanks for stopping by", `
Hi {first_name},

Thanks for stopping by the open house today. It was nice meeting you.

What did you think of the place? If you have questions about it, like HOA, taxes, or what similar homes have sold for, I'm happy to send the details.

And if it wasn't quite right, tell me what you're looking for and I'll send you others that fit.`),
      e("oh-2", "Day 3", "A few others you might like", `
Hi {first_name},

I've been thinking about what you might like based on the open house. Want me to set you up with a search so you see new listings that match as soon as they hit the market?

Just reply with your price range, how many bedrooms, and the neighborhoods you like. I'll set it up today.`),
      e("oh-3", "Day 10", "Still looking?", `
Hi {first_name},

Checking in. Are you still looking, or did your plans change?

If you're still looking, I'm happy to set up a few private showings at times that work for you. If you're early in the process, I can help you figure out what you can afford and what monthly payment to expect.`),
    ],
  },
  {
    id: "anniversary",
    label: "Home anniversary + tax appeal",
    who: "Past buyers, once a year. Plus a reminder when their township's Cook County appeal window opens.",
    cadence: "Yearly on the closing date + when the appeal window opens",
    lofty: "SM Home Anniversary",
    emails: [
      e("ann-1", "Home anniversary", "Happy home anniversary, {first_name}!", `
Hi {first_name},

Happy home anniversary! Hard to believe it's been another year in your place.

If you're curious, I'm happy to send you a quick update on what your home is worth now and how much equity you've built, based on recent sales near you. Just reply "value".

Hope you're loving it.`),
      e("ann-2", "Appeal window opens", "Your property tax appeal window is open", `
Hi {first_name},

Quick heads up: the Cook County Assessor's appeal window for your township is open now. It's usually only open for about 30 days.

Appealing is free and you can file online on the Assessor's website. If your assessed value looks high compared to similar homes, it's worth a look. Some homeowners use a tax appeal attorney, who usually only gets paid if they lower your bill.

Want me to pull recent sales near you so you can see if your value looks high? Just reply "appeal".`),
    ],
  },
  {
    id: "cold",
    label: "Cold lead check-in",
    who: "Leads who haven't replied in 90+ days. Short on purpose. Short emails get the most replies.",
    cadence: "Day 0, day 7, day 21",
    lofty: "SM Cold Revival",
    emails: [
      e("cold-1", "Day 0", "Still looking?", `
Hi {first_name},

Are you still looking for a place?`),
      e("cold-2", "Day 7", "Change of plans?", `
Hi {first_name},

Did your plans change? Totally fine if so. Just let me know if you'd like me to keep sending homes or hold off for now.`),
      e("cold-3", "Day 21", "Should I close your file?", `
Hi {first_name},

I haven't heard back, so I'm guessing the timing isn't right. Should I close your file for now?

If you're still thinking about buying or selling, just reply and I'll pick up right where we left off.`),
    ],
  },
  {
    id: "neighbors",
    label: "Just Listed / Just Sold to neighbors",
    who: "Owners near a home you just listed or sold. Goes with the seller ads.",
    cadence: "When you list, when you sell",
    lofty: "SM Neighbors",
    emails: [
      e("nb-1", "Just Listed", "Just listed in {neighborhood}", `
Hi {first_name},

I just listed a home in {neighborhood}, close to you. Neighbors usually know someone who'd love to live nearby, so I wanted you to hear about it first.

If you know anyone looking, or want the details yourself, just reply and I'll send them over.

And if it makes you curious what your own home is worth, I'm happy to send a value too.`),
      e("nb-2", "Just Sold", "Just sold in {neighborhood}", `
Hi {first_name},

I just sold a home in {neighborhood}, near you. Every sale nearby changes what homes like yours are worth.

Curious what yours would sell for now? Reply "value" and I'll send you a real number based on recent sales, plus what you'd walk away with after costs.`),
    ],
  },
  {
    id: "rate-drop",
    label: "Rate drop alert",
    who: "Buyers you've talked to who were waiting on rates. Send when rates move down.",
    cadence: "When rates drop",
    lofty: "SM Rate Drop",
    emails: [
      e("rate-1", "When rates drop", "Rates just came down", `
Hi {first_name},

Mortgage rates have come down since we last talked, so I wanted to let you know.

Even a small drop can change your monthly payment or what you can afford. There are also ways to bring the rate down further, like a seller paying for a rate buydown, or a temporary buydown that lowers the payment for the first few years.

Want me to run the numbers for you with today's rates? Just reply and I'll send them over.`),
    ],
  },
];

// Groups for the picker (keeps 19 groups easy to scan on a phone).
export const GROUPS: { id: string; label: string; segs: string[] }[] = [
  { id: "touch", label: "Stay in touch", segs: ["kickoff", "renters", "buyers-0-3", "buyers-3-6", "buyers-6-12", "buyers-1-3y", "sellers", "past-buyers", "past-sellers", "anniversary", "vendors", "cold", "rate-drop"] },
  { id: "deal", label: "Clients in a deal", segs: ["under-contract", "reviews"] },
  { id: "listings", label: "Win listings", segs: ["expired", "mailer", "neighbors", "open-house"] },
];

export const ALL_EMAILS = SEGMENTS.flatMap(s => s.emails.map(m => ({ ...m, segment: s })));
export const emailCount = ALL_EMAILS.length;

// ---------- Filling ----------
export type Signer = { name: string; phone: string; email: string };
export const TEAM_LINE = (d = new Date()) =>
  d >= new Date("2026-11-09T06:00:00Z") ? "SpaceMatch Inc. · a team of Real Broker, LLC" : "SpaceMatch Inc.";

export function signature(s: Signer) {
  return [s.name, s.phone, s.email, TEAM_LINE()].filter(Boolean).join("\n");
}

export function fill(text: string, vals: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = vals[k]?.trim();
    if (v) return v;
    if (k === "first_name") return "there";
    if (k === "neighborhood") return "your neighborhood";
    return m;
  });
}

// "Hi there," reads fine; "Quick question, there" doesn't.
export const fillSubject = (subject: string, vals: Record<string, string>) =>
  vals.first_name?.trim() ? fill(subject, vals) : fill(subject.replace(/,?\s*\{first_name\}/g, ""), vals);

export function toLofty(text: string, vals: Record<string, string> = {}) {
  let out = text;
  for (const f of FIELDS) if (f.lofty) out = out.replaceAll(`{${f.key}}`, f.lofty);
  return fill(out, vals);
}

export const gmailLink = (to: string, subject: string, body: string) =>
  `https://mail.google.com/mail/?view=cm&fs=1${to ? `&to=${encodeURIComponent(to)}` : ""}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
export const mailtoLink = (to: string, subject: string, body: string) =>
  `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

// CSV for agents on other CRMs (Lolo Plus, Follow Up Boss, Mailchimp…).
export function libraryCsv() {
  const q = (s: string) => `"${s.replaceAll('"', '""')}"`;
  const rows = [["Group", "When", "Subject", "Body"].map(q).join(",")];
  for (const s of SEGMENTS) for (const m of s.emails) rows.push([s.label, `${m.step} (${s.cadence})`, m.subject, m.body].map(q).join(","));
  return rows.join("\n");
}
