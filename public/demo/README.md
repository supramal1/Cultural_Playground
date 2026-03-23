# Demo Scenario Packs — AirBnB GenZ Students

> **All data in this folder is SYNTHETIC DEMO DATA.**
> It is designed for UX validation, demo presentations, and testing ranking logic.
> Do not treat as production evidence or share as market insight.

## How to use

Upload the audience and search CSV files via the brief form. Each scenario is a pair of files.

Recommended brief settings for all three scenarios:
- **Brand:** Airbnb
- **Objective:** Drive bookings among GenZ students
- **Audience keyword:** Gen Z students
- **Date range:** Feb – Apr 2026
- **Boost keywords:** city break, weekend away, self-catering

---

## Scenario A — Clear Fit (`scenario-a-audience.csv` + `scenario-a-search.csv`)

**What it shows:** Strong, unambiguous signals pointing to Travel & Experiences as the #1 playground.

- High-index travel affinities (Airbnb 291, city break 305, budget travel 427)
- Fast-rising search for student travel terms
- No cross-category noise

**Expected output:** Travel & Experiences recommended first, high confidence band, core audience alignment.

---

## Scenario B — Adjacent High-Growth Fit (`scenario-b-audience.csv` + `scenario-b-search.csv`)

**What it shows:** The scenario that prompted this feature build. Travel signals are present but family/nostalgia affinities are also elevated — Disney+, school holidays, animated content. This causes Family & Kids to surface as a high-scoring playground.

**Key "proof" rows:**
- Disney+ index 221 (far above baseline)
- Animated films index 200
- School holidays fast-rising in search
- Family day out / kids activities appearing in affinities

**Expected output:**
- Travel & Experiences still recommended first (core audience alignment)
- Family & Kids surfaces with **Adjacent Audience** badge (amber) and the demo GWI growth note
- Clear separation between core recommendation and adjacent expansion play

---

## Scenario C — Weak Fit (`scenario-c-audience.csv` + `scenario-c-search.csv`)

**What it shows:** No dominant affinity cluster. Mostly generic lifestyle signals (Netflix, Instagram, TikTok) with low index scores and declining/top trend buckets. Represents a planner uploading low-signal or off-topic insights.

**Expected output:**
- Playground fitScores cluster closely together
- Low/medium confidence band
- System warning: "Low-confidence playground suggestions (limited overlap signals)"
- No single strong recommendation — planners should be asked to add boost keywords or upload better insights

---

## Data ranges used

| Signal | Range in data |
|--------|--------------|
| Index | 70–738 (weak fit tops out ~158, strong fit reaches 500+) |
| Relevance | 0.56–0.97 |
| Trend buckets | Fast Rising, Sustained, Top, Emerging, Declining |
| YoY Growth | -0.18 to +0.67 |
| MoM Growth | -0.06 to +0.21 |

Stats labelled `[Demo GWI data]` in the taxonomy are illustrative approximations based on publicly reported directional trends — replace with a live GWI pull when available.
