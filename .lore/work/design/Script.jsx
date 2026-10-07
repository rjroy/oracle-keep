/* global */

// ── Personas — the four oracles you can consult ────────────────────
const PERSONAS = [
  {
    id: 'oracle',
    name: 'The Oracle',
    avatar: 'O',
    role: 'General counsel',
    tagline: 'Speaks in steady, plain measures. Will draw a map if asked.',
    voice: 'wry, knowledgeable, patient',
  },
  {
    id: 'cartographer',
    name: 'The Cartographer',
    avatar: 'C',
    role: 'Research & sources',
    tagline: 'Unrolls the maps. Prefers footnotes and freshly-charted ground.',
    voice: 'meticulous, citation-forward',
  },
  {
    id: 'loremaster',
    name: 'The Loremaster',
    avatar: 'L',
    role: 'History & deep reading',
    tagline: 'Knows what the old books say. Brings the long view.',
    voice: 'literary, contextual',
  },
  {
    id: 'tinker',
    name: 'The Tinker',
    avatar: 'T',
    role: 'Code & instruments',
    tagline: 'Hands stained with ink and solder. Loves a working prototype.',
    voice: 'technical, hands-on',
  },
];

// ── Tools the Oracle can use ───────────────────────────────────────
const TOOLS = {
  lens: {
    id: 'lens',
    name: "The Cartographer's Lens",
    desc: 'Scry the open web',
    icon: 'Eye',
  },
  archive: {
    id: 'archive',
    name: 'The Archive',
    desc: 'Read from the keep',
    icon: 'Book',
  },
  loom: {
    id: 'loom',
    name: 'The Loom',
    desc: 'Spin and run code',
    icon: 'Code',
  },
  rookery: {
    id: 'rookery',
    name: 'The Rookery',
    desc: 'Send word abroad',
    icon: 'Quill',
  },
};

// ── A seed transcript — scripted but feels lived-in ────────────────
//
// Layout: archived (compacted) segments at the top, then the recent
// conversation. The Archivist appears between segments.
//
// Each item: { kind, ... }
//   kind: 'archive'  — a compacted summary card
//   kind: 'user'     — a user message
//   kind: 'oracle'   — an assistant message (with optional tool calls)
//   kind: 'tool'     — a standalone tool card embedded between turns

