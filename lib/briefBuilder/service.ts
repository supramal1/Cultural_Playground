import { z } from "zod";
import { DEFAULT_OPENAI_MODEL, OPENAI_BASE_URL } from "@/lib/config";
import { fetchWithRetry, FetchError } from "@/lib/fetchWithRetry";
import { signalScaleSummary } from "@/lib/signalScale";
import {
  MediaOwnerBriefSchema,
  mediaOwnerBriefJsonSchema,
  PlaygroundBlueprintSchema,
  playgroundBlueprintJsonSchema,
  SynthesizeBlueprintRequestSchema,
  SynthesizeBriefRequestSchema,
  type MediaOwnerBrief,
  type PlaygroundBlueprint,
  type SynthesizeBlueprintRequest,
  type SynthesizeBriefRequest
} from "@/lib/briefBuilder/types";

type RetryContext = {
  invalidPointers?: string[];
  invalidIds?: string[];
  allowedIds?: string[];
};

const FALLBACK_WARNING = "OPENAI_API_KEY missing: returned deterministic demo output.";

function normalizeList(values: string[], cap: number): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of values) {
    const value = raw.replace(/\s+/g, " ").trim();
    if (!value) {
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(value);
    if (output.length >= cap) {
      break;
    }
  }
  return output;
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fallbackList(values: Array<string | undefined>, cap: number, fallbackPrefix: string): string[] {
  const normalized = normalizeList(
    values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value)),
    cap
  );

  let counter = 1;
  while (normalized.length < cap) {
    normalized.push(`${fallbackPrefix} ${counter}`);
    counter += 1;
  }

  return normalized.slice(0, cap);
}

function summarizeSources(input: SynthesizeBlueprintRequest): string[] {
  return normalizeList(
    [
      input.signals?.googleTrends ? "Google Trends" : "",
      input.signals?.reddit ? "Reddit" : "",
      input.signals?.wikimedia ? "Wikimedia" : "",
      input.signals?.guardian ? "Guardian" : "",
      input.insights?.audience ? "Audience insights CSV" : "",
      input.insights?.search ? "Search insights CSV" : "",
      input.brandSignals ? "Brand signal scan" : "",
      input.brandDiscourseContext ? "Brand discourse context" : "",
      input.playgroundContext?.sources?.length ? "Playground validation context" : "",
      "Deterministic synthesis fallback"
    ],
    8
  );
}

