# Domain chips resolve their style by domain id

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Shrabanti Paul
- **Guard:** `domainStyleBatcher.test.ts`, `DomainTags.test.tsx`, `DomainDetailPage.test.tsx`
- **Related:** #36511, PR #36464, PR #13233

## Context
An asset carries its domains as `EntityReference`s, which have no `style`, so every domain chip
drew the default colour and globe. Copying the style onto domain references on the server was
tried and rejected in review. `EntityReference` identifies an entity and is shared by 181 schemas.
PR #13233 put `style` on the styled entities and on `TagLabel`, not on references. The schema's
`additionalProperties: false` would make older Python clients reject any entity whose domain has a
style. And every read, write and search document would pay a domain lookup just to colour a chip.

## Decision
- `EntityReference` stays as it is. The UI looks a domain's colour and icon up by the domain id it
  already has.
- `useDomainStyles` reads one React Query entry per domain, `['domain-style', <id>]`, holding the
  domain's `color` and `iconURL`, or `null` when it has neither. The key sits outside the
  `['domain', <fqn>]` namespace, so prefix invalidation of a domain's detail query never matches it.
- Every lookup fired in the same microtask goes out as one search on the `domain` index
  (`id.keyword` terms, `id` and `style` only, at most 100 ids per request) with the domain scope
  filter skipped. A page of chips costs one request; a domain already cached costs none.
- An entry stays fresh for 5 minutes. A domain update in this tab writes the saved style straight
  into its entry (`cacheDomainStyle`), rather than invalidating it, because the domain's search
  document may not show the new style yet.

## Consequences
Chips draw their domain's style with no schema change and no cost to the API or ingestion. On a
cold cache a chip draws the default until its batch returns. A restyle made in another tab or by
another user shows within 5 minutes. Any new UI path that updates a domain must call
`cacheDomainStyle` with the saved domain, or its chips stay stale until the entry expires. A chip
staged in `DomainSelect`'s multi-select draws the default until the selection is applied. A
component that renders `DomainTags` or `DomainSelect` needs a `QueryClientProvider` in tests.
Data products can reuse the same lookup under their own key.