const SEED = [
  // ── Archived bundle 1 ────────────────────────────────────────────
  {
    kind: 'archive',
    id: 'arc-1',
    timeAgo: '3 weeks ago',
    title: 'On naming a side project',
    summary:
      "You shared a list of working titles for a desk-side reference tool. The Oracle warmed to 'Lectern' and 'Marginalia'; you settled on Marginalia after a digression on margin notes in 17th-c. books. Eight exchanges. Two scrolls of source material consulted.",
    detail: [
      { kind: 'user', who: 'you', text: "I'm naming a small reference tool. Working list: Lectern, Marginalia, Codex, Stack, Glossa. Thoughts?" },
      { kind: 'oracle', who: 'oracle', text: "Lectern and Marginalia are the strongest. Lectern names the *place* you read; Marginalia names what you *leave behind*. The rest are common in this space — three are crates on npm." },
    ],
    turns: 8,
  },
  {
    kind: 'archive',
    id: 'arc-2',
    timeAgo: '2 weeks ago',
    title: 'Drafting the workshop schedule',
    summary:
      "You sketched a four-week schedule for the woodworking workshop in the back garden. The Oracle suggested moving 'finishing' before 'joinery' would be a mistake; you kept it after. The Cartographer pulled three references on dovetail layout. Quest finished and gilded.",
    turns: 14,
  },
  {
    kind: 'archive',
    id: 'arc-3',
    timeAgo: '6 days ago',
    title: 'The bookshelf measurements',
    summary:
      "You measured the alcove (1842 × 2310 mm), and the Tinker computed shelf spacing for octavo through folio bindings. Final layout: five shelves, base 360 mm, then 320 / 280 / 240 / 240. The Tinker offered a SketchUp file via the Loom; you declined.",
    turns: 6,
  },
  {
    kind: 'archive',
    id: 'arc-4',
    timeAgo: 'yesterday',
    title: 'On the dragonfly drawing',
    summary:
      "You shared a watercolor of a damselfly mis-identified as a dragonfly. The Loremaster supplied the distinction (wing posture at rest), the Cartographer matched the species to *Calopteryx splendens*, and the Oracle praised the wing-tip detail.",
    turns: 4,
  },

  // ── Recent (in-flight) conversation ──────────────────────────────
  {
    kind: 'user',
    id: 'u-1',
    timeAgo: '2 hours ago',
    text: "I'm trying to choose between a fountain pen and a dip pen for the new commonplace book. The book has 100 gsm Tomoé River-style paper. What would you choose, and why?",
  },
  {
    kind: 'oracle',
    id: 'o-1',
    persona: 'oracle',
    timeAgo: '2 hours ago',
    text:
`For a Tomoé-style paper at 100 gsm, I would pick a **fountain pen** — but not just any fountain pen.

Here's why, briefly:

- **Tomoé paper is smooth and slightly sized.** It shows shading and sheen from a wet fountain pen ink beautifully. A dip pen will work, but the ink sits *on top* of the surface and risks smearing on a slick sheet.
- **A commonplace book is for sustained writing.** Dipping every few words breaks the rhythm of thought — fine for calligraphy, less so for the kind of flow you'll want for thinking on paper.
- **Maintenance is gentler.** A modern fountain pen with a fine nib (F or EF) on this paper is a quiet, repeatable tool.

If you want the *feeling* of a dip pen — the slight scratch, the line variation — look for a fountain pen with a flexible nib, or a *italic* nib. A Pilot Custom 912 with the FA nib is the classic answer; a Sailor zoom nib is the eccentric one.

> One caveat: if your ink budget allows experimentation with sheening inks (Pilot Iroshizuku *Yama-budo*, Rohrer & Klingner *Alt-Goldgrün*), the fountain-pen-on-Tomoé pairing is the bigger reward.

Shall I check what's in stock locally, or pull a comparison of nib flex from current pen reviewers?` ,
  },
  {
    kind: 'user',
    id: 'u-2',
    timeAgo: '1 hour ago',
    text: "Yes — pull a comparison of nib flex from recent reviewers. I want to see what's actually being said in 2026, not the same forum posts from 2018.",
  },
  {
    kind: 'oracle',
    id: 'o-2',
    persona: 'cartographer',
    timeAgo: '1 hour ago',
    toolCalls: [
      {
        id: 'tc-1',
        tool: 'lens',
        status: 'done',
        args: { query: 'fountain pen flex nib review 2026', recency: 'last 6 months', limit: 6 },
        result: {
          summary: 'Six recent posts — three from independent reviewers, two from retailers, one community thread.',
          sources: [
            { n: 1, title: 'Two years with the FA: a long-form review', domain: 'inkforge.review', date: '2026-04-02' },
            { n: 2, title: 'Sailor zoom vs. Pilot FA — flex in practice', domain: 'desk-and-quill.com', date: '2026-03-18' },
            { n: 3, title: 'On nib softness — what reviewers mean and what you feel', domain: 'thefountainpennetwork.org', date: '2026-02-11' },
            { n: 4, title: 'Pen inventory, spring 2026', domain: 'inkstone.shop', date: '2026-05-01' },
            { n: 5, title: '50-page test: Iroshizuku on Tomoé 100 gsm', domain: 'paperandink.studio', date: '2026-01-29' },
            { n: 6, title: 'Re: dip pen vs. flex — a working draughtsman weighs in', domain: 'reddit.com/r/fountainpens', date: '2026-04-22' },
          ],
        },
      },
    ],
    text:
`Six new posts, all from the last four months. The summary, as I read them:

1. **The Pilot FA still leads for flex on smooth Japanese papers.** Inkforge and Desk & Quill both put it first, citing the same combination — soft tines, generous wet flow, holds line variation without rail-roading.
2. **The Sailor zoom is the wildcard.** It is *not* a flex nib — it is a stub that responds to angle. Desk & Quill's reviewer kept switching between them mid-page; that is what you want from a commonplace book pen.
3. **Reviewers are clearer about what "soft" means than they were five years ago.** Most posts now distinguish *flex* (line variation under pressure), *bounce* (cushion, no variation), and *spring* (returns fast). You probably want bounce + a little flex.

The full citations:

- [1] inkforge.review — *Two years with the FA*
- [2] desk-and-quill.com — *Sailor zoom vs. Pilot FA*
- [3] thefountainpennetwork.org — *On nib softness*
- [5] paperandink.studio — *50-page test on Tomoé 100 gsm*

If you want, I can have the Tinker render a quick comparison table from these. Or, the Cartographer can chart a longer survey — fifty reviewers instead of six — and we set out properly.` ,
  },
  {
    kind: 'user',
    id: 'u-3',
    timeAgo: '40 minutes ago',
    text: "Render the comparison table. Keep it short — five nibs, three columns.",
  },
  {
    kind: 'oracle',
    id: 'o-3',
    persona: 'tinker',
    timeAgo: '38 minutes ago',
    toolCalls: [
      {
        id: 'tc-2',
        tool: 'loom',
        status: 'done',
        args: {
          language: 'python',
          script: "import pandas as pd\nnibs = [\n  ('Pilot FA',         'soft, true flex', 'wet, generous', 'commonplace, journaling'),\n  ('Sailor Zoom',      'stub, angle-responsive', 'wet to medium', 'note-taking, switching scripts'),\n  ('Pilot Custom 912 FA','soft, controlled flex','wet','daily flex'),\n  ('Conklin Omniflex', 'soft, true flex',  'very wet',     'experimental, signatures'),\n  ('Lamy 2000 EF',     'firm, bounce',     'medium',       'quick prose, marginalia'),\n]\ndf = pd.DataFrame(nibs, columns=['Nib','Feel','Flow','Best for'])\nprint(df.to_markdown(index=False))" ,
        },
        result: {
          summary: 'Table rendered in 0.7s · pandas 2.1.4',
          markdown:
`| Nib                  | Feel                    | Flow            |
|----------------------|-------------------------|-----------------|
| Pilot FA             | soft, true flex         | wet, generous   |
| Sailor Zoom          | stub, angle-responsive  | wet to medium   |
| Pilot Custom 912 FA  | soft, controlled flex   | wet             |
| Conklin Omniflex     | soft, true flex         | very wet        |
| Lamy 2000 EF         | firm, bounce            | medium          |` ,
        },
      },
    ],
    text:
`Five nibs, three columns. (Best-for column dropped — it duplicated what we already discussed.)

| Nib                  | Feel                    | Flow            |
|----------------------|-------------------------|-----------------|
| Pilot FA             | soft, true flex         | wet, generous   |
| Sailor Zoom          | stub, angle-responsive  | wet to medium   |
| Pilot Custom 912 FA  | soft, controlled flex   | wet             |
| Conklin Omniflex     | soft, true flex         | very wet        |
| Lamy 2000 EF         | firm, bounce            | medium          |

If you'd like the table as CSV, or rendered for the journal itself (small, set in Vollkorn), say the word and the Tinker will hand it over.` ,
  },
  {
    kind: 'user',
    id: 'u-4',
    timeAgo: '5 minutes ago',
    text: "Perfect. Last thing — what's the difference between the regular Pilot FA and the Custom 912 FA? They look the same on paper.",
  },
  {
    kind: 'oracle',
    id: 'o-4',
    persona: 'oracle',
    timeAgo: '4 minutes ago',
    text:
`They share a nib *unit*, not a pen.

- **The "Pilot FA"** in casual usage often means the FA nib *fitted to a Custom Heritage 912* — they are the same pen.
- **A real distinction is between the 912 FA and the older Falcon (Elabo).** The Falcon has a smaller, more flexible nib in a different housing; many reviewers prefer it for line variation, but it tires the hand on long sessions.

So: if a reviewer says "Pilot FA," they almost always mean the 912 FA. If they say "Falcon," they mean a softer, lighter, more tiring pen with a similar tine geometry.

Would you like the Cartographer to chart all of Pilot's flex offerings? It would take a moment.` ,
  },
];

Object.assign(window, { PERSONAS, TOOLS, SEED });