function buildFallbackBlueprint(input: {
  request: SynthesizeBlueprintRequest;
  allowedPointers: string[];
}): PlaygroundBlueprint {
  const { request, allowedPointers } = input;
  const brand = request.brief.brand?.trim() || "The brand";
  const audience = request.brief.audienceKeyword.trim();
  const playground = request.chosenPlayground;
  const evidencePointers = normalizeList(
    [...playground.evidencePointers, ...allowedPointers],
    12
  );
  const pointerAt = (index: number): string[] =>
    evidencePointers[index] ? [evidencePointers[index]] : [];

  const codeSeeds = normalizeList(
    [
      ...playground.keywords.core,
      ...playground.keywords.expansion,
      ...(request.brandSignals?.brandThemes || []),
      ...(request.insights?.search?.queriesLatestMonth.byTrend.fastRising || []).map(
        (item) => item.query
      )
    ],
    8
  );
  while (codeSeeds.length < 5) {
    codeSeeds.push(`${playground.name} signal ${codeSeeds.length + 1}`);
  }

  const communitySeeds = normalizeList(
    [
      ...playground.communities.subreddits.map((item) =>
        item.startsWith("r/") ? item : `r/${item}`
      ),
      ...(request.brandSignals?.brandSubreddits || []).map((item) =>
        item.startsWith("r/") ? item : `r/${item}`
      ),
      `${audience} creators`,
      `${playground.name} planners`
    ],
    6
  );
  while (communitySeeds.length < 3) {
    communitySeeds.push(`${playground.name} community ${communitySeeds.length + 1}`);
  }

  return PlaygroundBlueprintSchema.parse({
    playgroundId: playground.id,
    playgroundName: playground.name,
    coreIdea: `${brand} can earn attention in ${playground.name} by showing up around the behaviours and conversations already clustering around this space, rather than adding generic category messaging.`,
    whoItsFor: fallbackList(
      [
        audience,
        `People actively exploring ${playground.keywords.core[0] || playground.name.toLowerCase()}`,
        `Communities trading cues, proof, and recommendations inside ${playground.name.toLowerCase()}`,
        `Planners looking for a culturally credible way for ${brand} to participate`
      ],
      4,
      "Audience"
    ).slice(0, 4),
    cultureCodes: codeSeeds.slice(0, 5).map((seed, index) => ({
      phrase: `${titleCase(seed)} acts as a planning signal`,
      meaning: `People use ${seed.toLowerCase()} as a cue for what to notice, talk about, and share inside ${playground.name.toLowerCase()}.`,
      evidencePointers: pointerAt(index)
    })),
    communityMap: communitySeeds.slice(0, 3).map((community, index) => ({
      community,
      careAbout: `Useful updates, social proof, and culturally fluent takes that help ${audience.toLowerCase()} navigate ${playground.name.toLowerCase()}.`,
      evidencePointers: pointerAt(index + 5)
    })),
    tensionsTruths: fallbackList(
      [
        `${audience} wants relevance signals that feel current, not brand-inserted.`,
        `Attention in ${playground.name} spikes when there is a clear cue for what matters right now.`,
        `${brand} will be more credible if it curates and clarifies rather than over-explains.`,
        playground.whyNow
      ],
      4,
      "Planning tension"
    ),
    brandRole: fallbackList(
      [
        `${brand} should act as a useful interpreter of the moment, helping people understand what is worth paying attention to.`,
        `${brand} should make participation easier through timely, culturally fluent creative and partnerships.`,
        `Any activation should feel additive to the community rather than interruptive.`
      ],
      3,
      "Brand role"
    ).slice(0, 3),
    guardrails: fallbackList(
      [
        ...playground.riskFlags.map((flag) => `Avoid adjacency with ${flag.toLowerCase()}.`),
        ...((request.brandSignals?.brandRiskFlags || []).map(
          (flag) => `Pressure-test the work against ${flag.toLowerCase()} risk.`
        )),
        "Use source-backed proof points before making cultural claims.",
        "Keep creative specific to the audience behaviour, not just the event label.",
        "Favor community language and timing cues over corporate messaging."
      ],
      4,
      "Guardrail"
    ),
    measurementSuggestions: fallbackList(
      [
        "Track engagement rate against the selected cultural cue set.",
        "Measure content saves, shares, or comments that signal active participation.",
        "Compare response around lead-in, peak, and cool-down windows.",
        `Monitor searches and conversation linked to ${playground.keywords.core[0] || playground.name.toLowerCase()}.`
      ],
      4,
      "Measurement"
    ),
    proofOfUseSummary: {
      usedSources: summarizeSources(request),
      evidencePointers,
      notes: [FALLBACK_WARNING]
    },
    notes: [
      "Copy generated from deterministic rules because live OpenAI synthesis is unavailable."
    ]
  });
}

