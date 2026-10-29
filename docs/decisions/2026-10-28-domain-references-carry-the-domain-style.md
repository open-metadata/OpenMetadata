# Domain references carry the domain's colour and icon

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** Shrabanti Paul
- **Guard:** `DomainResourceIT.test_domainReferencesCarryTheDomainStyle` (reads, create, move and restyle, API and search); `DomainTags.test.tsx`
- **Related:** PR #36409 (where a UI-side lookup was tried and withdrawn)

## Context
An asset carries its domains as `EntityReference`s, from the entity API and in its search
document. Neither held `style`, so every domain chip fell back to the default colour and globe,
even for a domain with a custom colour and icon. Tags never had this problem: a `TagLabel` has a
`style`, filled from the tag by `TagLabelUtil.applyTagCommonFields`. A UI lookup of every domain's
style worked but cost a request per page and duplicated what the server already knows.

## Decision
- `EntityReference` has an optional `style` (`basic.json#/definitions/style`). **Only domain
  references fill it.** Every other reference leaves it unset.
- `EntityRepository.withDomainStyles` copies the domain's `color` and `iconURL`, never its cover
  image, onto each domain reference, reading the cached domain. A domain with neither leaves
  `style` unset. It runs where domain references are produced: on reads in `getDomains`,
  `batchFetchDomains` and finally `clearFieldsInternal`, which every read path ends in; on writes
  in `validateDomains`, `validateDomainsByRef`, `EntityMapper.validateDomains` and bulk create. Domains reach an entity through
  several loaders (single read, bulk relationship load, inheritance, the Team, User and Task
  repositories' own helpers), so the final read pass is what guarantees the style; the write paths
  matter because a created or re-domained asset is indexed from its in-memory references.
- The relationship cache stores domain references unstyled, and the style is added on every read,
  so a domain restyle never leaves a stale copy in that cache.
- Every search document's domains pass through `SearchIndex.getEntitiesWithDisplayName`, which
  styles the domain references it copies, so a document is styled however its entity was built
  (create, update, reindex). `SearchRepository.relabelReferenceCopies` rewrites a domain's copies
  when its `style` changes, as it does for its name and display name.
- The UI draws a domain chip from `reference.style` and makes no lookup of its own.

## Consequences
A domain chip shows its own colour and icon wherever an asset's domains are read, with no extra
request. A read path that returns entities without going through `clearFieldsInternal`, or a write path
that indexes domain references it built itself, must call `withDomainStyles`, or its chips fall
back to the default. Search documents indexed before this change carry unstyled references
until the asset is reindexed or the domain is restyled. Extending `style` to other references
(data products, for instance) would follow the same pattern but needs its own record.
