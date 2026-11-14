# Entity detail React Query keys start with [EntityType, FQN]

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `openmetadata-ui/src/main/resources/ui/src/rest/queries/entityDetailQueryKeys.test.ts`
- **Related:** #17882, PR #35467

## Context
Accepting a description or tag suggestion has to refresh the entity page it was accepted on.
`SuggestionsProvider` wraps every entity detail page, but it does not know which query each page
uses. Before this record, only the table page refreshed. The other pages kept showing stale data
until a reload. One key (`mlModelQueryKey`) had also drifted to `'mlModel'`, while
`EntityType.MLMODEL` is `'mlmodel'`, and nothing caught it.

## Decision
Every entity detail query key in `src/rest/queries/*Query.ts` has the shape
`[<EntityType value>, <entity FQN>, ...]`. After an accepted suggestion, `SuggestionsProvider`
prefix-invalidates `[entityType, entityFqn]`. A new entity detail query must follow this shape and
should build its first element from `EntityType.*`. A page that does not load its entity through
React Query must refetch on the `updateDetails` pub/sub event instead, as the Drive pages do.

## Consequences
Adding an entity to the suggestions flow needs no per-page refresh code, as long as its detail
query follows the shape. Renaming a key's first element, or keying by id instead of FQN, silently
breaks the refresh after an accept. The guard test fails for every listed key, and a new detail
query has to be added to that list. To revisit this, the provider would need an explicit per-page
refresh callback instead of a key convention.