function buildFallbackBrief(input: {
  request: SynthesizeBriefRequest;
  allowedPointers: string[];
}): MediaOwnerBrief {
  const { request, allowedPointers } = input;
  const brand = request.brief.brand?.trim() || "The brand";
  const audience = request.brief.audienceKeyword.trim();
  const selectedOpportunities = request.selectedOpportunities || [];
  const leadMoment = selectedOpportunities[0];
  const evidencePointers = normalizeList(
    [
      ...request.blueprint.proofOfUseSummary.evidencePointers,
      ...selectedOpportunities.flatMap((item) => item.evidencePointers),
      ...allowedPointers
    ],
    12
  );
  const momentPointers = (momentId: string, index: number): string[] => {
    const moment = selectedOpportunities.find((item) => item.id === momentId);
    return normalizeList(
      [...(moment?.evidencePointers || []), evidencePointers[index] || ""],
      6
    );
  };
  const dateWindow =
    request.brief.from && request.brief.to
      ? `${request.brief.from} to ${request.brief.to}`
      : "the selected planning window";
  const signalBullets = fallbackList(
    [
      ...(request.signalScaleContext || []).slice(0, 3),
      ...selectedOpportunities.slice(0, 3).map(
        (moment) =>
          `${moment.title} carries a final score of ${Math.round(moment.finalScore)} with signal boost ${moment.signalBoost.total}.`
      ),
      `Blueprint grounded in ${request.blueprint.playgroundName}.`
    ],
    3,
    "Signal note"
  );
  const citations = fallbackList(
    [
      ...selectedOpportunities.slice(0, 3).map((moment) => `${moment.sourceName}: ${moment.title}`),
      ...request.blueprint.proofOfUseSummary.usedSources
    ],
    3,
    "Source"
  );

  return MediaOwnerBriefSchema.parse({
    cultureSnapshot: `${request.blueprint.playgroundName} is behaving like a live planning space rather than a static topic. Across ${dateWindow}, ${audience.toLowerCase()} will respond to signals that help them decode what matters now and where ${brand} can show up with utility rather than noise.`,
    culturalTension: `${audience} wants to feel current and culturally fluent, but the volume of signals inside ${request.blueprint.playgroundName.toLowerCase()} makes it hard to know which moments deserve attention. ${brand} can resolve that tension by helping people focus on the cues that matter most.`,
    timingWindow: `Use the lead-in period to seed relevance, the peak window to publish the clearest proof point or activation, and the cool-down period to extend the conversation with recap or utility-led content across ${dateWindow}.`,
    briefOneLiner: `Own the moments when ${audience.toLowerCase()} is actively scanning ${request.blueprint.playgroundName.toLowerCase()} for what matters next.`,
    objectiveKpi: `${request.brief.objective || "Awareness"} with a primary KPI on qualified engagement rate and downstream action from culturally relevant content.`,
    audienceMindset: `${audience} is looking for signals, shortcuts, and proof that help them participate with confidence. They are most receptive to work that feels current, socially legible, and grounded in the communities around ${request.blueprint.playgroundName.toLowerCase()}.`,
    playgroundDefinitionCodes: `${request.blueprint.coreIdea} Core codes: ${request.blueprint.cultureCodes
      .slice(0, 4)
      .map((item) => item.phrase)
      .join("; ")}.`,
    theAsk: `Build a partner-ready activation that lands in the lead-in and peak windows around the selected moments, using the community cues and culture codes already validated in this playground.`,
    deliverables: fallbackList(
      [
        "1 hero content concept tied to the strongest cultural cue in the window.",
        "3 social or editorial executions timed to the lead-in, peak, and cool-down phases.",
        "1 community-facing format or partnership mechanic that feels native to the playground.",
        "1 reporting plan linking engagement and conversion signals back to the brief."
      ],
      4,
      "Deliverable"
    ),
    timing: {
      leadInDays: 10,
      peakDays: 4,
      coolDownDays: 5
    },
    guardrails: fallbackList(
      [
        ...request.blueprint.guardrails,
        "Avoid over-claiming cultural authority without evidence in the appendix."
      ],
      4,
      "Guardrail"
    ),
    proofAppendix: {
      citations,
      signalBullets,
      evidencePointers
    },
    momentsToBuildAround: selectedOpportunities.slice(0, 4).map((moment, index) => ({
      momentId: moment.id,
      culturalBehaviour: `${moment.title} creates a cue for people to check in, compare takes, and share what the moment signals for them.`,
      audienceState: `${audience} is scanning for timely proof, social validation, and a reason to participate while attention is concentrated.`,
      actionBullets: [
        `Publish a lead-in execution before ${moment.title} that helps the audience understand why this moment matters right now.`,
        `Use the peak attention window around ${moment.title} to give partners a simple, shareable activation format.`
      ],
      evidencePointers: momentPointers(moment.id, index)
    })),
    notes: [
      leadMoment
        ? `Fallback brief anchored to ${leadMoment.title}.`
        : "Fallback brief generated without selected opportunities.",
      "Copy generated from deterministic rules because live OpenAI synthesis is unavailable."
    ]
  });
}

function extractJson(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    throw new Error("OpenAI response payload malformed.");
  }

  const asAny = payload as Record<string, unknown>;
  if (typeof asAny.output_text === "string" && asAny.output_text.trim()) {
    return JSON.parse(asAny.output_text);
  }

  if (Array.isArray(asAny.output)) {
    for (const item of asAny.output) {
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) {
        continue;
      }
      for (const segment of content) {
        const typed = segment as { text?: unknown; json?: unknown };
        if (typeof typed.text === "string" && typed.text.trim()) {
          return JSON.parse(typed.text);
        }
        if (typed.json && typeof typed.json === "object") {
          return typed.json;
        }
      }
    }
  }

  throw new Error("Could not parse OpenAI structured output.");
}

function canonicalizePointer(pointer: string, allowed: Set<string>): string {
  const normalized = pointer.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return normalized;
  }
  if (allowed.has(normalized)) {
    return normalized;
  }

  const bracketed = normalized.replace(/\.([0-9]+)(?=\.|$)/g, "[$1]");
  if (allowed.has(bracketed)) {
    return bracketed;
  }

  let shortened = bracketed;
  while (shortened.includes(".")) {
    const next = shortened.replace(/\.[^.[]+$/, "");
    if (next === shortened) {
      break;
    }
    shortened = next;
    if (allowed.has(shortened)) {
      return shortened;
    }
  }

  return normalized;
}

