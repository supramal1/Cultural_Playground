/**
 * Audience profiles per playground.
 * All data is SYNTHETIC DEMO DATA for UX validation purposes.
 * Replace with live GWI / YouGov exports before client use.
 */

export type MediaTargeting = {
  platform: string;
  signals: string[];
};

export type MediaOwnerRecommendation = {
  name: string;
  rationale: string;
  formats: string[];
};

export type AudienceProfile = {
  headline: string;
  description: string;
  demographics: {
    age: string;
    skew: string;
    lifestage: string[];
  };
  targeting: MediaTargeting[];
  watching: string[];
  listening: string[];
  events: string[];
  platforms: string[];
  mediaOwners: MediaOwnerRecommendation[];
  plannerNote?: string;
};

export const AUDIENCE_PROFILES: Record<string, AudienceProfile> = {
  "travel-experiences": {
    headline: "Active experience-seekers and social planners",
    description:
      "Digital-native planners researching and booking breaks primarily on mobile. Motivated by new experiences over material goods — prioritising value without sacrificing quality. Heavy TikTok and Instagram travel content consumers who travel 2–4 times per year and use peer recommendation as their primary discovery channel.",
    demographics: {
      age: "22–35, core 22–28",
      skew: "Slight female skew (55/45)",
      lifestage: ["Students", "Early career", "New renters", "Young couples"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: [
          "Travel Planners",
          "City Break Enthusiasts",
          "Budget Travel",
          "Short Breaks (UK)",
          "Airbnb (Interest)",
          "Hostel & Budget Accommodation"
        ]
      },
      {
        platform: "Google",
        signals: [
          "Travel Intenders",
          "Budget Travel Enthusiasts",
          "City Break Planners",
          "Accommodation Seekers",
          "International Travel"
        ]
      },
      {
        platform: "TikTok",
        signals: [
          "Travel & Experiences",
          "City Break Hacks",
          "Budget Travel Tips",
          "Solo Travel",
          "Travel Vlogging"
        ]
      },
      {
        platform: "Programmatic",
        signals: [
          "IAB — Travel",
          "IAB — Accommodations, Hotels & Motels",
          "IAB — Air Travel",
          "IAB — Budget Travel"
        ]
      }
    ],
    watching: [
      "The White Lotus",
      "Race Across the World",
      "Selling Sunset Abroad",
      "An Idiot Abroad (rewatching)",
      "Stanley Tucci: Searching for Italy",
      "Planet Earth III"
    ],
    listening: [
      "Pop / Afrobeats / Indie",
      "Dua Lipa, Bad Bunny, Tame Impala",
      "The Tortoise Podcast",
      "Armchair Expert",
      "Travel-led Spotify editorial playlists"
    ],
    events: [
      "Wilderness Festival",
      "Glastonbury",
      "Food & travel markets (Borough, Maltby St)",
      "Gallery private views",
      "Pop-up experiences / immersive dining",
      "Youth hostel socials"
    ],
    platforms: ["TikTok", "Instagram", "YouTube", "Google Maps", "Airbnb app", "Spotify"],
    mediaOwners: [
      { name: "TikTok", rationale: "Primary travel discovery and inspiration platform for 18–28", formats: ["In-Feed Ads", "Creator Partnerships", "Branded Effects", "TopView"] },
      { name: "YouTube", rationale: "Long-form travel vlogs and trip planning content — pre-roll around travel channels", formats: ["Pre-roll", "Branded Content", "YouTube Select"] },
      { name: "Spotify", rationale: "Travel playlist context — high-intent listening during commutes and trips", formats: ["Audio Ads", "Playlist Takeover", "Podcast Sponsorship"] },
      { name: "Snap", rationale: "City discovery and story formats aligned with short-break spontaneity", formats: ["Snap Ads", "AR Lenses", "Story Ads"] },
      { name: "Time Out", rationale: "City editorial authority — trusted recommendations for city break audiences", formats: ["Display", "Editorial Integration", "City Guides Sponsorship"] }
    ],
    plannerNote:
      "High search intent — this audience actively researches before booking. Capture in-market moments with search + social retargeting combo."
  },

  "family-kids": {
    headline: "Family planners — Millennial parents and school-calendar driven",
    description:
      "Primary audience is Millennial parents (28–40) with children under 12, planning around school terms, half-terms, and summer holidays. Highly organised, budget-conscious, and heavily influenced by other parents online. Peak planning moments are 8–12 weeks before school holidays.",
    demographics: {
      age: "28–42, core 30–38",
      skew: "Female skew (62/38)",
      lifestage: ["Parents of under-12s", "Dual income households", "Suburban / commuter belt"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: [
          "Parents of Young Children",
          "Family Activities",
          "School Holiday Planning",
          "Days Out with Kids",
          "Disney+ Subscribers",
          "Family Holidays (UK)"
        ]
      },
      {
        platform: "Google",
        signals: [
          "Family Travel Intenders",
          "In-Market: Family Holidays",
          "Parents of Children 5–12",
          "Theme Park Visitors"
        ]
      },
      {
        platform: "TikTok",
        signals: [
          "Parenting & Family",
          "Family Days Out",
          "Kids Activities",
          "Mum/Dad Content"
        ]
      },
      {
        platform: "Programmatic",
        signals: [
          "IAB — Parenting",
          "IAB — Family & Parenting",
          "IAB — Children's Entertainment",
          "IAB — Travel — Family Vacations"
        ]
      }
    ],
    watching: [
      "Disney+ originals",
      "Bluey",
      "The Bear (evening, post-bedtime)",
      "Strictly Come Dancing",
      "This Is Us",
      "Family animated films"
    ],
    listening: [
      "Pop / Easy listening",
      "Taylor Swift, Ed Sheeran, Adele",
      "Kids' playlist on Spotify/Apple Music",
      "Parenting Junkie Podcast",
      "My Therapist Ghosted Me"
    ],
    events: [
      "Half-term theme park visits (Legoland, Alton Towers)",
      "CBeebies shows / theatre",
      "National Trust days out",
      "School fetes and fairs",
      "Christmas panto",
      "Summer holiday clubs"
    ],
    platforms: ["Facebook", "Instagram", "Pinterest", "YouTube (Kids)", "Mumsnet", "WhatsApp Groups"],
    mediaOwners: [
      { name: "Disney+", rationale: "Dominant family streaming platform — brand safe, high attention, premium context", formats: ["Pre-roll", "Branded Integration", "IP Partnership"] },
      { name: "ITV / ITVX", rationale: "Broad family primetime — Saturday night formats and school holiday programming", formats: ["Linear Sponsorship", "BVOD Pre-roll", "Content Partnerships"] },
      { name: "YouTube Kids", rationale: "Primary viewing environment for under-10s — parent-supervised, high frequency", formats: ["In-Stream Ads", "Channel Sponsorship", "Bumper Ads"] },
      { name: "Mumsnet", rationale: "Highest-trust parenting recommendation environment in the UK", formats: ["Display", "Content Sponsorship", "Forum Integration", "Newsletter"] },
      { name: "CBeebies / BBC One", rationale: "Unrivalled for under-7 attention — Saturday morning and school holiday programming", formats: ["Linear Sponsorship", "iPlayer Pre-roll"] }
    ],
    plannerNote:
      "This playground's PRIMARY audience is Millennial parents. If your brief targets GenZ, treat this as an adjacent/high-growth play — GenZ (23-27) are entering parenthood at pace and also over-index on family nostalgia IP (Disney+, Pixar, Ghibli). [Demo GWI data]"
  },

  "creator-internet-culture": {
    headline: "Online-native trend followers and content participants",
    description:
      "Highly engaged with creator content across TikTok, YouTube, and Twitch. They don't just consume — they participate: reposting, remixing, and contributing to trend cycles. First adopters of new formats and memes. Strong community affiliation online, often organised around shared niche interests.",
    demographics: {
      age: "16–30, core 18–25",
      skew: "Balanced, slight male skew in gaming/esports crossover",
      lifestage: ["Gen Z", "Students", "Entry-level employment", "Living at home or first flat"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: [
          "Content Creators",
          "Social Media Enthusiasts",
          "Internet Culture",
          "Meme Pages",
          "Online Communities",
          "Viral Video Viewers"
        ]
      },
      {
        platform: "Google",
        signals: [
          "Social Media Enthusiasts",
          "Online Video Enthusiasts",
          "Avid Gamers (crossover)",
          "News & Current Events (via memes)"
        ]
      },
      {
        platform: "TikTok",
        signals: [
          "Internet Culture",
          "Viral Trends",
          "Fan Communities",
          "Creator Economy",
          "Comedy & Entertainment"
        ]
      },
      {
        platform: "Programmatic",
        signals: [
          "IAB — Social Media",
          "IAB — Online Communities",
          "IAB — Humor",
          "IAB — Pop Culture"
        ]
      }
    ],
    watching: [
      "YouTube creators (MrBeast, NightOwl, Sidemen)",
      "Twitch streams",
      "TikTok LIVE",
      "Netflix docu-series",
      "The Joe Rogan Experience (video)",
      "Short-form vertical content"
    ],
    listening: [
      "Hyperpop, PC Music, UK Rap",
      "Central Cee, Dave, Ice Spice",
      "Podcast: Impaulsive, OOTW, Diary of a CEO",
      "Algorithm-driven Spotify Discover Weekly",
      "Bedroom pop / indie sleaze revival"
    ],
    events: [
      "Creator conventions (VidCon UK, Summer in the City)",
      "Brand activation pop-ups",
      "Sneaker / streetwear drops",
      "Gaming expos (EGX)",
      "Immersive brand experiences"
    ],
    platforms: ["TikTok", "YouTube", "Instagram", "Twitch", "Discord", "Reddit", "X / Twitter"],
    mediaOwners: [
      { name: "TikTok", rationale: "Epicentre of creator and internet culture — native format ads vs. interruptive", formats: ["In-Feed Ads", "Creator Partnerships", "Branded Challenges", "TopView"] },
      { name: "YouTube", rationale: "Long-form creator ecosystem — pre-roll around channels this audience consumes daily", formats: ["Pre-roll", "YouTube Select", "Branded Content"] },
      { name: "Twitch", rationale: "Live streaming authority — host-read sponsorships carry the highest trust in this space", formats: ["Host-Read Sponsorships", "Pre-roll", "Branded Panels"] },
      { name: "Snapchat", rationale: "Highly engaged with Discover and Spotlight — strong 18–25 reach", formats: ["Snap Ads", "Discover Placements", "AR Lenses"] },
      { name: "Reddit", rationale: "Community-native advertising — subreddit targeting for niche audience precision", formats: ["Promoted Posts", "Display", "AMA Sponsorships"] }
    ],
    plannerNote:
      "Activation should feel native to platform culture — ads that look like ads are ignored. Creator partnerships and format-led executions outperform standard display here."
  },

  "film-tv-fandom": {
    headline: "Engaged streaming audiences and franchise devotees",
    description:
      "Multi-platform viewers combining Netflix, Disney+, and theatrical releases with deep franchise investment. Often organised in fan communities online, following cast culture, trailer drops, and behind-the-scenes content. Willing to travel for premieres and immersive brand extensions of IP they love.",
    demographics: {
      age: "18–40, broad range with strong 18–28 core",
      skew: "Slight female skew in drama/romance, slight male skew in superhero/sci-fi",
      lifestage: ["Students", "Early career", "Millennials", "Couples"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: [
          "Movie Enthusiasts",
          "TV Drama Fans",
          "Marvel / DC (Interest)",
          "Netflix Subscribers",
          "Cinema-goers",
          "Streaming Services"
        ]
      },
      {
        platform: "Google",
        signals: [
          "Movie Lovers",
          "TV & Video Enthusiasts",
          "Streaming Service Users",
          "Box Office Followers"
        ]
      },
      {
        platform: "TikTok",
        signals: [
          "Film & TV",
          "BookTok (crossover)",
          "Celebrity & Pop Culture",
          "Behind-the-Scenes Content"
        ]
      },
      {
        platform: "Programmatic",
        signals: [
          "IAB — Movies",
          "IAB — Television",
          "IAB — Entertainment",
          "IAB — Celebrity Fan/Gossip"
        ]
      }
    ],
    watching: [
      "The Bear",
      "Succession (rewatching)",
      "Dune: Part Two",
      "House of the Dragon",
      "Bridgerton",
      "Marvel/DC theatrical releases"
    ],
    listening: [
      "Film/TV soundtrack playlists (Spotify)",
      "Score composers (Hans Zimmer, Ludwig Göransson)",
      "Happy Sad Confused Podcast",
      "Empire Film Podcast",
      "Pop/R&B — chart-driven"
    ],
    events: [
      "Film premieres and press screenings",
      "Comic-Con / MCM London",
      "BFI London Film Festival",
      "Immersive cinema experiences (Secret Cinema)",
      "Odeon / Vue special screenings"
    ],
    platforms: ["Netflix", "Disney+", "Instagram", "YouTube", "Reddit (film subreddits)", "Letterboxd"],
    mediaOwners: [
      { name: "Sky / Now TV", rationale: "Premium drama and theatrical windows — contextually adjacent to the content this audience loves", formats: ["BVOD Pre-roll", "Linear Sponsorship", "Sky Cinema Integration"] },
      { name: "Channel 4 / ITVX", rationale: "Broad streaming reach for younger drama audiences — strong BVOD targeting", formats: ["BVOD Pre-roll", "Linear Sponsorship", "Content Partnerships"] },
      { name: "YouTube", rationale: "Trailer reaction and fan content — pre-roll around film channels drives purchase intent", formats: ["Pre-roll", "YouTube Select", "Masthead"] },
      { name: "Vue / Odeon / Cineworld", rationale: "Cinema advertising delivers undivided attention in context — high dwell for brand-building", formats: ["On-Screen Pre-show", "Lobby Activation", "Co-branded Promotions"] },
      { name: "Empire / Total Film", rationale: "Authoritative editorial for franchise and film audiences — display and native", formats: ["Display", "Newsletter Sponsorship", "Editorial Integration"] }
    ],
    plannerNote:
      "Premium BVOD (ITVX, Channel 4 VOD, Sky) is strong here — contextually adjacent to the content they're consuming. Cinema pre-roll also over-indexes."
  },

  "football-culture": {
    headline: "Passionate club fans embedded in football's cultural fabric",
    description:
      "Beyond matchday — this audience engages with football as a lifestyle: transfer news, kit culture, FIFA/FC25, podcasts, and social banter. Club loyalty is identity, not just sport. Highly reactive to live moments — social spikes around goals, results, and team news.",
    demographics: {
      age: "16–45, core 18–35",
      skew: "Strong male skew (72/28), female audience growing via WSL",
      lifestage: ["Students", "Working adults", "Fathers", "Broad socioeconomic range"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: [
          "Football Fans",
          "Premier League",
          "Champions League",
          "Specific club pages (Arsenal, Liverpool, Man City etc.)",
          "FIFA / EA Sports FC",
          "Fantasy Premier League"
        ]
      },
      {
        platform: "Google",
        signals: [
          "Sports Fans",
          "Football News Readers",
          "Live Sports Streaming",
          "Sports Betting (adjacent, flag for brand safety)"
        ]
      },
      {
        platform: "TikTok",
        signals: [
          "Football",
          "Premier League Highlights",
          "Sports Commentary",
          "Football Culture"
        ]
      },
      {
        platform: "Programmatic",
        signals: [
          "IAB — Soccer",
          "IAB — Sports",
          "Contextual: football news sites (BBC Sport, Sky Sports, The Athletic)"
        ]
      }
    ],
    watching: [
      "Premier League (Sky Sports, TNT Sports)",
      "Champions League",
      "Match of the Day",
      "Ted Lasso",
      "Sunderland 'Til I Die",
      "FC25 streams on Twitch/YouTube"
    ],
    listening: [
      "UK Rap, Grime, Afrobeats",
      "Drake, Central Cee, Stormzy",
      "The Overlap Podcast (Gary Neville)",
      "Football Ramble",
      "Quickly Kevin, Will He Score?"
    ],
    events: [
      "Premier League matchdays",
      "Champions League finals",
      "World Cup / Euros fan zones",
      "Club kit launches",
      "EFL & grassroots fixtures"
    ],
    platforms: ["X / Twitter", "Instagram", "YouTube", "TikTok", "Reddit (r/soccer, club subreddits)", "WhatsApp"],
    mediaOwners: [
      { name: "Sky Sports", rationale: "Dominant live football rights — Premier League, Champions League, peak engagement moments", formats: ["Linear Sponsorship", "BVOD Pre-roll", "Live Match Idents"] },
      { name: "TNT Sports / BT Sport", rationale: "UEFA rights and Europa League — premium live context for high-value football moments", formats: ["Linear Sponsorship", "Live Match Adjacency"] },
      { name: "BBC Sport", rationale: "Match of the Day and highlights — broad reach, trusted editorial, free-to-air", formats: ["Editorial Integration", "iPlayer Pre-roll", "BBC Sport App"] },
      { name: "talkSPORT", rationale: "Loyal male football audience — radio and podcast adjacency with high frequency", formats: ["Live Radio Ads", "Podcast Sponsorship", "Branded Segments"] },
      { name: "The Athletic", rationale: "High-engagement subscription journalism — deeply invested fan readership", formats: ["Display", "Newsletter Sponsorship", "Content Partnerships"] }
    ],
    plannerNote:
      "Live moments drive 3–5x engagement uplift. Plan for reactive content and real-time paid social around matchday, transfer deadline day, and results."
  },

  "gaming-esports": {
    headline: "Platform-native gamers embedded in play culture",
    description:
      "Gaming is the social network for this audience — Discord servers and in-game chat replace group chats. Highly engaged with streamer culture on Twitch and YouTube. Not passive consumers; they play, watch, and talk about gaming simultaneously. Esports events are the live sport equivalent.",
    demographics: {
      age: "16–32, core 18–27",
      skew: "Male skew (68/32), female audience growing in mobile/casual",
      lifestage: ["Gen Z", "Students", "Early career", "Living at home"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: ["Video Gaming", "Esports", "PC Gaming", "Console Gaming", "Twitch", "Streaming Video Games"]
      },
      {
        platform: "Google",
        signals: ["Avid Gamers", "Technophiles", "Mobile Gaming Enthusiasts", "Esports Fans"]
      },
      {
        platform: "TikTok",
        signals: ["Gaming", "Esports", "Streamer Content", "Game Reviews", "FPS / Battle Royale"]
      },
      {
        platform: "Programmatic",
        signals: ["IAB — Video & Computer Games", "IAB — Esports", "Contextual: IGN, Eurogamer, GamesRadar"]
      }
    ],
    watching: ["Twitch streams", "YouTube gaming channels", "Esports tournament streams", "Arcane (Netflix)", "The Last of Us"],
    listening: ["Lo-fi / gaming focus playlists", "Electronic / EDM", "Podcast: The Game Awards, Easy Allies", "NF, Linkin Park (gaming nostalgia)"],
    events: ["EGX (London)", "ESL One", "IEM tournaments", "Insomnia Gaming Festival", "Local LAN events"],
    platforms: ["Twitch", "Discord", "YouTube", "Reddit", "Steam", "TikTok"],
    mediaOwners: [
      { name: "Twitch", rationale: "Live gaming's home — host-read sponsorships and activations are the most native format", formats: ["Host-Read Sponsorships", "Display (Panels)", "Pre-roll", "Branded Events"] },
      { name: "YouTube Gaming", rationale: "Video gaming content hub — pre-roll around gameplay channels reaches high-intent audiences", formats: ["Pre-roll", "In-Video Sponsorships", "YouTube Select Gaming"] },
      { name: "IGN / Eurogamer", rationale: "Authoritative gaming editorial — display and native in review/preview context drives purchase", formats: ["Display", "Native Content", "Newsletter Sponsorship"] },
      { name: "Xbox / PlayStation Network", rationale: "In-console advertising — reaches players in an active gaming state", formats: ["In-Console Ads", "Network Sponsorships", "Game Pass Integration"] },
      { name: "Discord", rationale: "Community server sponsorships — native to how this audience communicates and organises", formats: ["Server Partnerships", "Activity Ads", "Sponsored Communities"] }
    ],
    plannerNote: "In-game advertising and Twitch sponsorships are endemic here. Standard display is low-attention — native formats within gaming environments perform significantly better."
  },

  "music-fandom": {
    headline: "Deeply invested music fans and live experience seekers",
    description:
      "Music is identity for this audience — genre, artist loyalty, and gig-going define their social circle and self-expression. Playlist culture and algorithmic discovery (Spotify, Apple Music) sit alongside deliberate artist fandom. High willingness to spend on tickets, merch, and vinyl.",
    demographics: {
      age: "16–35, spread across subcultures",
      skew: "Slight female skew in pop/R&B, balanced in indie/alternative",
      lifestage: ["Students", "Early career", "Young professionals", "Subculture-defined"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: ["Music Fans", "Concert & Live Events", "Spotify / Apple Music Users", "Festival-goers", "Specific artist pages"]
      },
      {
        platform: "Google",
        signals: ["Music Lovers", "Concert Ticket Buyers", "Live Events Enthusiasts"]
      },
      {
        platform: "TikTok",
        signals: ["Music Discovery", "Artist Fandom", "Concert Content", "Music Challenges"]
      },
      {
        platform: "Programmatic",
        signals: ["IAB — Music & Audio", "IAB — Concerts & Music Events", "Contextual: NME, Pitchfork, Clash"]
      }
    ],
    watching: ["Concert films (Taylor Swift: Eras Tour)", "Music documentaries (Netflix)", "SNL performances", "BRIT Awards", "Glastonbury BBC coverage"],
    listening: ["Genre-spanning — pop, R&B, indie, grime", "Beyoncé, Taylor Swift, Fred again.., Jamie xx", "New Music Friday", "Spotify DJ / editorial playlists"],
    events: ["Glastonbury", "Reading & Leeds", "Wireless Festival", "Printworks / Fabric club nights", "Album launch events", "Intimate venue gigs"],
    platforms: ["Spotify", "Instagram", "TikTok", "YouTube", "Bandcamp", "Songkick / Ticketmaster app"],
    mediaOwners: [
      { name: "Spotify", rationale: "Primary audio and discovery platform — playlist takeovers and podcast ads reach listeners in moment", formats: ["Audio Ads", "Playlist Sponsorship", "Podcast Ads", "Branded Playlists"] },
      { name: "Apple Music", rationale: "Premium music streaming — curated editorial adjacency and genre-first audience segments", formats: ["Editorial Placement", "Sponsored Playlists"] },
      { name: "YouTube Music", rationale: "Music video streaming — pre-roll around official artist channels at peak fan engagement", formats: ["Pre-roll", "Masthead", "Artist Channel Partnerships"] },
      { name: "Live Nation / Ticketmaster", rationale: "Festival and event sponsorships — direct reach to high-intent gig-going audiences", formats: ["Festival Sponsorship", "Ticketing Integration", "Email Marketing"] },
      { name: "NME / Pitchfork", rationale: "Credible music editorial authority — trusted environment for music-led brand positioning", formats: ["Display", "Editorial Integration", "Newsletter"] }
    ],
    plannerNote: "Spotify audio ads and playlist sponsorships are native here. Festival brand partnerships with genuine creative integration outperform standard OOH at events."
  },

  "wellness-fitness": {
    headline: "Routine-driven wellness seekers balancing body and mind",
    description:
      "This audience has integrated fitness into daily identity — not a resolution, a lifestyle. Gym culture, running communities, and yoga studios are social as much as physical. Growing interest in recovery, sleep, and mental health alongside physical performance. Strong brand loyalty to functional products that genuinely perform.",
    demographics: {
      age: "24–40, core 26–35",
      skew: "Female skew in yoga/wellness, balanced in gym/running",
      lifestage: ["Young professionals", "Millennials", "Health-conscious parents"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: ["Fitness & Wellness", "Running", "Yoga Enthusiasts", "Gym Goers", "Healthy Lifestyle", "Mental Wellness"]
      },
      {
        platform: "Google",
        signals: ["Fitness Enthusiasts", "Health & Fitness App Users", "Running Gear Shoppers", "Nutrition Interest"]
      },
      {
        platform: "TikTok",
        signals: ["FitTok", "Wellness", "Running", "Mental Health", "Gym Content"]
      },
      {
        platform: "Programmatic",
        signals: ["IAB — Fitness & Exercise", "IAB — Healthy Living", "IAB — Running & Jogging"]
      }
    ],
    watching: ["Stanley Tucci (aspirational living adjacent)", "Netflix health documentaries", "Apple Fitness+ content", "Strava social feed"],
    listening: ["Running playlists (EDM, hip-hop tempo)", "Feel Better, Live More (Dr Rangan Chatterjee)", "Whoop Podcast", "Fearne Cotton's Happy Place"],
    events: ["Parkrun (weekly)", "London / Manchester Marathon", "Hyrox", "Wilderness wellness retreats", "Yoga festivals"],
    platforms: ["Strava", "Instagram", "TikTok", "YouTube", "Whoop / Garmin apps", "MyFitnessPal"],
    mediaOwners: [
      { name: "Meta / Instagram", rationale: "Primary visual discovery platform — FitTok-adjacent content and targeted fitness segments", formats: ["Stories", "Reels", "In-Feed", "Creator Partnerships"] },
      { name: "YouTube", rationale: "Workout and wellness video content — pre-roll around fitness channels delivers contextual reach", formats: ["Pre-roll", "YouTube Select Health", "Branded Content"] },
      { name: "Strava", rationale: "Social fitness platform — segment challenges and brand activation reach active users mid-goal", formats: ["Segment Challenges", "In-App Ads", "Club Sponsorships"] },
      { name: "Men's Health / Women's Health", rationale: "Trusted fitness editorial — display and native in credible, relevant content context", formats: ["Display", "Native Content", "Newsletter Sponsorship"] },
      { name: "Whoop / Garmin", rationale: "Fitness tracking platform — in-app reach to health-committed audience in measurement mindset", formats: ["In-App Partnerships", "Branded Insights", "Push Notifications"] }
    ],
    plannerNote: "Strava segments and fitness app integrations drive high-intent reach. Partnership with run clubs (e.g. LNDR, Tracksmith) gives credibility over pure paid."
  },

  "fashion-beauty": {
    headline: "Trend-led style seekers and beauty community participants",
    description:
      "This audience shops frequently and discovers via social content — TikTok hauls, Instagram edits, and YouTube tutorials are primary influence channels. Beauty is the entry point: high-frequency purchases with strong loyalty to brands that feel authentic to creator culture. Sustainability claims are scrutinised — show don't tell.",
    demographics: {
      age: "16–32, core 18–26",
      skew: "Strong female skew (76/24)",
      lifestage: ["Gen Z", "Students", "Early career", "Fashion / beauty community members"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: ["Fashion Enthusiasts", "Beauty Enthusiasts", "Online Shoppers", "Makeup Artists (Interest)", "Skincare Routines", "ASOS / Zara / Shein shoppers"]
      },
      {
        platform: "Google",
        signals: ["Beauty Product Shoppers", "Fashion Shoppers", "Luxury Shoppers (aspirational tier)", "Skincare Enthusiasts"]
      },
      {
        platform: "TikTok",
        signals: ["Beauty", "Skincare", "Fashion Hauls", "GRWM Content", "Outfit of the Day"]
      },
      {
        platform: "Programmatic",
        signals: ["IAB — Beauty", "IAB — Fashion", "IAB — Skin Care", "Contextual: Vogue, Glamour, Who What Wear"]
      }
    ],
    watching: ["Next in Fashion", "The Devil Wears Prada (repeat)", "Emily in Paris", "RuPaul's Drag Race", "Beauty YouTube (NikkieTutorials, James Charles)"],
    listening: ["Pop / R&B / Dance", "Charli XCX, SZA, Chappell Roan", "Getting Curious with Jonathan Van Ness", "The Beauty Boss Podcast"],
    events: ["London Fashion Week (shows & street style)", "Stylist Live", "Selfridges beauty launches", "Brand pop-ups / photobooth activations", "ASOS student events"],
    platforms: ["TikTok", "Instagram", "Pinterest", "YouTube", "Depop", "ASOS / Zara apps"],
    mediaOwners: [
      { name: "TikTok", rationale: "Fashion and beauty's biggest discovery engine — hauls, GRWM, and trend content are the native format", formats: ["In-Feed Ads", "Creator Partnerships", "Branded Hashtag Challenges"] },
      { name: "Instagram", rationale: "Visual commerce platform — Shopping ads, Stories, and Reels drive discovery to purchase", formats: ["Stories", "Reels", "Shopping Ads", "Creator Partnerships"] },
      { name: "YouTube", rationale: "Tutorial and review content — pre-roll around beauty channels delivers high-intent reach", formats: ["Pre-roll", "Branded Content", "YouTube Select Beauty"] },
      { name: "Vogue / Elle / Glamour", rationale: "Premium fashion editorial — display and native in authoritative luxury context", formats: ["Display", "Native Content", "Newsletter", "Digital Cover Sponsorship"] },
      { name: "ASOS / NET-A-PORTER Media", rationale: "Shoppable editorial environments — high-intent audiences actively browsing and buying", formats: ["Editorial Placement", "Sponsored Products", "Email Takeover"] }
    ],
    plannerNote: "Creator-led content outperforms brand-direct by 3–4x in this space. Seed micro-creators (10K–100K) for authenticity; use mid-tier for reach."
  },

  "food-drink": {
    headline: "Social diners and food-trend explorers",
    description:
      "Food is a social occasion and a content format — this audience documents meals, follows food creators, and uses TikTok as a restaurant recommendation engine. Strong preference for independent restaurants, global cuisine, and new openings over chains. Drinks occasions (bottomless, cocktail bars) are key social anchors.",
    demographics: {
      age: "22–40, broad with strong 24–34 core",
      skew: "Slight female skew in brunch/cocktail content, balanced in food overall",
      lifestage: ["Young professionals", "Millennials", "Urban dwellers", "Couples and friend groups"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: ["Foodies", "Restaurant Enthusiasts", "Cooking (Interest)", "Brunch Culture", "Food Photography", "Delivery Apps"]
      },
      {
        platform: "Google",
        signals: ["Food & Dining Enthusiasts", "Restaurant Visitors", "Cooking Enthusiasts", "Craft Beer & Wine Lovers"]
      },
      {
        platform: "TikTok",
        signals: ["FoodTok", "Restaurant Recommendations", "Recipe Content", "Drinks & Cocktails"]
      },
      {
        platform: "Programmatic",
        signals: ["IAB — Food & Drink", "IAB — Restaurants", "IAB — Cooking & Recipes"]
      }
    ],
    watching: ["The Bear", "Chef's Table", "Salt Fat Acid Heat", "Stanley Tucci: Searching for Italy", "MasterChef"],
    listening: ["Background / mood playlists", "Grounded with Louis Theroux", "Bon Appétit Podcast", "Comfort pop / jazz / lounge"],
    events: ["Taste of London", "Street food markets (Kerb, Dinerama)", "Restaurant opening nights", "Bottomless brunch occasions", "Wine & dine experiences"],
    platforms: ["Instagram", "TikTok", "Google Maps", "OpenTable / Resy", "Deliveroo / Uber Eats"],
    mediaOwners: [
      { name: "Instagram / Meta", rationale: "Food content's primary social platform — restaurant discovery, recipes, and food creator hauls", formats: ["In-Feed", "Stories", "Reels", "Creator Partnerships"] },
      { name: "YouTube", rationale: "Cooking tutorials and restaurant review content — pre-roll in endemic food channels", formats: ["Pre-roll", "YouTube Select Food", "Branded Content"] },
      { name: "Time Out", rationale: "City restaurant and bar authority — editorial reach to food-focused urban audiences", formats: ["Display", "Editorial Integration", "Restaurant Guides Sponsorship"] },
      { name: "Deliveroo / Uber Eats", rationale: "In-app advertising reaches high-intent food occasion moments — real-time targeting", formats: ["In-App Ads", "Sponsored Restaurants", "Push Notifications"] },
      { name: "BBC Good Food / Delicious", rationale: "Trusted recipe editorial — display and native reach recipe-searching audiences in context", formats: ["Display", "Native Content", "Recipe Sponsorship"] }
    ],
    plannerNote: "OOH near transport hubs and restaurant districts works well. Social proof via creator reviews drives bookings — partner with local food micro-creators for endemic reach."
  },

  "tech-gadgets": {
    headline: "Early adopters and considered tech purchasers",
    description:
      "Research-heavy purchasers who read every review before buying. YouTube unboxings and tech channels are primary influence. Interested in AI tools, smart home, and the next generation of devices. Will pay a premium for genuine innovation but highly sceptical of marketing claims — specs and honest reviews matter.",
    demographics: {
      age: "18–40, core 22–35",
      skew: "Male skew (65/35)",
      lifestage: ["Students", "Tech workers", "Early career professionals", "Gadget enthusiasts"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: ["Technology Enthusiasts", "Consumer Electronics", "Smartphones", "Smart Home", "AI Tools & Apps"]
      },
      {
        platform: "Google",
        signals: ["Technophiles", "Consumer Electronics Shoppers", "Mobile Enthusiasts", "Computer Enthusiasts"]
      },
      {
        platform: "TikTok",
        signals: ["Tech Reviews", "New Gadgets", "AI Tools", "Phone Comparisons"]
      },
      {
        platform: "Programmatic",
        signals: ["IAB — Consumer Electronics", "IAB — Computers & Peripherals", "Contextual: The Verge, TechRadar, Wired UK"]
      }
    ],
    watching: ["MKBHD (YouTube)", "Linus Tech Tips", "Black Mirror", "Silicon Valley (rewatch)", "Tech product launches (Apple Event streams)"],
    listening: ["Darknet Diaries", "Lex Fridman Podcast", "Hard Fork (NYT)", "Electronic / ambient focus music"],
    events: ["CES (Vegas, following online)", "Apple / Google product launches", "Tech meetups / hackathons", "London Tech Week"],
    platforms: ["YouTube", "Reddit (r/technology, r/gadgets)", "Twitter/X", "Hacker News", "LinkedIn"],
    mediaOwners: [
      { name: "YouTube", rationale: "Tech review and unboxing ecosystem — pre-roll around MKBHD, Linus, and category channels", formats: ["Pre-roll", "YouTube Select Tech", "In-Video Sponsorships"] },
      { name: "The Verge / Wired UK", rationale: "Authoritative tech editorial — native and display reach research-phase purchasers", formats: ["Display", "Native Content", "Newsletter Sponsorship"] },
      { name: "Reddit", rationale: "r/technology, r/gadgets — community-native promoted posts reach high-intent researchers", formats: ["Promoted Posts", "Display", "AMA Sponsorships"] },
      { name: "Twitter / X", rationale: "Real-time tech conversation — launch adjacency for product moment reach", formats: ["Promoted Trends", "Conversation Ads", "Launch Takeovers"] },
      { name: "Amazon", rationale: "Purchase-intent advertising — DSP and Sponsored Products reach buyers at point of decision", formats: ["Sponsored Products", "Amazon DSP", "Video Ads"] }
    ],
    plannerNote: "YouTube pre-roll around tech review content is the most contextually targeted placement available. Reviews and comparison content drive purchase intent far more than brand ads."
  },

  "home-diy": {
    headline: "Aspirational homemakers and first-time improvers",
    description:
      "Driven by the aspiration to make their space feel like their own — whether renting or owning. Heavy Pinterest and Instagram saves, YouTube tutorials for DIY projects, and weekend visits to B&Q and independent homeware shops. Spending patterns peak around seasonal moments: January (new year, new home), spring, and pre-Christmas.",
    demographics: {
      age: "28–50, core 30–42",
      skew: "Female skew (58/42)",
      lifestage: ["First-time buyers", "Renters improving their space", "Young families", "Upsizing Millennials"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: ["Home Improvement", "Interior Design Enthusiasts", "DIY", "Homeowners", "Garden Enthusiasts", "First Home Buyers"]
      },
      {
        platform: "Google",
        signals: ["Home & Garden Enthusiasts", "DIY Enthusiasts", "Luxury Goods Shoppers (interiors tier)", "Property Owners"]
      },
      {
        platform: "TikTok",
        signals: ["HomeToK", "Interior Design", "DIY Projects", "Renovation Content", "Small Space Living"]
      },
      {
        platform: "Programmatic",
        signals: ["IAB — Home & Garden", "IAB — Interior Design", "IAB — Home Improvement", "Contextual: Homes & Gardens, Ideal Home, Living Etc"]
      }
    ],
    watching: ["The Great Interior Design Challenge", "Selling Sunset", "Queer Eye (home transformations)", "Kirstie & Phil's Love It or List It", "YouTube renovation vlogs"],
    listening: ["Easy listening / Radio 2 style", "How to Fail (Elizabeth Day)", "IKEA playlists (genuinely)", "Home & interiors podcasts (91 Magazine)"],
    events: ["Grand Designs Live", "Chelsea Flower Show", "Ideal Home Show", "Independent homeware markets", "IKEA seasonal events"],
    platforms: ["Pinterest", "Instagram", "YouTube", "Houzz", "Rightmove (aspirational browsing)"],
    mediaOwners: [
      { name: "Pinterest", rationale: "Highest save-rate platform for home inspiration — intent-rich audiences in active planning mode", formats: ["Promoted Pins", "Shopping Ads", "Idea Ads", "Catalogue Ads"] },
      { name: "YouTube", rationale: "DIY tutorial and renovation content — pre-roll in endemic home improvement channels", formats: ["Pre-roll", "YouTube Select Home", "Branded Content"] },
      { name: "Instagram / Meta", rationale: "Visual home content — Reels, Stories, and Shopping ads drive discovery to purchase", formats: ["Reels", "Stories", "Shopping Ads"] },
      { name: "Ideal Home / Homes & Gardens", rationale: "Trusted interiors editorial authority — native and display in aspiration-led content", formats: ["Display", "Native Content", "Featured Project Sponsorship"] },
      { name: "IKEA / B&Q Media", rationale: "Retail media adjacency — reaches home improvement audiences at decision point", formats: ["In-Store Ads", "Digital Retail Media", "Email Campaigns"] }
    ],
    plannerNote: "Pinterest is the highest-intent discovery platform here — save rates are a better signal than clicks. Plan content for the full consideration cycle (6–12 weeks for major purchases)."
  },

  "luxury-premium": {
    headline: "Aspiration-led premium purchasers and status-aware shoppers",
    description:
      "Quality, provenance, and exclusivity are the purchase drivers — not just price. This audience reads the brand story, notices craft details, and expects a seamless premium experience from first touchpoint to unboxing. Cultural credibility (art, fashion weeks, prestige events) is as important as product specification.",
    demographics: {
      age: "30–55 primary, growing 25–35 aspirational tier",
      skew: "Female skew in fashion/beauty luxury, balanced in watches/cars",
      lifestage: ["Senior professionals", "High earners", "Established Millennials", "GenZ aspirational entry-point"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: ["Luxury Goods", "Designer Fashion", "High-End Travel", "Fine Dining", "Luxury Cars"]
      },
      {
        platform: "Google",
        signals: ["Luxury Shoppers", "High-End Retail Customers", "Luxury Travel Intenders", "Frequent Flyers"]
      },
      {
        platform: "TikTok",
        signals: ["Luxury", "Designer Brands", "Fashion Week", "Unboxing Luxury"]
      },
      {
        platform: "Programmatic",
        signals: ["IAB — Luxury", "High Income Audience Segments", "Contextual: Vogue, Tatler, GQ, Wallpaper*"]
      }
    ],
    watching: ["Succession", "The Crown", "Ferrari (Michael Mann film)", "Fashion documentaries (Halston, Valentino)", "Arte / international prestige drama"],
    listening: ["Classical / jazz / ambient", "Monocle Radio", "How I Built This (prestige brand episodes)", "Intelligence Squared"],
    events: ["London Fashion Week", "Frieze Art Fair", "Goodwood Revival", "Henley Regatta", "Private members clubs"],
    platforms: ["Instagram", "LinkedIn", "Monocle", "The FT app", "WhatsApp (private groups)"],
    mediaOwners: [
      { name: "Financial Times", rationale: "Affluent, senior professional readership — premium editorial adjacency for brand authority", formats: ["Display", "Native Content", "Print & Digital Sponsorship"] },
      { name: "Condé Nast (Vogue / Tatler / GQ)", rationale: "Definitive luxury cultural authority — aligned with audience values and aspirations", formats: ["Display", "Editorial Integration", "Event Sponsorship", "Digital Cover"] },
      { name: "Instagram", rationale: "Luxury visual storytelling — precise affluent audience targeting via income/behaviour segments", formats: ["Stories", "In-Feed", "Creator Partnerships (luxury tier)"] },
      { name: "Monocle", rationale: "Highly loyal affluent global readership — print and radio reach senior decision-makers", formats: ["Print Ads", "Radio Sponsorship", "Digital Native"] },
      { name: "The Times / Sunday Times", rationale: "Premium newspaper — weekend supplement adjacency for fashion, luxury, and culture", formats: ["Print", "Digital Display", "The Times Style Sponsorship"] }
    ],
    plannerNote: "Context is everything in luxury — avoid low-quality environments. Premium editorial, private member platforms, and curated OOH (Canary Wharf, Chelsea, Mayfair) protect brand equity."
  },

  "sustainability-purpose": {
    headline: "Values-driven consumers integrating ethics into everyday choices",
    description:
      "Sustainability is a filter, not a feature — this audience makes it a precondition of purchase, not a bonus. Highly research-literate and quick to call out greenwashing. Climate anxiety is real and motivating, not paralysing. Strong community organising online and offline around shared values.",
    demographics: {
      age: "18–38, broad GenZ and Millennial",
      skew: "Female skew (60/40)",
      lifestage: ["Students", "Young professionals", "Parents (eco-conscious family lens)", "Activists"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: ["Environmentalism", "Sustainability", "Ethical Fashion", "Veganism / Plant-Based", "Climate Action", "Circular Economy"]
      },
      {
        platform: "Google",
        signals: ["Green Living", "Eco-Friendly Products", "Sustainable Fashion", "Environmental Issues"]
      },
      {
        platform: "TikTok",
        signals: ["EcoTok", "Sustainability Tips", "Thrifting", "Climate Content", "Zero Waste"]
      },
      {
        platform: "Programmatic",
        signals: ["IAB — Green Solutions", "IAB — Environmental Issues", "Contextual: Guardian Environment, Eco-Age, Positive News"]
      }
    ],
    watching: ["David Attenborough documentaries", "Don't Look Up", "Seaspiracy", "The Biggest Little Farm", "Channel 4 News"],
    listening: ["Outrage + Optimism Podcast", "How to Save a Planet", "The Guardian's Today in Focus", "Indie / folk / conscious hip-hop"],
    events: ["Earth Day activations", "Climate marches", "Extinction Rebellion events", "Sustainable fashion markets", "Green Film Festival"],
    platforms: ["Instagram", "TikTok", "Reddit", "Change.org", "Ecosia", "Depop"],
    mediaOwners: [
      { name: "The Guardian / Observer", rationale: "Values-aligned editorial authority — strong brand trust expectations from this audience", formats: ["Display", "Native Content", "Newsletter Sponsorship", "Branded Longform"] },
      { name: "Instagram / Meta", rationale: "Purpose community mobilisation — EcoTok crossover and sustainability creator partnerships", formats: ["In-Feed", "Stories", "Creator Partnerships", "Cause Ads"] },
      { name: "YouTube", rationale: "Documentary and explainer content — pre-roll around sustainability and Attenborough channels", formats: ["Pre-roll", "YouTube Select", "Branded Shorts"] },
      { name: "LinkedIn", rationale: "B2B sustainability narrative — reach corporate decision-makers and ESG-aligned professionals", formats: ["Sponsored Content", "InMail", "Thought Leadership"] },
      { name: "Positive News / Eco-Age", rationale: "Mission-aligned niche editorial — highly trusted reach to values-literate audience", formats: ["Display", "Editorial Partnership", "Newsletter"] }
    ],
    plannerNote: "Purpose authenticity is mandatory — this audience audits brand actions against claims. Third-party certification and concrete commitments outperform aspirational language."
  },

  "parenting-milestones": {
    headline: "New and expectant parents navigating life's biggest transitions",
    description:
      "This audience is in purchase mode — they need everything, they need it now, and they're overwhelmed with information. Trust is paramount: recommendations from other parents, midwives, and organic word-of-mouth carry more weight than advertising. First-time parents especially are high-frequency researchers.",
    demographics: {
      age: "25–40, core 27–35",
      skew: "Strong female skew (70/30) with growing dual-partner audience",
      lifestage: ["Expectant parents", "Parents of 0–3 year olds", "Millennials", "First-time buyers"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: ["Expecting Parents", "New Parents", "Baby Products", "Parenting", "Pregnancy Milestone", "NCT (Interest)"]
      },
      {
        platform: "Google",
        signals: ["Expecting Parents", "Baby & Toddler Products", "Parenting Advice Seekers"]
      },
      {
        platform: "TikTok",
        signals: ["Pregnancy & Parenting", "Baby Milestones", "Newborn Content", "Mum/Dad TikTok"]
      },
      {
        platform: "Programmatic",
        signals: ["IAB — Parenting — Babies & Toddlers", "IAB — Pregnancy", "Contextual: NCT, Mumsnet, BabyCentre"]
      }
    ],
    watching: ["One Born Every Minute", "Good Witch (comfort TV)", "Motherland", "Sarah & Duck (with toddlers)", "Netflix family content"],
    listening: ["Baby sleep playlists", "The Daddy Digest Podcast", "Unfiltered Mama", "Easy listening / Radio 2"],
    events: ["Baby shows (The Baby Show, ExCeL London)", "NCT antenatal classes", "Soft play first visits", "Baby sensory classes"],
    platforms: ["Mumsnet", "Facebook (parenting groups)", "Instagram", "Pinterest", "NHS app"],
    mediaOwners: [
      { name: "Mumsnet", rationale: "Highest-trust parenting environment in UK — forum and editorial adjacency drives authentic recommendation", formats: ["Display", "Forum Sponsorship", "Content Partnerships", "Newsletter"] },
      { name: "Facebook", rationale: "Parenting Facebook groups are primary community infrastructure for new parents", formats: ["In-Feed", "Groups Adjacency", "Messenger", "Instagram Cross-platform"] },
      { name: "NCT / NHS Online", rationale: "Ultimate trust signals — content partnerships in pregnancy and new parent digital resources", formats: ["Content Sponsorship", "Email", "Resource Partnerships"] },
      { name: "CBeebies / BBC", rationale: "Unrivalled trust for family-safe content — linear and iPlayer reach to parents in key viewing moments", formats: ["Linear Sponsorship", "iPlayer Pre-roll", "CBBC Idents"] },
      { name: "YouTube", rationale: "Parenting tutorial and milestone content — pre-roll around baby and parenting channels", formats: ["Pre-roll", "Branded Content", "YouTube Shorts"] }
    ],
    plannerNote: "Mumsnet forums and Facebook parenting groups drive organic word-of-mouth. Brand trust is built over months — start consideration phase in the 2nd trimester."
  },

  "motorsport-auto": {
    headline: "Race-passionate fans and automotive enthusiasts",
    description:
      "F1's Drive to Survive effect has broadened this audience significantly — new GenZ fans engage primarily via social and streaming, while the traditional auto-enthusiast core remains. Dual audience: social-first race followers and hands-on car enthusiasts. Brand partnerships around race weekends drive the highest engagement.",
    demographics: {
      age: "18–50, broad with 22–38 active core",
      skew: "Strong male skew (74/26), female audience growing via F1",
      lifestage: ["Students (F1 new audience)", "Professionals", "Car owners", "Enthusiast hobbyists"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: ["Formula 1 Fans", "Motorsport", "Car Enthusiasts", "Top Gear / Grand Tour", "Track Days", "Specific team/driver pages"]
      },
      {
        platform: "Google",
        signals: ["Sports Fans", "Motorsport Fans", "Car Enthusiasts", "Auto News Readers"]
      },
      {
        platform: "TikTok",
        signals: ["Formula 1", "Motorsport", "Car Culture", "Racing Content"]
      },
      {
        platform: "Programmatic",
        signals: ["IAB — Auto Racing", "IAB — Automobiles", "Contextual: Autosport, F1.com, Evo Magazine"]
      }
    ],
    watching: ["Drive to Survive (Netflix)", "F1 races (Sky Sports F1)", "The Grand Tour", "Top Gear", "Le Mans 66 / Rush (films)"],
    listening: ["The Race Podcast", "Beyond the Grid (F1 official)", "F1 Nation", "Rock / Classic rock"],
    events: ["British Grand Prix (Silverstone)", "Goodwood Festival of Speed", "Track days", "Auto Trader events", "Car shows"],
    platforms: ["YouTube", "Instagram", "Reddit (r/formula1)", "Twitter/X", "F1 app"],
    mediaOwners: [
      { name: "Sky Sports F1", rationale: "Exclusive UK F1 live rights — peak engagement around race weekends is unmatched in motorsport", formats: ["Linear Sponsorship", "Live Race Idents", "BVOD Pre-roll"] },
      { name: "Channel 4", rationale: "F1 highlights and free-to-air racing — broad mainstream reach including new Drive to Survive fans", formats: ["Linear Sponsorship", "Free-to-Air Adjacency"] },
      { name: "YouTube", rationale: "F1 and car content hub — pre-roll around race analysis and automotive channels", formats: ["Pre-roll", "YouTube Select Auto", "Channel Sponsorship"] },
      { name: "Auto Trader", rationale: "UK's largest automotive marketplace — in-market car buyers at point of decision", formats: ["Display", "Sponsored Listings", "Native Content"] },
      { name: "Autosport / Evo Magazine", rationale: "Dedicated motorsport and auto editorial — native reach for credibility-seeking enthusiasts", formats: ["Display", "Native Content", "Newsletter Sponsorship"] }
    ],
    plannerNote: "Race weekend real-time activation is highest-impact. Sky Sports F1 sponsorship and trackside OOH around UK race calendar drives premium association."
  },

  "comedy-entertainment": {
    headline: "Laughter-first audiences embedded in live and streaming comedy culture",
    description:
      "Comedy is a social currency for this audience — sharing clips, quoting shows, and going to gigs together. Stand-up tours are a high-priority ticketed event. Podcast comedy has created new parasocial relationships that brands can tap via host-read sponsorships. Broad demographic reach makes this a versatile planning playground.",
    demographics: {
      age: "18–45, genuinely broad",
      skew: "Balanced (52/48 female)",
      lifestage: ["Students", "Young professionals", "Millennials", "Couples and friend groups"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: ["Comedy Fans", "Stand-Up Comedy", "Podcast Listeners", "Panel Shows", "Specific comedian pages"]
      },
      {
        platform: "Google",
        signals: ["Comedy Enthusiasts", "Entertainment News Readers", "Podcast Listeners"]
      },
      {
        platform: "TikTok",
        signals: ["Comedy", "Sketch Content", "Stand-Up Clips", "Funny Videos"]
      },
      {
        platform: "Programmatic",
        signals: ["IAB — Humor", "IAB — Entertainment", "Contextual: Time Out, The Guardian Comedy, Edinburgh Fringe listings"]
      }
    ],
    watching: ["Taskmaster", "Peep Show (rewatch)", "Ted Lasso", "What We Do in the Shadows", "Mock the Week / Would I Lie to You reruns"],
    listening: ["My Dad Wrote a Porno", "Off Menu with Ed Gamble & James Acaster", "The Guilty Feminist", "8 Out of 10 Cats Does Countdown"],
    events: ["Edinburgh Fringe (August)", "Stand-up tours (O2, Hammersmith Apollo)", "Comedy clubs (Soho Theatre, Up the Creek)", "TV tapings"],
    platforms: ["YouTube", "BBC iPlayer", "Netflix", "Instagram", "TikTok"],
    mediaOwners: [
      { name: "Channel 4", rationale: "Home of Taskmaster and comedy commissions — linear and BVOD with young-skewing primetime", formats: ["Linear Sponsorship", "BVOD Pre-roll", "Content Partnerships"] },
      { name: "Netflix", rationale: "Stand-up specials and comedy originals — engaged comedy fans in a brand-safe premium context", formats: ["Co-marketing", "Content Partnerships"] },
      { name: "BBC iPlayer", rationale: "Free-to-air comedy archive and new commissions — broad reach to loyal comedy audience", formats: ["Pre-roll", "Comedy Category Sponsorship"] },
      { name: "Spotify (Podcast)", rationale: "Comedy podcast ecosystem — host-read ads deliver highest trust in the format", formats: ["Podcast Host-Read", "Branded Segments", "Show Sponsorship"] },
      { name: "YouTube", rationale: "Stand-up clips and comedy content — pre-roll around comedian channels and panel show clips", formats: ["Pre-roll", "Channel Partnerships", "Shorts"] }
    ],
    plannerNote: "Podcast host-read sponsorships deliver the highest trust-transfer in this audience. Choose hosts whose editorial values align with the brand."
  },

  "pets-animals": {
    headline: "Devoted pet owners and animal content enthusiasts",
    description:
      "Pets are family — this audience spends significantly on pet wellbeing, often prioritising pet costs over personal spending. Animal content is a daily social media habit. Vet recommendations drive product purchase more than advertising, making partnerships with vet networks and pet-adjacent creators high-value.",
    demographics: {
      age: "22–55, broad",
      skew: "Female skew (62/38)",
      lifestage: ["Young adults (dog as first dependent)", "Couples pre-children", "Empty nesters", "Remote workers"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: ["Pet Owners", "Dog Owners", "Cat Owners", "Animal Welfare", "Pets (Interest)", "Specific breed communities"]
      },
      {
        platform: "Google",
        signals: ["Pet Owners", "Pet Product Shoppers", "Veterinary Service Seekers"]
      },
      {
        platform: "TikTok",
        signals: ["Pet Content", "Dog TikTok", "Cat TikTok", "Animal Rescue", "Pet Training"]
      },
      {
        platform: "Programmatic",
        signals: ["IAB — Pets", "IAB — Veterinary Medicine", "Contextual: Dogs Monthly, Your Cat, RSPCA"]
      }
    ],
    watching: ["Planet Earth", "Dogs: An Amazing Animal Family (Netflix)", "The Secret Life of Your Pet (BBC)", "Gogglebox (pets in background content)"],
    listening: ["Pet-calming Spotify playlists", "Barking Mad Podcast", "The Vet", "Easy listening / Radio 2"],
    events: ["Crufts", "Dog Fest", "RSPCA fundraisers", "Local dog shows", "Pet-friendly pub events"],
    platforms: ["Instagram", "TikTok", "Facebook (breed groups)", "Reddit (r/aww, r/dogs)", "DogBuddy / Rover app"],
    mediaOwners: [
      { name: "Instagram", rationale: "Pet account ecosystem is the most engaged niche on the platform — creator and UGC amplification", formats: ["In-Feed", "Stories", "Reels", "Creator Partnerships (pet accounts)"] },
      { name: "TikTok", rationale: "Pet content drives some of the highest organic reach — In-Feed ads around endemic pet content", formats: ["In-Feed Ads", "Creator Partnerships", "Branded Effects"] },
      { name: "YouTube", rationale: "Long-form pet training, care, and entertainment content — pre-roll around vet and pet education channels", formats: ["Pre-roll", "Branded Content", "YouTube Select"] },
      { name: "Facebook", rationale: "UK pet breed and owner groups — the largest organised pet communities for targeted adjacency", formats: ["In-Feed", "Group Adjacency", "Messenger"] },
      { name: "RSPCA / Dogs Trust", rationale: "Partnership with animal welfare organisations signals brand values alignment to this high-trust audience", formats: ["Content Partnerships", "Co-branded Campaigns", "Digital Sponsorship"] }
    ],
    plannerNote: "Pet accounts are some of the highest-engagement accounts on Instagram. Creator partnerships with popular pet accounts deliver strong organic amplification."
  },

  "education-careers": {
    headline: "Achievement-oriented students and career transitioners",
    description:
      "Focused on the next step — whether that's A-levels, a degree, graduate scheme, or a career pivot. Highly research-driven with strong platform habits around LinkedIn and Reddit for professional guidance. Respond to authentic success stories over polished aspiration. Results-day and key academic calendar beats drive sharp engagement spikes.",
    demographics: {
      age: "16–30, core 17–24",
      skew: "Slight female skew (54/46) in further education",
      lifestage: ["Sixth formers", "University students", "Recent graduates", "Career starters"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: ["Students", "University Students", "Graduate Job Seekers", "Online Learning", "Apprenticeships", "Career Development"]
      },
      {
        platform: "Google",
        signals: ["College Students", "Job Seekers", "Continuing Education Seekers", "UCAS Applicants"]
      },
      {
        platform: "TikTok",
        signals: ["Study Content", "University Life", "Career Advice", "Graduate Jobs", "Revision Tips"]
      },
      {
        platform: "Programmatic",
        signals: ["IAB — Education", "IAB — College Life", "IAB — Career Planning", "Contextual: Prospects.ac.uk, The Student Room, LinkedIn"]
      }
    ],
    watching: ["The Internship", "Social Network", "Suits (career aspiration)", "YouTube study-with-me channels", "TED Talks"],
    listening: ["Podcast: How I Built This", "The High Performance Podcast", "Diary of a CEO", "Lo-fi study playlists", "Mo Gilligan / Romesh (downtime)"],
    events: ["University open days", "Freshers Week", "A-level / GCSE results day", "Graduate recruitment fairs", "LinkedIn events"],
    platforms: ["LinkedIn", "The Student Room", "Reddit (r/UniUK)", "TikTok", "YouTube"],
    mediaOwners: [
      { name: "LinkedIn", rationale: "Primary career networking platform — Sponsored Content and InMail reaches students and job-seekers directly", formats: ["Sponsored Content", "InMail", "Dynamic Ads", "Thought Leadership"] },
      { name: "TikTok", rationale: "StudyTok and career content ecosystem — In-Feed ads reach Gen Z students in an educational mindset", formats: ["In-Feed Ads", "Creator Partnerships", "Branded Challenges"] },
      { name: "YouTube", rationale: "Study-with-me and career advice channels — pre-roll around educational content reaches active learners", formats: ["Pre-roll", "YouTube Select Education", "Branded Content"] },
      { name: "The Student Room / Prospects.ac.uk", rationale: "UK's largest student advice platforms — display and native at critical decision moments", formats: ["Display", "Native Content", "Editorial Sponsorship"] },
      { name: "Spotify (Podcast)", rationale: "Career advice podcasts — Diary of a CEO, High Performance reach ambitious young professionals", formats: ["Podcast Host-Read", "Audio Ads", "Show Sponsorship"] }
    ],
    plannerNote: "Results day (mid-August) is the single highest-intent planning moment. Clearing advertising and post-results comms see dramatic engagement spikes in a narrow 72-hour window."
  },

  "cricket-rugby": {
    headline: "Traditional sport fans with deep club and national team loyalty",
    description:
      "Rooted in sporting tradition — pub-going, match-attending, and passionately partisan. The Six Nations and Ashes create long calendar windows of sustained engagement. More demographically established than football, with a significant 35+ audience and strong regional identity (particularly rugby in Wales, SW England, and the North).",
    demographics: {
      age: "25–55, core 30–48",
      skew: "Male skew (68/32), growing female audience in rugby",
      lifestage: ["Established professionals", "Parents", "Rugby club members", "Cricket members"]
    },
    targeting: [
      {
        platform: "Meta",
        signals: ["Rugby Fans", "Cricket Fans", "Six Nations", "The Ashes", "England Rugby", "County Cricket"]
      },
      {
        platform: "Google",
        signals: ["Sports Fans", "Rugby Followers", "Cricket Followers", "Live Sports Ticket Buyers"]
      },
      {
        platform: "TikTok",
        signals: ["Rugby", "Cricket Highlights", "Sports Content"]
      },
      {
        platform: "Programmatic",
        signals: ["IAB — Rugby", "IAB — Cricket", "Contextual: BBC Sport, SkySports Cricket, The Cricketer, RugbyPass"]
      }
    ],
    watching: ["Six Nations (BBC/ITV)", "The Ashes (Sky Sports Cricket)", "Clarkson's Farm (lifestyle crossover)", "Downton Abbey (demographic crossover)", "BBC Sport highlights"],
    listening: ["The Breakdown Podcast (rugby)", "Tailenders (cricket)", "Test Match Special (BBC Radio 4)", "Classic rock / Radio 2"],
    events: ["Six Nations fixtures", "The Ashes test matches (The Oval, Lord's, Headingley)", "Premiership Rugby", "County cricket grounds", "Rugby World Cup"],
    platforms: ["Twitter/X (sports commentary)", "BBC Sport app", "Sky Sports app", "Facebook", "WhatsApp"],
    mediaOwners: [
      { name: "BBC Sport / BBC Radio 4", rationale: "Test Match Special and cricket coverage — affluent, loyal audience with strong radio habits and high trust", formats: ["Radio Sponsorship (TMS)", "Digital Display", "iPlayer Pre-roll"] },
      { name: "Sky Sports", rationale: "Premium live cricket and Premiership Rugby rights — peak engagement around live events", formats: ["Linear Sponsorship", "Live Event Idents", "BVOD Pre-roll"] },
      { name: "ITV", rationale: "Six Nations free-to-air — 10M+ live audience at peak, broad mainstream rugby reach", formats: ["Linear Sponsorship", "Match Break Sponsorship", "ITVX Pre-roll"] },
      { name: "talkSPORT", rationale: "Sports radio authority — cricket and rugby adjacency with a loyal, established audience", formats: ["Live Radio Ads", "Podcast Sponsorship", "Branded Segments"] },
      { name: "The Telegraph / The Times", rationale: "Prestige sport journalism aligned with this audience's reading habits — print and digital display", formats: ["Print Ads", "Digital Display", "Sport Section Sponsorship"] }
    ],
    plannerNote: "BBC Radio 4 (Test Match Special) carries unusually loyal and affluent audiences. ITV Six Nations sponsorship reaches a broad mainstream audience at peak engagement moments."
  }
};
