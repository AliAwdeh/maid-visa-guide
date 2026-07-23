# Design brief — Maid Visa Guide (maids.cc)

- **Design read**: UAE families who just hired a live-in maid on a Maid Visa contract; they open this from a WhatsApp message on their phone. Register: reassuring, official, effortless.
- **Concept spine**: "a guided journey" — the whole page is one continuous, stepped path (visa steps → payment rhythm → her rights), mirroring the client's actual onboarding journey.
- **Delivery tier**: editorial — calm, typographic, mobile-first; micro-motion only (accordion reveals, scroll-spy tabs, step progress).
- **Locked palette** (client's existing brand deck — override of catalog bans): navy `#152741` text, brand blue `#4A77C4`, soft blue wash `#EDF2FB`, accent orange `#F5921E` (process highlights), confirmation green `#1E9E6A`, white ground. Defense: these are the exact colors of the maids.cc client deck this page replaces; continuity beats novelty for an official document.
- **Locked type**: system humanist sans stack (`Inter`-like via ui-sans) — the page must load instantly on mobile data inside WhatsApp's in-app browser; no webfont blocking.
- **Tier-1 technique**: sticky segmented section nav with scroll-spy + expandable payment-breakdown cards. Enacts the spine: the reader always sees where they are on the journey.
- **Section plan**: hero summary strip → 1. Visa Timeline (vertical stepper) → 2. Payments & Salary (rhythm cards + expandable breakdowns) → 3. Her Rights (icon card grid) → footer note. One layout family per section.
- **Asset plan**: inline SVG icon set (stroke, brand blue/orange), locally composed favicon + OG card (brand navy/blue, no external assets).
- **CTA inventory**: none — informational guide; the only interactive chrome is navigation + disclosure.
- **Content note**: month names from the source deck (July/Aug/Sep) generalized to Month 1/2/3 so one link serves every client cohort.