function collectBlueprintPointers(input: SynthesizeBlueprintRequest): Set<string> {
  const pointers = new Set<string>(input.chosenPlayground.evidencePointers || []);

  (input.brandSignals?.evidencePointers || []).forEach((pointer) => pointers.add(pointer));
  (input.brandSignals?.brandThemes || []).forEach((_item, index) =>
    pointers.add(`brandSignals.brandThemes[${index}]`)
  );
  (input.brandSignals?.brandAdjacencyKeywords || []).forEach((_item, index) =>
    pointers.add(`brandSignals.brandAdjacencyKeywords[${index}]`)
  );
  (input.brandSignals?.brandSubreddits || []).forEach((_item, index) =>
    pointers.add(`brandSignals.brandSubreddits[${index}]`)
  );

  (input.insights?.audience?.topAffinities || []).forEach((_item, index) =>
    pointers.add(`insights.audience.topAffinities[${index}]`)
  );
  const byTrend = input.insights?.search?.queriesLatestMonth.byTrend;
  if (byTrend) {
    (["top", "fastRising", "sustainedGrowth", "emerging", "declining"] as const).forEach((key) => {
      (byTrend[key] || []).forEach((_item, index) =>
        pointers.add(`insights.search.queriesLatestMonth.byTrend.${key}[${index}]`)
      );
    });
  }

  (input.signals?.googleTrends?.topRelatedQueries || []).forEach((_item, index) =>
    pointers.add(`signals.googleTrends.topRelatedQueries[${index}]`)
  );
  (input.signals?.googleTrends?.topRelatedTopics || []).forEach((_item, index) =>
    pointers.add(`signals.googleTrends.topRelatedTopics[${index}]`)
  );
  (input.signals?.reddit?.commonThemes || []).forEach((_item, index) =>
    pointers.add(`signals.reddit.commonThemes[${index}]`)
  );
  (input.signals?.reddit?.topPosts || []).forEach((_item, index) =>
    pointers.add(`signals.reddit.topPosts[${index}]`)
  );
  (input.signals?.wikimedia?.entities || []).forEach((_item, index) =>
    pointers.add(`signals.wikimedia.entities[${index}]`)
  );

  for (const [playgroundId, contextItem] of Object.entries(input.playgroundContext?.byPlaygroundId || {})) {
    pointers.add(`playgroundContext.${playgroundId}`);
    contextItem.anchors.forEach((_anchor, index) =>
      pointers.add(`playgroundContext.${playgroundId}.anchors[${index}]`)
    );
  }

  return pointers;
}

function collectBriefPointers(input: SynthesizeBriefRequest): {
  pointers: Set<string>;
  allowedMomentIds: Set<string>;
} {
  const pointers = new Set<string>();
  const allowedMomentIds = new Set<string>();

  input.blueprint.proofOfUseSummary.evidencePointers.forEach((pointer) => pointers.add(pointer));
  input.blueprint.cultureCodes.forEach((item) => item.evidencePointers.forEach((pointer) => pointers.add(pointer)));
  input.blueprint.communityMap.forEach((item) => item.evidencePointers.forEach((pointer) => pointers.add(pointer)));

  for (const moment of input.selectedOpportunities || []) {
    allowedMomentIds.add(moment.id);
    (moment.evidencePointers || []).forEach((pointer) => pointers.add(pointer));
    pointers.add(`selectedOpportunities.${moment.id}`);
  }

  for (const [momentId, contextItem] of Object.entries(input.opportunityContext?.byMomentId || {})) {
    pointers.add(`opportunityContext.${momentId}`);
    contextItem.evidencePointers.forEach((pointer) => pointers.add(pointer));
    contextItem.citations.forEach((_citation, index) => pointers.add(`opportunityContext.${momentId}.citations[${index}]`));
  }

  return { pointers, allowedMomentIds };
}

