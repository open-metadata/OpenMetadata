# Domain chips read each domain's style from one cached query per FQN

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** Shrabanti Paul
- **Guard:** `DomainTags.test.tsx` (chip takes the domain's colour and icon); reviewer, for invalidation by new writers
- **Related:** PR #36409, ADR:2026-10-14-entity-detail-query-keys-start-with-entity-type-and-fqn

## Context
Assets carry their domains as plain `EntityReference`s, which hold no `style`. Every `DomainTag`
therefore fell back to the default colour and globe, even for a domain with a custom colour and
icon. The chip renders on every asset header and on every Explore result card, so fetching the
domain per chip could fan out across a results page.

## Decision
- `useDomainStyle(fqn)` reads `GET /domains/name/{fqn}` (no `fields`, since `style` is a base
  field) and caches `style` under `domainStyleQueryKey(fqn)` =
  `[EntityType.DOMAIN, fqn, 'style']`. Chips for the same domain share one request.
  `StyledDomainTag` passes its `color` and `iconURL` to the core `DomainTag`.
- The key follows the `[EntityType, FQN, ...]` detail-key shape, so a prefix refresh of
  `['domain', fqn]` also refreshes that domain's chips.
- The query is bound to the app `queryClient` singleton, not the nearest provider. The chip sits
  deep inside shared components that many suites render without one.
- `staleTime` is 5 minutes, overriding the client's stale-while-revalidate default. A style
  changes rarely, and a results page would otherwise refetch every domain on each mount.
- **Every code path that writes a domain's `style` must invalidate `domainStyleQueryKey(fqn)`.**
  Today that is `DomainDetails.onStyleSave`. A domain the viewer cannot read keeps the default chip
  (`retry: false`).

## Consequences
Chips show a domain's own colour and icon wherever they render, at the cost of one small GET per
distinct domain per five minutes. A new style writer (a create form that edits an existing domain,
a bulk edit, an import) that skips the invalidation leaves chips stale for up to five minutes. To
revisit this, the server would put `style` on the domain `EntityReference` (and the search
document), and the lookup could go.
