// 90-day Growth Playbook checklist (from the published playbook page, 53 items + the Muse coach step added 2026-10-27).
// Item ids match the original page's data-k keys so progress stays stable.
export type GrowthItem = { id: string; text: string };
export type GrowthWeek = { title: string; items: GrowthItem[] };
export type GrowthLevel = { id: string; label: string; title: string; who: string; weeks: GrowthWeek[]; doneWhen: string };

export const GROWTH_PLAYBOOK_URL = "https://spacematchinc.viktor.page/spacematch-growth-playbook";

export const GROWTH_LEVELS: GrowthLevel[] = [
  {
    "id": "l1",
    "label": "Level 1 · Days 1–30",
    "title": "Foundation",
    "who": "Brand new, or invisible online. Under 500 followers. Fewer than 5 reviews.",
    "weeks": [
      {
        "title": "Week 1 — Become findable",
        "items": [
          {
            "id": "l1-1",
            "text": "Get one professional headshot. Plain background, natural light, shoulders up, no sunglasses. **Use the identical file on every platform.**"
          },
          {
            "id": "l1-2",
            "text": "Claim and complete your **Google Business Profile**. Category: Real Estate Agent. Add photos, hours, service area."
          },
          {
            "id": "l1-3",
            "text": "Claim and complete **Zillow, Realtor.com, and Homes.com** profiles. Fill every optional field — languages, price range, areas served."
          },
          {
            "id": "l1-4",
            "text": "Update your **brokerage profile** and your SpaceMatch team page bio to match."
          },
          {
            "id": "l1-5",
            "text": "Write your one sentence: **\"I help ___ in ___ do ___.\"** Paste it into all eight profiles, word for word."
          },
          {
            "id": "l1-muse",
            "text": "Set up your **SpaceMatch Coach in Muse** (Hub › Muse coach, 2 minutes). Then ask it every morning: \"What are my 3 tasks today?\""
          },
          {
            "id": "l1-6",
            "text": "Switch Instagram to a **Business account**. Set the bio using the formula in section 07. Add a phone-tap contact button."
          }
        ]
      },
      {
        "title": "Week 2 — Bank the proof you already have",
        "items": [
          {
            "id": "l1-7",
            "text": "List every past client, friend, and family member who has bought or sold. **Text each one** the review request script."
          },
          {
            "id": "l1-8",
            "text": "Get your first **five reviews live** on Zillow and Google. If you have zero closings, ask former colleagues or clients from your previous career for a professional recommendation on LinkedIn instead."
          },
          {
            "id": "l1-9",
            "text": "Screenshot each review and post it. One review = one post. That's five posts from work you already did."
          },
          {
            "id": "l1-10",
            "text": "Post your **introduction video**: 30 seconds, who you were before real estate, why you do this now. Pin it to your profile."
          }
        ]
      },
      {
        "title": "Week 3 — Pick your patch and learn it",
        "items": [
          {
            "id": "l1-11",
            "text": "Choose **one neighborhood** you can walk in an hour. Write it down. You are keeping it for 12 months."
          },
          {
            "id": "l1-12",
            "text": "Pull last 90 days of MRED data for that neighborhood: median price, days on market, list-to-sale ratio, months of inventory. **Save it in a spreadsheet you'll update monthly.**"
          },
          {
            "id": "l1-13",
            "text": "Walk it and film **ten 20-second clips** — coffee shop, park, train stop, the block everyone wants, the block nobody knows about. That's two weeks of content in one afternoon."
          },
          {
            "id": "l1-14",
            "text": "Preview **ten active listings** in your patch. You now have opinions, which is what makes content worth watching."
          }
        ]
      },
      {
        "title": "Week 4 — Start the cadence and don't stop",
        "items": [
          {
            "id": "l1-15",
            "text": "Post **five times** this week using the weekly grid in section 05. Three must be video."
          },
          {
            "id": "l1-16",
            "text": "Put a recurring **90-minute Sunday batch block** on your calendar. Repeating. Forever."
          },
          {
            "id": "l1-17",
            "text": "Turn on DM and comment notifications. Practice the **five-minute rule** on every single one."
          },
          {
            "id": "l1-18",
            "text": "Follow and engage with **20 local businesses** in your patch — real comments, not emojis. They are your first referral network."
          },
          {
            "id": "l1-19",
            "text": "**Level 1 is complete when:** 8 profiles live and consistent, 5+ reviews, 20 posts published, and you can say your sentence without thinking."
          }
        ]
      }
    ],
    "doneWhen": "8 profiles live and consistent, 5+ reviews, 20 posts published, and you can say your sentence without thinking.</"
  },
  {
    "id": "l2",
    "label": "Level 2 · Days 31–60",
    "title": "Engine",
    "who": "You post, but nothing happens. Followers but no DMs, no leads, no closings from it.",
    "weeks": [
      {
        "title": "Week 5 — Diagnose why nothing is converting",
        "items": [
          {
            "id": "l2-1",
            "text": "Open your last 30 posts. **Sort by reach.** Write down what the top 3 have in common and what the bottom 3 have in common. Make more of the top."
          },
          {
            "id": "l2-2",
            "text": "Count how many of your posts **ask for anything**. If it's under half, that's your problem — you're broadcasting, not converting."
          },
          {
            "id": "l2-3",
            "text": "Audit your first 3 seconds. If your video opens with \"Hi guys, it's me\" — **that's why nobody watches**. Open on the hook or the visual."
          },
          {
            "id": "l2-4",
            "text": "Rewrite your bio so it names **who you help and what they get**, not your title and your brokerage."
          }
        ]
      },
      {
        "title": "Week 6 — Build the machine that catches people",
        "items": [
          {
            "id": "l2-5",
            "text": "Create **one lead magnet**: a neighborhood market report, a first-time buyer checklist, or a \"what your building actually rents for\" analysis. One page. Branded."
          },
          {
            "id": "l2-6",
            "text": "Run the **comment-to-DM play** (section 07) on every educational post. \"Comment REPORT and I'll send it.\""
          },
          {
            "id": "l2-7",
            "text": "Set up your **six-touch follow-up sequence** in Lofty. Day 0, 1, 3, 7, 14, 30. Write all six messages once; use them forever."
          },
          {
            "id": "l2-8",
            "text": "Add a **monthly market email** for your patch. Same data you already pull. Same five minutes. Compounds for years."
          }
        ]
      },
      {
        "title": "Week 7 — Get on camera properly",
        "items": [
          {
            "id": "l2-9",
            "text": "Ship **four listing or neighborhood videos** this week. Vertical, captions burned in, under 45 seconds."
          },
          {
            "id": "l2-10",
            "text": "Add **captions to everything**. Most people watch on mute. No captions, no views."
          },
          {
            "id": "l2-11",
            "text": "Do **one on-camera market update** per week — one number, what it means, what you'd do about it. 40 seconds."
          },
          {
            "id": "l2-12",
            "text": "Start a **YouTube channel** and post the same vertical videos as Shorts. Real estate is one of the most-searched categories there and almost no local agent shows up."
          }
        ]
      },
      {
        "title": "Week 8 — Turn attention into appointments",
        "items": [
          {
            "id": "l2-13",
            "text": "**Ten intentional DMs a day.** Not pitches — real replies to stories, congratulations, local questions. 200 conversations a month."
          },
          {
            "id": "l2-14",
            "text": "Reply to **every comment within the hour**, with a question. This is free reach and you're ignoring it."
          },
          {
            "id": "l2-15",
            "text": "Ask for the appointment in a DM at least **five times this week**. The soft-ask script is in section 07."
          },
          {
            "id": "l2-16",
            "text": "Host **one open house** and film it — before, during, and the debrief. That's three posts from one Saturday."
          },
          {
            "id": "l2-17",
            "text": "**Level 2 is complete when:** you post 5×/week without thinking about it, every lead gets a reply inside 5 minutes, and you've had at least 5 conversations that turned into a showing or a listing appointment."
          }
        ]
      }
    ],
    "doneWhen": "You post 5×/week without thinking about it, every lead gets a reply inside 5 minutes, and you've had at least 5 conversations that turned into a showing or a listing appointment.</"
  },
  {
    "id": "l3",
    "label": "Level 3 · Days 61–90+",
    "title": "Authority",
    "who": "Leads come in, but you're one of many. Ready to own a niche and add commercial.",
    "weeks": [
      {
        "title": "Week 9 — Claim authority, not just presence",
        "items": [
          {
            "id": "l3-1",
            "text": "Narrow your claim to something **defensible**: \"the 2–4 unit guy in Avondale,\" \"the Hinsdale downsizing specialist,\" \"restaurant leases on the Northwest Side.\""
          },
          {
            "id": "l3-2",
            "text": "Publish a **quarterly market report** for your patch as a real branded PDF. This is the single highest-status asset a local agent can own."
          },
          {
            "id": "l3-3",
            "text": "Start a **recurring series** with a name — \"Cap Rate Fridays,\" \"Two-Flat Tuesdays,\" \"$400K in Portage Park.\" Named series get followed; random posts get scrolled."
          },
          {
            "id": "l3-4",
            "text": "Get on **two local podcasts, panels, or newsletters** this quarter. Borrowed audiences are the fastest growth there is."
          }
        ]
      },
      {
        "title": "Week 10 — Open the commercial door",
        "items": [
          {
            "id": "l3-5",
            "text": "Learn four numbers cold: **cap rate, NOI, cash-on-cash, DSCR.** You cannot fake these in front of an investor and you will not get a second meeting."
          },
          {
            "id": "l3-6",
            "text": "Create profiles on **LoopNet and Crexi**. Almost no residential agent does this. That is the whole point."
          },
          {
            "id": "l3-7",
            "text": "Publish **one investment-education post per week** — teardown of a real 2-flat, what a corner retail strip actually nets, why a $1.8M building at 8% cap is different from a $1.8M house."
          },
          {
            "id": "l3-8",
            "text": "Run the **bridge play** on your existing residential database: \"You've owned this three years and you're up. Want to see what a small multi would do for you?\""
          }
        ]
      },
      {
        "title": "Week 11 — Add business brokerage",
        "items": [
          {
            "id": "l3-9",
            "text": "Learn **SDE and add-backs** — how a small business is actually priced, and why a laundromat trades on a multiple of owner earnings rather than a price per square foot."
          },
          {
            "id": "l3-10",
            "text": "Get familiar with **BizBuySell** and how SpaceMatch lists on it. Study two of the team's live listings end to end."
          },
          {
            "id": "l3-11",
            "text": "Talk to **five business owners in your patch** about their lease, their landlord, and their exit plan. Every one of them owns or wants real estate."
          },
          {
            "id": "l3-12",
            "text": "Post one **\"what this business actually makes\"** teardown. Nobody in your feed is making this content and it travels."
          }
        ]
      },
      {
        "title": "Week 12 — Build leverage",
        "items": [
          {
            "id": "l3-13",
            "text": "Document your **own repeatable process** — batch day, posting grid, follow-up sequence — so it can be handed to an assistant or an editor."
          },
          {
            "id": "l3-14",
            "text": "Hire or trade for **editing help** the moment content is eating more than five hours a week. Your time belongs in front of the camera and in appointments."
          },
          {
            "id": "l3-15",
            "text": "Build **one referral relationship per month**: lender, attorney, contractor, insurance, CPA, property manager. Feature them in content; they return the favor."
          },
          {
            "id": "l3-16",
            "text": "Review your numbers monthly against the scorecard in section 08. **Adjust one thing, not five.**"
          },
          {
            "id": "l3-17",
            "text": "**Level 3 is complete when:** a stranger can describe what you specialize in, you have closed at least one investment or commercial transaction, and inbound leads exceed the ones you chase."
          }
        ]
      }
    ],
    "doneWhen": "A stranger can describe what you specialize in, you have closed at least one investment or commercial transaction, and inbound leads exceed the ones you chase.</"
  }
];

export const GROWTH_ITEM_IDS: string[] = GROWTH_LEVELS.flatMap(l => l.weeks.flatMap(w => w.items.map(i => i.id)));
