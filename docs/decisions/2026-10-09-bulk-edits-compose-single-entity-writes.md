# A bulk edit is the single-entity write of each entity it touches, and only side effects are grouped

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `EntityPatchBatchTest`; `AssetsTabVersioningIT` (the cases comparing an Assets tab
  edit with the same PATCH, and the large selection)
- **Related:** collate #1526; PR #34690 (closed);
  ADR:2026-10-09-bulk-edits-authorize-each-entity-as-its-patch

## Context

The same entity update happens through several paths: the single PATCH and PUT, the ingestion
bulk API, restore, CSV import, and the Assets tab of a tag, glossary term, domain or data product.
Each has its own transaction, version history, cache, search and change event rules. The Assets tab
wrote relationship rows directly, so its edits left no version, no `updatedBy` and no change event,
while the same edit on the asset's page left all three.

A first fix batched the Assets tab for speed by building a second save pipeline next to the PATCH.
Review found bugs in it that the PATCH did not have: assets saved in part, and search entries left
stale. The column bulk update already showed a shape without that risk: load the entity, apply the
edit to a copy, diff it into a JSON patch, authorize that patch, save it through the normal PATCH,
record the event.

## Decision

- An edit to an entity, from any screen or API, is that entity's PATCH (PUT for ingestion). A bulk
  feature composes those single-entity writes; it does not write entity rows, relationships or
  history itself.
- `EntityPatchBatch` is the composition for PATCH. Per group of **100** entities it loads them in
  one query, applies the edit to a copy of each, diffs it into a JSON patch, authorizes it, and
  saves it through `EntityRepository.patch(original, patch, actor)`, the code the PATCH endpoint
  runs after its own load. Each entity is one transaction, with the 10-minute merge into the
  editor's previous version, the rules and the change description of a PATCH.
- An empty patch is skipped. An entity that fails (authorization, rule, validation or save) keeps no
  change and is reported with its message; the others go on. A dry run authorizes and prepares each
  patch and saves nothing.
- Each saved entity gets the change event a PATCH gets, built by
  `ChangeEventHandler.entityChangeEvent`, the same builder the REST response filter uses. Only the
  side effects are grouped: the load and the event insert, once per group.
- 100 bounds the load query and the memory a group holds. A larger selection runs as several
  groups, so what a call holds at once does not grow with the selection.

## Consequences

- A bulk edit records what the entity's page would: version, `updatedBy`, merge, event, rules. A
  rule added to the PATCH applies to every bulk feature built on it.
- Each entity costs a full PATCH. Grouping the search writes of a group is the next step and keeps
  this rule: the write stays the PATCH, only its side effects travel together.
- Not yet on this rule: the ingestion bulk API, CSV import and the column bulk update (which already
  saves one column per call through the PATCH). They move onto it one at a time.
- A group saves without a version check, like a PATCH without `If-Match`, so a concurrent edit to
  the same entity in the same second can be overwritten. Closing that needs the version-checked
  save, which turns off the 10-minute merge.
- Direction, not built: change events written by the write path itself, in the entity's
  transaction (an outbox). Today a PATCH's event is written by the response filter after the
  response and a bulk feature's by the feature, which is why both must use the same builder.
  Moving to an outbox changes every write endpoint and the alerting pipeline.
