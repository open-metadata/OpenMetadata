# Domain chips read every domain's style from one shared, cached query

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** Shrabanti Paul
- **Guard:** `DomainTags.test.tsx` (chip takes the domain's colour and icon; two chip groups make one request); reviewer, for invalidation by new writers
- **Related:** PR #36409, ADR:2026-10-14-entity-detail-query-keys-start-with-entity-type-and-fqn

## Context
Assets carry their domains as plain `EntityReference`s, both from the entity API
(`?fields=domains`) and in their search documents, and neither holds `style`. Every `DomainTag`
therefore fell back to the default colour and globe, even for a domain with a custom colour and
icon. The chip renders on every asset header and every Explore result card, so a lookup per
domain would cost a request per distinct domain on the page.

## Decision
- `useDomainStyle(fqn)` reads from one React Query entry, `DOMAIN_STYLES_QUERY_KEY` =
  `[EntityType.DOMAIN, 'styles']`. It holds a `fullyQualifiedName → style` map from a single
  search on the domain index that returns only `fullyQualifiedName` and `style`. The search sends
  `skipDomainFilter`, because a chip names whatever domain the asset is in, not only the one the
  app is scoped to. `StyledDomainTag` passes the style's `color` and `iconURL` to the core
  `DomainTag`.
- The search reads up to `DOMAIN_STYLES_LIMIT` (1000) domains. Domains are a small, admin-curated
  set. A domain past the cap keeps the default chip rather than costing a request of its own.
- The query is bound to the app `queryClient` singleton, not the nearest provider. The chip sits
  deep inside shared components that many suites render without one.
- `staleTime` is 5 minutes, overriding the client's stale-while-revalidate default, so a results
  page does not refetch on every mount. A failed read keeps the default chip (`retry: false`).
- **Every code path that writes a domain's `style` must invalidate `DOMAIN_STYLES_QUERY_KEY`.**
  Today that is `DomainDetails.onStyleSave`.

## Consequences
A page makes one small request for domain styles however many chips or domains it shows, and
reuses it for five minutes. A new style writer that skips the invalidation leaves chips stale for
up to five minutes. An estate with more than 1000 domains shows default chips for the rest. To
revisit this, the server would put `style` on the domain `EntityReference` and on the domain refs
in asset search documents, and this lookup could go.
