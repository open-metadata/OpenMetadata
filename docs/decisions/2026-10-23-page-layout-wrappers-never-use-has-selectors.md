# Page layout wrappers never style themselves with a :has() selector

- **Status:** Accepted
- **Revisions:** v1 2026-10-23 (initial)
- **Deciders:** UI team
- **Guard:** `PageLayoutV1.test.tsx` › "Should never render a :has() class on any layout wrapper" and "Should be told fillEntityTabs by every page that renders entity tabs"
- **Related:** #35730 (introduced the selectors), openmetadata-nightly run 39873031604

## Context

#35730 made the AI shell's entity tab panel fill the canvas with Tailwind classes such as
`tw:in-[.assistant-content]:has-[.entity-details-page-tabs]:flex` on `PageLayoutV1`'s `Grid` and
`Grid.Item`. Those two elements wrap the content of nearly every page, classic mode included.

The `in-[.assistant-content]` part only decides whether the rule matches. Chrome tracks `:has()`
invalidation on every element that carries the class. After that, each DOM mutation anywhere in
the page searches the wrapper's subtree for `.entity-details-page-tabs` again, and every forced
layout pays for it. On Settings › Teams, where each of ~150 child teams renders a tiptap
description preview, the production bundle froze the main thread for 13.7 s locally (2.1 s before
#35730, 2.8 s with only those four rules removed) and for over 20 s on CI. Three Teams Playwright
specs then timed out in every attempt. The Vite dev server's CSS did not reproduce the freeze; only
the built bundle did.

## Decision

- A page-level wrapper (`PageLayoutV1`, and any element that wraps a whole page's content) never
  carries a `:has()` / `tw:has-[...]` selector.
- `PageLayoutV1` applies the entity tabs fill classes only when the page passes `fillEntityTabs`.
  Every page that renders `.entity-details-page-tabs` passes it, here and in downstream
  distributions that render `PageLayoutV1` (Collate's Observability pipeline page). The classes
  stay scoped to `.assistant-content` with plain descendant variants.

## Consequences

- Classic pages and AI-shell pages without entity tabs no longer carry the fill selectors at all.
- A new entity page that renders `.entity-details-page-tabs` has to pass `fillEntityTabs`, or its
  tab panel ends under its content in the AI shell. That costs layout, not correctness.
- `:has()` is still fine on small, bounded components. Revisit this rule only if browsers stop
  re-running `:has()` subtree checks on every mutation.