function normalizeBlueprintPointers(blueprint: PlaygroundBlueprint, allowedPointers: Set<string>): PlaygroundBlueprint {
  const normalizePointers = (values: string[], cap: number): string[] =>
    normalizeList(values.map((value) => canonicalizePointer(value, allowedPointers)), cap);

  return {
    ...blueprint,
    cultureCodes: blueprint.cultureCodes.map((item) => ({
      ...item,
      evidencePointers: normalizePointers(item.evidencePointers, 6)
    })),
    communityMap: blueprint.communityMap.map((item) => ({
      ...item,
      evidencePointers: normalizePointers(item.evidencePointers, 6)
    })),
    proofOfUseSummary: {
      ...blueprint.proofOfUseSummary,
      evidencePointers: normalizePointers(blueprint.proofOfUseSummary.evidencePointers, 12)
    }
  };
}

function normalizeBriefPointers(brief: MediaOwnerBrief, allowedPointers: Set<string>): MediaOwnerBrief {
  const normalizePointers = (values: string[], cap: number): string[] =>
    normalizeList(values.map((value) => canonicalizePointer(value, allowedPointers)), cap);

  return {
    ...brief,
    proofAppendix: {
      ...brief.proofAppendix,
      evidencePointers: normalizePointers(brief.proofAppendix.evidencePointers, 12)
    },
    momentsToBuildAround: brief.momentsToBuildAround.map((item) => ({
      ...item,
      evidencePointers: normalizePointers(item.evidencePointers, 6)
    }))
  };
}

function invalidBlueprintPointers(blueprint: PlaygroundBlueprint, allowedPointers: Set<string>): string[] {
  const invalid = new Set<string>();
  const check = (pointer: string): void => {
    if (!allowedPointers.has(pointer)) {
      invalid.add(pointer);
    }
  };

  blueprint.cultureCodes.forEach((item) => item.evidencePointers.forEach(check));
  blueprint.communityMap.forEach((item) => item.evidencePointers.forEach(check));
  blueprint.proofOfUseSummary.evidencePointers.forEach(check);

  return Array.from(invalid);
}

function invalidBriefPointers(brief: MediaOwnerBrief, allowedPointers: Set<string>): string[] {
  const invalid = new Set<string>();
  const check = (pointer: string): void => {
    if (!allowedPointers.has(pointer)) {
      invalid.add(pointer);
    }
  };

  brief.proofAppendix.evidencePointers.forEach(check);
  brief.momentsToBuildAround.forEach((item) => item.evidencePointers.forEach(check));

  return Array.from(invalid);
}

function invalidBriefMomentIds(brief: MediaOwnerBrief, allowedMomentIds: Set<string>): string[] {
  if (allowedMomentIds.size === 0) {
    return [];
  }

  return brief.momentsToBuildAround
    .map((item) => item.momentId)
    .filter((id) => !allowedMomentIds.has(id));
}

function blueprintSystemPrompt(): string {
  return [
    "You are a senior culture strategist at a media agency writing a PlaygroundBlueprint.",
    "Your audience is media planners who will use this to brief media owners (publishers, platforms, creators).",
    "",
    "Quality bar:",
    "- Culture codes must be specific cultural tensions or behaviours, not generic category labels. Bad: 'Football fans like football.' Good: 'Matchday anxiety peaks in the 48 hours before a knockout tie — fans seek reassurance content and shared rituals.'",
    "- Community map entries should name real, findable communities (subreddits, hashtags, fan accounts) and describe how the brand can show up without feeling intrusive.",
    "- The proof-of-use summary must connect real signal data (trends, reddit themes, wikimedia spikes) to a clear 'why now' narrative. Every claim needs an evidence pointer.",
    "- Risk flags should be specific to this playground and brand, not generic 'be respectful' advice.",
    "",
    "Tone: confident, specific, partner-facing. Write as if a planner will paste this into a deck tomorrow.",
    "Use only provided data. Do not invent facts, statistics, or moment details.",
    "Every recommendation must include at least one evidence pointer from the allowed list.",
    "Return strict JSON under schema."
  ].join("\n");
}

