import type { MomentCategory } from "@/lib/playground/types";

export type PlaygroundTaxonomyItem = {
  id: string;
  name: string;
  description: string;
  seedKeywords: string[];
  categories: MomentCategory[];
  /** Demographic markers that naturally live in this playground */
  primaryAudience: string[];
  /**
   * Demographic markers that are adjacent/high-growth in this playground
   * but not the primary audience. Values are planner-facing rationale strings.
   * Stats marked [Demo GWI data] are illustrative — replace with live GWI pull.
   */
  adjacentAudiences: Record<string, string>;
};

export const PLAYGROUND_TAXONOMY: PlaygroundTaxonomyItem[] = [
  {
    id: "film-tv-fandom",
    name: "Film & TV Fandom",
    description: "Entertainment-led communities tracking releases, franchises, and cast culture.",
    seedKeywords: ["cinema", "streaming", "franchise", "box office", "tv series", "superhero"],
    categories: ["film", "events", "holidays"],
    primaryAudience: ["gen-z", "millennial", "gen-x"],
    adjacentAudiences: {}
  },
  {
    id: "football-culture",
    name: "Football Culture",
    description: "Club, competition, and fan-energy moments around football culture in the UK.",
    seedKeywords: ["premier league", "football", "champions league", "matchday", "fan zone", "club"],
    categories: ["sports", "events", "holidays"],
    primaryAudience: ["gen-z", "millennial", "gen-x"],
    adjacentAudiences: {}
  },
  {
    id: "gaming-esports",
    name: "Gaming & Esports",
    description: "Gaming launches, esports tournaments, and creator-adjacent play culture.",
    seedKeywords: ["gaming", "esports", "streamer", "console", "tournament", "live ops"],
    categories: ["events", "sports", "film"],
    primaryAudience: ["gen-z", "millennial", "teen"],
    adjacentAudiences: {
      "gen-x": "Gen X casual gaming up +28% YoY — mobile and nostalgic titles driving re-engagement in the 35-49 cohort. [Demo GWI data]"
    }
  },
  {
    id: "music-fandom",
    name: "Music Fandom",
    description: "Artist, tour, and festival fandom patterns tied to cultural participation.",
    seedKeywords: ["music", "tour", "festival", "album", "artist", "live show"],
    categories: ["events", "holidays", "film"],
    primaryAudience: ["gen-z", "millennial", "teen"],
    adjacentAudiences: {}
  },
  {
    id: "travel-experiences",
    name: "Travel & Experiences",
    description: "Short-break, destination, and event-led travel planning behaviour.",
    seedKeywords: ["city break", "travel", "staycation", "experiences", "weekend trip", "holiday booking"],
    categories: ["holidays", "events", "sports"],
    primaryAudience: ["millennial", "gen-z"],
    adjacentAudiences: {
      "gen-x": "Post-pandemic bucket-list travel surging in 40-49 cohort — experiential spend up +31% YoY. [Demo GWI data]",
      "student": "Student travel intent growing rapidly — 67% of UK students planned a group or solo trip in the last 12 months. [Demo GWI data]"
    }
  },
  {
    id: "family-kids",
    name: "Family & Kids",
    description: "Family calendar planning around school cycles and shared activities.",
    seedKeywords: ["family", "kids", "school holiday", "weekend activities", "parents", "day out"],
    categories: ["holidays", "film", "events"],
    primaryAudience: ["parent", "millennial", "gen-x"],
    adjacentAudiences: {
      "gen-z": "High-growth adjacent audience. GenZ 18-26 engagement with Family & Kids content is up +41% YoY, driven by Disney+, Pixar, and nostalgia IP — now the fastest-growing demographic in this space. 21% of UK GenZ (23-27) identify as parents or expecting. Treat as an expansion play, not core reach. [Demo GWI data]",
      "student": "Weaker signal — student engagement in this space is largely nostalgia-driven (animated IP, family gaming). Validate before activating. [Demo GWI data]"
    }
  },
  {
    id: "food-drink",
    name: "Food & Drink",
    description: "Cuisine trends, occasions, and social food rituals with high participation.",
    seedKeywords: ["food", "restaurant", "recipe", "drinks", "dining", "snacking"],
    categories: ["events", "holidays"],
    primaryAudience: ["gen-z", "millennial", "gen-x", "boomer"],
    adjacentAudiences: {}
  },
  {
    id: "fashion-beauty",
    name: "Fashion & Beauty",
    description: "Style and beauty trends shaped by creators, launches, and fandom crossover.",
    seedKeywords: ["fashion", "beauty", "style", "makeup", "skincare", "streetwear"],
    categories: ["events", "film"],
    primaryAudience: ["gen-z", "millennial"],
    adjacentAudiences: {
      "gen-x": "Gen X beauty spend growing +22% YoY, driven by skincare premiumisation and the anti-ageing segment. Adjacent via premium and prestige beauty. [Demo GWI data]"
    }
  },
  {
    id: "wellness-fitness",
    name: "Wellness & Fitness",
    description: "Lifestyle momentum around movement, recovery, and wellbeing routines.",
    seedKeywords: ["fitness", "wellness", "running", "gym", "recovery", "health routine"],
    categories: ["sports", "events", "holidays"],
    primaryAudience: ["millennial", "gen-z"],
    adjacentAudiences: {
      "gen-x": "Fastest-growing fitness segment in the 35-49 cohort — recovery, mental wellness, and low-impact exercise up +34% YoY. [Demo GWI data]"
    }
  },
  {
    id: "tech-gadgets",
    name: "Tech & Gadgets",
    description: "Consumer tech interest around launches, reviews, and upgrade intent.",
    seedKeywords: ["tech", "gadget", "smartphone", "launch", "review", "ai tools"],
    categories: ["events", "film"],
    primaryAudience: ["gen-z", "millennial", "gen-x"],
    adjacentAudiences: {}
  },
  {
    id: "home-diy",
    name: "Home & DIY",
    description: "Home improvement and interiors moments linked to seasonal behaviour.",
    seedKeywords: ["home", "diy", "interiors", "renovation", "decor", "garden"],
    categories: ["holidays", "events"],
    primaryAudience: ["millennial", "gen-x", "boomer"],
    adjacentAudiences: {
      "gen-z": "First-time buyer GenZ cohort entering the market — 22% of UK 24-27 year olds are actively researching home ownership. High-growth entry point for home and interiors brands. [Demo GWI data]"
    }
  },
  {
    id: "creator-internet-culture",
    name: "Creator & Internet Culture",
    description: "Fast-moving online conversation shaped by creators, memes, and format trends.",
    seedKeywords: ["creator", "internet culture", "viral", "meme", "social trends", "community"],
    categories: ["events", "film", "sports"],
    primaryAudience: ["gen-z", "millennial"],
    adjacentAudiences: {}
  },
  {
    id: "luxury-premium",
    name: "Luxury & Premium",
    description: "Aspiration-led moments around high-end launches, fashion weeks, and prestige events.",
    seedKeywords: ["luxury", "premium", "designer", "fashion week", "haute couture", "exclusive", "craft", "artisan"],
    categories: ["events", "film"],
    primaryAudience: ["gen-x", "boomer", "millennial"],
    adjacentAudiences: {
      "gen-z": "Entry-level and accessible luxury growing fastest in GenZ — aspirational spend up +33% YoY in the 18-27 segment. Brand discovery and gifting are primary motivators. [Demo GWI data]"
    }
  },
  {
    id: "sustainability-purpose",
    name: "Sustainability & Purpose",
    description: "Cultural moments around climate, ethical living, and brand purpose participation.",
    seedKeywords: ["sustainability", "climate", "ethical", "eco", "circular economy", "green", "planet", "conscious"],
    categories: ["events", "holidays"],
    primaryAudience: ["gen-z", "millennial"],
    adjacentAudiences: {}
  },
  {
    id: "parenting-milestones",
    name: "Parenting & Milestones",
    description: "Life-stage moments around pregnancy, first years, and family milestone rituals.",
    seedKeywords: ["parenting", "baby", "pregnancy", "toddler", "milestone", "first day", "nursery", "weaning"],
    categories: ["holidays", "events"],
    primaryAudience: ["parent", "millennial"],
    adjacentAudiences: {
      "gen-z": "GenZ is the fastest-growing new parent cohort in the UK — 19% of 22-27 year olds identify as parents or expecting. High-intent audience for early-stage parenting and home brands. [Demo GWI data]"
    }
  },
  {
    id: "motorsport-auto",
    name: "Motorsport & Auto Culture",
    description: "Race weekends, car launches, and automotive enthusiasm culture.",
    seedKeywords: ["formula 1", "motorsport", "racing", "car launch", "grand prix", "automotive", "track day", "rally"],
    categories: ["sports", "events"],
    primaryAudience: ["millennial", "gen-x", "gen-z"],
    adjacentAudiences: {}
  },
  {
    id: "comedy-entertainment",
    name: "Comedy & Light Entertainment",
    description: "Stand-up tours, comedy specials, panel shows, and laughter-led cultural participation.",
    seedKeywords: ["comedy", "stand-up", "comedian", "panel show", "funny", "sketch", "satire", "podcast"],
    categories: ["events", "film"],
    primaryAudience: ["millennial", "gen-z", "gen-x"],
    adjacentAudiences: {}
  },
  {
    id: "pets-animals",
    name: "Pets & Animals",
    description: "Pet ownership culture, animal content virality, and welfare awareness moments.",
    seedKeywords: ["pets", "dog", "cat", "animal", "puppy", "rescue", "vet", "pet owner"],
    categories: ["events", "holidays"],
    primaryAudience: ["millennial", "gen-z", "gen-x"],
    adjacentAudiences: {}
  },
  {
    id: "education-careers",
    name: "Education & Careers",
    description: "Key calendar beats around exam results, university, career transitions, and upskilling.",
    seedKeywords: ["education", "university", "exam results", "career", "graduate", "apprenticeship", "upskilling", "back to school"],
    categories: ["events", "holidays"],
    primaryAudience: ["gen-z", "student"],
    adjacentAudiences: {
      "millennial": "Career transitioners and upskilling cohort growing in 30-38 bracket — professional development search intent up +28% YoY. [Demo GWI data]"
    }
  },
  {
    id: "cricket-rugby",
    name: "Cricket & Rugby Culture",
    description: "Test matches, Six Nations, World Cup cycles, and traditional sport fandom in the UK.",
    seedKeywords: ["cricket", "rugby", "six nations", "test match", "ashes", "world cup rugby", "try", "wicket"],
    categories: ["sports", "events"],
    primaryAudience: ["millennial", "gen-x", "boomer"],
    adjacentAudiences: {
      "gen-z": "T20 cricket and Gallagher Premiership rugby driving GenZ fanbase growth up +24% YoY — emerging but not yet core. [Demo GWI data]"
    }
  }
];

