# Tasks follow an entity's FQN change from EntityUpdater.storeUpdate, scoped by entity type

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `TaskAboutFqnChangeIT` (domain, tag, classification, data product and glossary
  rename; tag and container move; the same-FQN domain/glossary collision) and
  `GlossaryTermResourceIT#test_moveTermWithTaskToEighthLevel_repointsTask` (term move)
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
- The entity's own tasks move on an exact hash match. Tasks of the types
  `getNestedFqnEntityTypes()` returns move on the `hash.%` prefix. The default is none; a
  repository whose FQN prefixes nested entities overrides it (domain → domain, tag → tag,
  glossary → glossaryTerm, glossaryTerm → glossaryTerm, classification → tag, container →
  container, page → page). Every rewrite only touches tasks whose `about` relationship comes from
  the matched types.
- A type is nested only when its FQNs are built from the parent's FQN. Metric, metric group and
  data product FQNs are the bare name, so metric `X.Y` hashes under metric `X` without being in it;
  giving them a prefix match would move an unrelated entity's tasks.

## Consequences
The repoint runs only when the update was stored, so a rename the updater drops moves nothing.
Every rename or move is covered without wiring; an entity whose FQN prefixes nested entities must
override `getNestedFqnEntityTypes()`, or their tasks stay behind. The bulk
`updateWithDeferredStore` path does not repoint; it serves ingestion, which does not rename.
Reads by `aboutEntity` still match the hash without a type, so a listing for `X` also shows the
tasks of another entity type named `X`; fixing that is a separate change.