function briefSystemPrompt(): string {
  return [
    "You are a senior media planner writing a partner-ready MediaOwnerBrief.",
    "This brief will be sent directly to a media owner (publisher, platform, or creator partner) to commission work.",
    "",
    "INSIGHT QUALITY — THE DIFFERENCE BETWEEN A CALENDAR AND A STRATEGY:",
    "A calendar tells you WHAT is happening. A strategy tells you WHY it matters, WHEN to act, and WHAT the audience is doing. Every field in this brief must cross the insight threshold — it must say something a planner couldn't get from a Google search.",
    "",
    "Quality bar:",
    "- cultureSnapshot: A 3-4 sentence narrative that tells the cultural story of this period. Start with what's happening culturally, then describe the audience behaviour it creates, then the opportunity it opens for the brand. Ground claims in signal data where available (e.g. 'search volume for X is up 300%', 'Reddit threads on Y have 3x the usual engagement'). This should read like the opening of a strategy deck. Example: 'Across Q4, UK audiences cycle through three cultural phases: Diwali celebration drives gifting and family gathering rituals in mid-October, Bonfire Night ignites nostalgia-led community behaviour in early November, then Christmas gifting urgency peaks from late November. For [brand], the window between Diwali and Black Friday is where cultural energy converts to purchase intent — audiences are already in a gifting mindset but haven't committed to Christmas shopping yet.'",
    "",
    "- culturalTension: The specific tension in the audience's relationship with this cultural space that the brand can resolve. Every good brief has a tension. Not a problem to solve — a push-pull the audience feels. Bad: 'People like football.' Good: 'Fans want to feel like insiders but are overwhelmed by the volume of pre-match content. The anxiety of missing a crucial team update competes with fatigue from the 24/7 news cycle. Brands that curate rather than add to the noise earn trust.' This should be 2-3 sentences max.",
    "",
    "- timingWindow: The specific media timing window for this brief, grounded in behavioural evidence. Not just dates — describe the audience behaviour phases and what each phase means for media. Bad: 'Campaign runs March 1-30.' Good: 'Pre-consideration window (7-14 days out): audiences are researching and forming opinions — high-intent search and Reddit discussion peaks. Activation window (48h before to event day): emotional energy peaks, social sharing surges 4x, and audiences actively seek communal content. Post-event tail (3-5 days): recap culture and opinion-formation drives second-wave engagement.' Include specific dates where the data supports it.",
    "",
    "- briefOneLiner: A single compelling sentence that makes the media owner want to read on. Frame it as an opportunity, not a demand. Reference a specific audience behaviour or cultural tension. Bad: 'We want football content.' Good: 'Own the pre-match anxiety moment when 8M fans are refreshing for team news — the 48-hour window where curated content earns disproportionate attention.'",
    "",
    "- objectiveKpi: State the campaign objective AND the specific KPI. Include a target where the data supports it.",
    "",
    "- audienceMindset: Describe the emotional state and behaviour of the audience IN the cultural moment, not demographics. Layer signal evidence where available. Bad: '18-34 males.' Good: 'In the 24 hours before a big match, fans are hyper-engaged — sharing predictions, watching build-up content, and looking for ways to feel part of the occasion. Google Trends shows \"match predictions\" is a breakout query (+500%), while Reddit match threads see 3x the usual comment velocity.'",
    "",
    "- playgroundDefinitionCodes: Define the cultural space in 2-3 sentences, then list the specific culture codes (tensions, behaviours, rituals). Each code should describe a BEHAVIOUR not a topic.",
    "",
    "- theAsk: One clear, actionable sentence a media owner can say yes or no to. Reference the timing window and the specific cultural behaviour being activated. Bad: 'Create engaging content.' Good: 'Build a 3-part video series dropping 48h before each selected fixture, featuring fan prediction rituals with branded integration.'",
    "",
    "- deliverables: Concrete, countable outputs with format and quantity. Each line should be specific enough to cost.",
    "- guardrails: Specific to this brand and moment. Reference actual risk areas from the playground data.",
    "",
    "CULTURAL BEHAVIOUR SYNTHESIS (critical):",
    "- momentsToBuildAround.culturalBehaviour: Transform the calendar event into the cultural behaviour it triggers. Don't describe the event itself — describe what people DO around it.",
    "  Bad: 'Arsenal vs Chelsea is a Premier League match on March 15.'",
    "  Good: 'Pre-match tribal loyalty rituals — fans share prediction threads, wear colours publicly, and seek communal viewing spaces 48h before kickoff.'",
    "- momentsToBuildAround.audienceState: The emotional state of the audience during this cultural behaviour, written as a behaviour insight that a media planner can act on.",
    "  Bad: 'Excited football fans.'",
    "  Good: 'Competitive anxiety mixed with tribal belonging — fans oscillate between confidence and superstition, making them hyper-receptive to content that validates their loyalty.'",
    "- momentsToBuildAround.actionBullets: Specific activation ideas that tap into the cultural behaviour. Reference the timing window and format. Not generic 'make content' instructions.",
    "",
    "SIGNAL-BACKED CLAIMS (critical):",
    "- Every insight should reference specific signal data where available: Google Trends breakout queries, Reddit engagement levels, Wikimedia attention scales, Guardian news coverage.",
    "- If signal scale context is provided, weave the scale labels into the narrative naturally (e.g. 'mass attention on Wikipedia suggests mainstream awareness', 'breakout trend on Google Trends signals an emerging conversation').",
    "- proofAppendix.signalBullets must include specific data points, not generic claims. Bad: 'Football is popular.' Good: 'Google Trends shows \"premier league predictions\" as a breakout query (+500%) in the target period.'",
    "",
    "Tone: direct, partner-facing, specific. A media owner should understand exactly what is being asked within 60 seconds of reading.",
    "Use the provided blueprint and opportunities only. Do not invent factual moment details.",
    "Use moment ids from the allowed list only.",
    "Every recommendation must include at least one evidence pointer from the allowed list.",
    "Return strict JSON under schema."
  ].join("\n");
}


