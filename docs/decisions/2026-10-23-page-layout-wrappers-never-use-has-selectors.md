# Page layout wrappers never carry a :has() selector

- **Status:** Accepted
- **Revisions:** v1 2026-10-23 (initial)
- **Deciders:** UI team
- **Guard:** `PageLayoutV1.test.tsx` › "Should never render a :has() class on any layout wrapper" and "Should be told fillEntityTabs by every page that renders entity tabs"
- **Related:** #35730 (introduced the selectors), openmetadata-nightly run 39873031604

## Context

#35730 made the AI shell's entity tab panel fill the canvas with Tailwind classes such as
`tw:in-[.assistant-content]:has-[.entity-details-page-tabs]:flex` on `PageLayoutV1`'s `Grid` and
`Grid.Item`. Those two elements wrap the content of nearly every page, classic mode included.

The `in-[.assistant-content]` part only decides whether the rules match. On Settings › Teams,
where each of ~150 child teams renders a tiptap description preview, the production bundle froze
the main thread for 13.7 s locally (2.1 s before #35730) and for over 20 s on CI. Three Teams
Playwright specs then timed out in every attempt. The Vite dev server did not reproduce the freeze;
only the built bundle did.

#35730 added four `:has()` rules. Removing them one group at a time, on the same page with 231
teams, isolates the cost:

| CSS | Longest task | Total long tasks |
|---|---|---|
| All four rules | 6.5 s | 21 s |
| Without `has-[…]:*:flex-[1_0_auto]` (`X:has(.tabs) > *`) | 0.4 s | 1 s |
| Without the three rules that style the wrapper itself (`X:has(.tabs)`) | 6.5 s | 21 s |

The cost is the rule whose `:has()` sits on the wrapper but whose style lands on every child
(`> *`). Chrome then re-matches every child of the wrapper on each DOM change inside it. Narrow
`:has()` rules that style the wrapper itself, or one named descendant (the existing
`.page-layout-v1-center:has(#page-alert)` in `page-layout.less`), measured negligible.

## Decision

- A page-level wrapper (`PageLayoutV1`, and any element that wraps a whole page's content) never
  carries a `:has()` that styles a broad set of other elements: `X:has(y) > *`, `X:has(y) *`, or
  Tailwind `has-[y]:*:` / `has-[y]:**:`.
- `PageLayoutV1` renders no `has-[` class at all. The narrow forms are one `*:` away from the
  broad one, and an explicit prop gives the same layout.
- `PageLayoutV1` applies the entity tabs fill classes only when the page passes `fillEntityTabs`.
  Every page that renders `.entity-details-page-tabs` passes it, here and in downstream
  distributions that render `PageLayoutV1` (Collate's Observability pipeline page). The classes
  stay scoped to `.assistant-content` with plain descendant variants.

## Consequences

- Classic pages and AI-shell pages without entity tabs no longer carry the fill selectors at all.
- A new entity page that renders `.entity-details-page-tabs` has to pass `fillEntityTabs`, or its
  tab panel ends under its content in the AI shell. That costs layout, not correctness.
- Existing narrow `:has()` rules on page wrappers (`page-layout.less`) stay as they are.
- `:has()` is still fine on small, bounded components. Revisit this rule only if browsers stop
  re-matching `:has()`-dependent descendants on every mutation.
