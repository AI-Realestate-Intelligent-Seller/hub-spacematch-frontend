// Market areas for the market update kit = the MRED areas the monthly pull already knows
// (skills/mred_mls/scripts/mred_market.py AREAS). Keep keys in sync with that script.
export const MARKET_AREAS: { key: string; label: string }[] = [
  { key: "chicago", label: "City of Chicago" },
  { key: "nearnorth", label: "Near North (River North, Gold Coast, Streeterville)" },
  { key: "lincolnpark", label: "Lincoln Park" },
  { key: "lakeview", label: "Lake View" },
  { key: "logansquare", label: "Logan Square" },
  { key: "westtown", label: "West Town (Wicker Park, Bucktown, Ukrainian Village)" },
  { key: "nearwest", label: "Near West Side (West Loop)" },
  { key: "hydepark", label: "Hyde Park" },
  { key: "evanston", label: "Evanston" },
  { key: "oakpark", label: "Oak Park" },
  { key: "glenview", label: "Glenview / Golf" },
  { key: "northbrook", label: "Northbrook" },
  { key: "highlandpark", label: "Highland Park" },
  { key: "winnetka", label: "Winnetka" },
  { key: "hinsdale", label: "Hinsdale" },
  { key: "oakbrook", label: "Oak Brook / Oakbrook Terrace" },
  { key: "arlingtonheights", label: "Arlington Heights" },
  { key: "schaumburg", label: "Schaumburg" },
  { key: "hoffmanestates", label: "Hoffman Estates" },
  { key: "longgrove", label: "Long Grove / Lake Zurich / Kildeer / Hawthorn Woods" },
];
export const areaLabel = (k: string) => MARKET_AREAS.find(a => a.key === k)?.label ?? k;
export const MAX_AGENT_AREAS = 3;
export const MONTHLY_AREA_CAP = 20;
// SpaceMatch Inc. Google Business Profile (gmb api 2026-10-03).
export const TEAM_REVIEW_URL = "https://search.google.com/local/writereview?placeid=ChIJxYWwPf0tDogRqr8Yjem0gek";