function blueprintUserPrompt(input: {
  request: SynthesizeBlueprintRequest;
  allowedPointers: string[];
  corrective?: RetryContext;
}): string {
  const signalScale = signalScaleSummary({
    wikiEntities: input.request.signals?.wikimedia?.entities,
    trendsQueries: input.request.signals?.googleTrends?.topRelatedQueries,
    redditPosts: input.request.signals?.reddit?.topPosts,
    guardianArticles: input.request.signals?.guardian?.articles
  });

  const compact = {
    brief: input.request.brief,
    playground: {
      id: input.request.chosenPlayground.id,
      name: input.request.chosenPlayground.name,
      definition: input.request.chosenPlayground.definition,
      keywords: input.request.chosenPlayground.keywords,
      communities: input.request.chosenPlayground.communities,
      riskFlags: input.request.chosenPlayground.riskFlags
    },
    brandSignals: input.request.brandSignals,
    brandDiscourseContext: input.request.brandDiscourseContext,
    insights: input.request.insights,
    signals: input.request.signals,
    signalScale: signalScale.length > 0 ? signalScale : undefined,
    playgroundContext: input.request.playgroundContext,
    allowedPointers: input.allowedPointers.slice(0, 500)
  };

  const lines = [
    "Generate PlaygroundBlueprint JSON from the input.",
    JSON.stringify(compact)
  ];

  if (input.corrective?.invalidPointers?.length) {
    lines.push(`Correction: invalid pointers were ${input.corrective.invalidPointers.join(", ")}. Use allowed pointers only.`);
  }

  return lines.join("\n\n");
}

function briefUserPrompt(input: {
  request: SynthesizeBriefRequest;
  allowedPointers: string[];
  corrective?: RetryContext;
}): string {
  const compact = {
    brief: input.request.brief,
    blueprint: input.request.blueprint,
    selectedOpportunities: (input.request.selectedOpportunities || []).map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      qualityTier: item.qualityTier,
      finalScore: item.finalScore,
      signalBoost: item.signalBoost,
      evidencePointers: item.evidencePointers
    })),
    opportunityContext: input.request.opportunityContext,
    signalScale: input.request.signalScaleContext?.length ? input.request.signalScaleContext : undefined,
    instruction: input.request.instruction,
    allowedPointers: input.allowedPointers.slice(0, 500)
  };

  const lines = ["Generate MediaOwnerBrief JSON from the input.", JSON.stringify(compact)];

  if (input.corrective?.invalidPointers?.length) {
    lines.push(`Correction: invalid pointers were ${input.corrective.invalidPointers.join(", ")}. Use allowed pointers only.`);
  }
  if (input.corrective?.invalidIds?.length) {
    lines.push(
      `Correction: invalid moment ids were ${input.corrective.invalidIds.join(", ")}. Allowed ids: ${(input.corrective.allowedIds || []).join(", ")}.`
    );
  }

  return lines.join("\n\n");
}

async function callOpenAiStructured<T>(input: {
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  parser: (value: unknown) => T;
}): Promise<T> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing");
  }

  const response = await fetchWithRetry(
    `${OPENAI_BASE_URL}/responses`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: input.systemPrompt }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: input.userPrompt }]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: input.schemaName,
            schema: input.schema,
            strict: true
          }
        }
      })
    },
    {
      timeoutMs: 30_000,
      retries: 2,
      backoffMs: 500
    }
  );

  const payload = await response.json();
  const json = extractJson(payload);
  return input.parser(json);
}

