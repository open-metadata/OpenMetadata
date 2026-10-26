# Tasks follow an entity's FQN change from EntityUpdater.storeUpdate, scoped by entity type

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `TaskAboutFqnChangeIT` (one test per renamable or movable entity, plus the same-FQN
  domain/glossary collision)
- **Related:** #36215

## Context
A task finds its entity through `task_entity.aboutFqnHash`, the per-level hash of the entity's
FQN. Only the glossary and glossary-term repositories rewrote it on a rename or move. Renaming a
domain, tag, classification or data product, or moving a tag or container, left the tasks at the
old FQN. The glossary rewrite also matched the hash alone, and two entity types can share an FQN
(a domain and a glossary both named `X`), so renaming one moved the other's tasks.

## Decision
- `EntityUpdater.storeUpdate` and `storeUpdateWithOptimisticLocking` repoint tasks and workflow
  instances whenever the stored FQN differs from `originalFqn`, the FQN the request started from.
  Repositories do not repoint tasks themselves.
- The task rewrite is one prefix update over the entity and its subtree
  (`aboutFqnHash = old OR LIKE 'old.%'`). It moves only the tasks whose `about` relationship comes
  from one of the types `getFqnSubtreeEntityTypes()` returns: the entity's own type by default.
  A repository whose FQN prefixes another type's FQNs overrides it (classification → tag,
  glossary → glossaryTerm).
- A type goes in that set only when its FQNs really are nested under the parent's FQN. Data
  products have single-level FQNs, so a domain's set holds only `domain`. Adding a type whose FQNs
  can equal the parent's brings the collision back.

## Consequences
New renamable or movable entities are covered without wiring. An entity whose rename cascades to
another type's FQNs must override `getFqnSubtreeEntityTypes()`. The bulk
`updateWithDeferredStore` path does not repoint; it serves ingestion, which does not rename.
Reads by `aboutEntity` still match the hash without a type, so a listing for `X` also shows the
tasks of another entity type named `X`; fixing that is a separate change.
