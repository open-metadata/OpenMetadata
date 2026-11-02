# Classic sidebar path aliases are a class-base hook, and OSS merges before Collate

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** Harsh Vador
- **Guard:** `LeftSidebarClassBase.test.ts`, `LeftSidebar.test.tsx`; merge-order review
- **Related:** [OpenMetadata #35851](https://github.com/open-metadata/OpenMetadata/pull/35851), [OpenMetadata #35850](https://github.com/open-metadata/OpenMetadata/issues/35850)

## Context

The Classic sidebar marks an item current from the route. Some routes live outside their item's
own path: a glossary term sits under `/glossary-term`, not `/glossary`. OpenMetadata maps those in
`SIDEBAR_ENTITY_PATH_ALIASES`, but `LeftSidebar` read the constant directly, so a downstream build
had no way to add its own. Collate's custom dashboards live at `/data-insight/custom-dashboard`,
which the Insights item does not own, so no item was marked current there.

## Decision

`LeftSidebarClassBase.getSidebarPathAliases()` returns a map from a route prefix to the Classic
sidebar item key it marks current. OpenMetadata returns `SIDEBAR_ENTITY_PATH_ALIASES`. `LeftSidebar`
passes the result to `getSidebarActiveKeys`. That function first checks the nested keys on the
route's first two path segments, then the aliases on the first two segments, then the aliases on
the first segment alone. It falls back to the first segment itself.

A downstream build overrides the method by spreading `super.getSidebarPathAliases()` and adding the
routes it owns. It never replaces the map, which would drop OpenMetadata's aliases.

Merge OpenMetadata #35851 first. The Collate override follows it and moves Collate's `OpenMetadata`
submodule onto the merged commit, because Collate cannot build against an OpenMetadata that lacks
the method.

## Consequences

An alias is an OpenMetadata constant entry or a Collate override entry, never a special case in
`LeftSidebar`. A key with more than two segments never matches, because the lookup reads at most
two. AI mode does not use this hook: its sidebar resolves active items from its own module routes.
Until the Collate override lands, Collate's custom dashboard pages mark no Classic item current,
which is how they behave today.
