export const RISK_KEYWORDS: Array<{ flag: string; terms: string[] }> = [
  { flag: "controversy", terms: ["boycott", "backlash", "scandal", "controversy", "outrage", "cancelled", "cancellation", "coverup"] },
  { flag: "politics", terms: ["election", "government", "politics", "parliament", "referendum", "brexit", "tory", "labour", "political"] },
  { flag: "tragedy", terms: ["death", "disaster", "tragedy", "attack", "incident", "shooting", "bombing", "terror", "fatality", "killed", "massacre"] },
  { flag: "adult", terms: ["nsfw", "adult", "explicit", "pornography", "xxx", "nude"] },
  { flag: "gambling", terms: ["betting", "casino", "gambling", "odds", "wager", "bookmaker", "accumulator"] },
  { flag: "hate/harassment", terms: ["hate", "harassment", "abuse", "bigotry", "racist", "racism", "sexist", "homophobic", "transphobic", "extremist"] },
  { flag: "violence", terms: ["violence", "assault", "fight", "riot", "stabbing", "weapon", "gun"] },
  { flag: "drugs/alcohol", terms: ["drug", "cocaine", "cannabis", "overdose", "doping", "drunk", "alcoholism"] },
  { flag: "health-misinformation", terms: ["antivax", "anti-vax", "conspiracy", "hoax", "miracle cure", "detox scam"] },
  { flag: "religion", terms: ["blasphemy", "jihad", "crusade", "cult", "extremist preacher"] },
  { flag: "financial-risk", terms: ["pyramid scheme", "ponzi", "crypto scam", "get rich quick", "mlm"] },
  { flag: "legal", terms: ["lawsuit", "litigation", "arrest", "fraud", "embezzlement", "indictment"] }
];

export const RISK_SUBREDDITS: Array<{ flag: string; names: string[] }> = [
  { flag: "politics", names: ["ukpolitics", "politics", "worldpolitics", "labouruk", "tories", "greenandpleasant"] },
  { flag: "adult", names: ["nsfw", "gonewild", "onlyfans"] },
  { flag: "gambling", names: ["sportsbook", "gambling", "bettingadvice"] },
  { flag: "controversy", names: ["subredditdrama", "amitheasshole", "publicfreakout", "fightporn"] },
  { flag: "conspiracy", names: ["conspiracy", "conspiracytheories"] },
  { flag: "drugs", names: ["drugs", "trees", "darknet"] }
];

/**
 * Brand-specific risk terms can be passed at brief time.
 * These are merged with the global list during playground scoring.
 */
export type BrandRiskConfig = {
  flag: string;
  terms: string[];
};

export function mergeRiskKeywords(brandRisks?: BrandRiskConfig[]): Array<{ flag: string; terms: string[] }> {
  if (!brandRisks?.length) {
    return RISK_KEYWORDS;
  }
  return [...RISK_KEYWORDS, ...brandRisks];
}