export async function synthesizeBlueprint(input: SynthesizeBlueprintRequest): Promise<{
  blueprint: PlaygroundBlueprint;
  warnings: string[];
}> {
  const parsed = SynthesizeBlueprintRequestSchema.parse(input);
  const pointerSet = collectBlueprintPointers(parsed);
  const allowedPointers = Array.from(pointerSet);

  if (!process.env.OPENAI_API_KEY) {
    return {
      blueprint: buildFallbackBlueprint({
        request: parsed,
        allowedPointers
      }),
      warnings: [FALLBACK_WARNING]
    };
  }

  const run = async (corrective?: RetryContext): Promise<{ blueprint: PlaygroundBlueprint; invalidPointers: string[] }> => {
    const raw = await callOpenAiStructured({
      systemPrompt: blueprintSystemPrompt(),
      userPrompt: blueprintUserPrompt({ request: parsed, allowedPointers, corrective }),
      schemaName: playgroundBlueprintJsonSchema.name,
      schema: playgroundBlueprintJsonSchema.schema,
      parser: (value) => PlaygroundBlueprintSchema.parse(value)
    });

    const normalized = normalizeBlueprintPointers(raw, pointerSet);
    const invalidPointers = invalidBlueprintPointers(normalized, pointerSet);
    return { blueprint: normalized, invalidPointers };
  };

  try {
    const first = await run();
    if (first.invalidPointers.length === 0) {
      return { blueprint: first.blueprint, warnings: [] };
    }

    const second = await run({ invalidPointers: first.invalidPointers });
    if (second.invalidPointers.length > 0) {
      const error = new Error("Blueprint evidence pointer validation failed") as Error & {
        invalidPointers?: string[];
        allowedPointers?: string[];
      };
      error.invalidPointers = second.invalidPointers;
      error.allowedPointers = allowedPointers;
      throw error;
    }

    return { blueprint: second.blueprint, warnings: ["Limited evidence pointers were available."] };
  } catch (error) {
    if (error instanceof FetchError) {
      throw new Error(`OpenAI call failed: ${error.message}`);
    }
    throw error;
  }
}

export async function synthesizeMediaOwnerBrief(input: SynthesizeBriefRequest): Promise<{
  brief: MediaOwnerBrief;
  warnings: string[];
}> {
  const parsed = SynthesizeBriefRequestSchema.parse(input);
  const { pointers, allowedMomentIds } = collectBriefPointers(parsed);
  const allowedPointers = Array.from(pointers);

  if (!process.env.OPENAI_API_KEY) {
    return {
      brief: buildFallbackBrief({
        request: parsed,
        allowedPointers
      }),
      warnings: [FALLBACK_WARNING]
    };
  }

  const run = async (corrective?: RetryContext): Promise<{
    brief: MediaOwnerBrief;
    invalidPointers: string[];
    invalidIds: string[];
  }> => {
    const raw = await callOpenAiStructured({
      systemPrompt: briefSystemPrompt(),
      userPrompt: briefUserPrompt({ request: parsed, allowedPointers, corrective }),
      schemaName: mediaOwnerBriefJsonSchema.name,
      schema: mediaOwnerBriefJsonSchema.schema,
      parser: (value) => MediaOwnerBriefSchema.parse(value)
    });

    const normalized = normalizeBriefPointers(raw, pointers);
    const invalidPointers = invalidBriefPointers(normalized, pointers);
    const invalidIds = invalidBriefMomentIds(normalized, allowedMomentIds);
    return {
      brief: normalized,
      invalidPointers,
      invalidIds
    };
  };

  try {
    const first = await run();
    if (first.invalidPointers.length === 0 && first.invalidIds.length === 0) {
      return { brief: first.brief, warnings: [] };
    }

    const second = await run({
      invalidPointers: first.invalidPointers,
      invalidIds: first.invalidIds,
      allowedIds: Array.from(allowedMomentIds)
    });

    if (second.invalidPointers.length > 0) {
      const error = new Error("Media brief evidence pointer validation failed") as Error & {
        invalidPointers?: string[];
        allowedPointers?: string[];
      };
      error.invalidPointers = second.invalidPointers;
      error.allowedPointers = allowedPointers;
      throw error;
    }

    if (second.invalidIds.length > 0) {
      const error = new Error("Media brief moment id validation failed") as Error & {
        invalidIds?: string[];
        allowedIds?: string[];
      };
      error.invalidIds = second.invalidIds;
      error.allowedIds = Array.from(allowedMomentIds);
      throw error;
    }

    return { brief: second.brief, warnings: ["Limited evidence pointers were available."] };
  } catch (error) {
    if (error instanceof FetchError) {
      throw new Error(`OpenAI call failed: ${error.message}`);
    }
    throw error;
  }
}
