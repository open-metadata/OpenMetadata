# The home page's Needs you now section is a class-base slot, and OSS merges before Collate

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** Shrabanti Paul
- **Guard:** `HomeLandingPage.test.tsx`; paired build and merge-order review
- **Related:** [OpenMetadata #35462](https://github.com/open-metadata/OpenMetadata/pull/35462), [Collate #7488](https://github.com/open-metadata/openmetadata-collate/pull/7488), ADR:openmetadata-collate/2026-10-14-needs-you-now-renders-through-an-oss-home-slot-in-ai-mode-only

## Context

The home page design places a ranked "Needs you now" section between the announcements rail and
the topic widgets. That page is `HomeLandingPage`. Classic mode mounts it from `MyDataPage` with no
props; Collate's AI mode mounts it from its own landing page. The section's data comes from a
Collate-only API, so OpenMetadata has nothing to render there.

## Decision

`CustomizeMyDataPageClassBase.getNeedsYouNowSection()` returns a prop-less `ComponentType`, or
`null`. OpenMetadata returns `null`, and its home page renders no section. `HomeLandingPage` renders
whatever the method returns between the announcements rail and the topic widgets, inside its own
`Suspense` boundary with a `null` fallback, so a lazily loaded section never holds up the rest of
the page. The slot is mode-agnostic: it renders under both mounts, and the returned component
decides for itself which app modes show it.

It is a class-base method, not a prop, for the same reason as `getPlatformHealthInsight`: only the
class base reaches both mounts, and OpenMetadata keeps no dependency on the API behind the section.

Merge OSS #35462 first, then Collate #7488, which overrides the method and moves its
`OpenMetadata` submodule onto the merged commit. Collate cannot build against an OpenMetadata that
lacks the method.

## Consequences

Moving the section on the page is a change to `HomeLandingPage` here, not to Collate. The slot
takes no props: a section that needs page state reads it from its own stores or hooks, and giving
it props would change this contract on both sides. Until Collate #7488 merges, a Collate build on
OpenMetadata main simply shows no section, which is the safe direction of the window.
