# A hard delete keeps the rows of entities that share its FQN

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `HardDeleteCleanupIT`, `FqnKeyedRowCleanupTest`
- **Related:** ADR:2026-11-03-a-hard-delete-removes-only-rows-of-the-deleted-entity,
  open-metadata/openmetadata-collate#8646

## Context
`tag_usage` and `field_relationship` key their rows by FQN hash and record no entity type. A hard
delete removed every row at and under the deleted entity's FQN, and an FQN is unique only within a
type. Hard-deleting a pipeline service named like a database service therefore removed the tags
and tiers of every table in the database service, with no version or change description. The
same happened to a table when a stored procedure with its FQN was deleted. It happened to dashboard
data models (`service.model.name`) when a chart named `model` was deleted. And it happened to a
metric whose bare name (`glossary.term`) is a glossary term's FQN when the glossary was deleted.

## Decision
Before removing the rows at and under an FQN, a hard delete looks for entities it leaves in place
(`FqnKeyedRowCleanup`):
- If an entity of another taggable type has the same FQN, the rows at that FQN are its rows too,
  and it may own rows under the FQN. The delete removes none of them.
- A free-form FQN (a type that `nestsUnderUnrelatedFqns()`, such as a metric's bare name) can equal
  a field of an entity whose inline fields carry tags (`EntityRepository.hasTaggedFields()`: a
  table column, a topic schema field, a Drive file column). If such an entity sits above the FQN,
  the rows at and under it may be that field's, so the delete removes none of them.
- Entities that nest under the FQN without being its descendants keep the rows at and under their
  own FQNs, and the delete removes the rest. The search covers only types whose FQN can nest
  under an unrelated FQN (`EntityRepository.nestsUnderUnrelatedFqns()`): bare-name types, and data
  models with their fixed `model` segment. Past 100 such subtrees, the delete removes only the rows
  at the FQN.
- If the root of a recursive hard delete will keep rows under its FQN for an entity it leaves in
  place (another type's entity with its FQN, or an unrelated entity nested under it), each
  descendant removes its own rows instead of relying on the root's single prefix delete. This is
  decided before the cascade, so entities of a type that nests under the root's type as its
  descendants (`EntityRepository.fqnParentType()`, e.g. a dashboard service's data models) do not
  count.
- Probes run in batches of 50 FQNs. One statement looks for namesakes in every taggable type's
  table and one for nested entities; a free-form FQN adds one for entities with inline fields.

## Consequences
A hard delete no longer removes the rows of an entity that has its FQN or nests under it, nor, for a
free-form FQN, those of a field at that FQN. Where rows are shared, some of the deleted entity's
rows stay. These are the rows at an FQN another type has, which are that entity's too, plus the
nested-part rows (columns, fields) under that FQN, and the rows of a free-form FQN that an entity
with inline fields sits above. Each hard delete costs two more queries (three for a free-form FQN),
a recursive one two more before its cascade, and descendants that remove their own rows two more per
batch of 50. A new type whose FQN can nest under an unrelated FQN must override
`nestsUnderUnrelatedFqns()`. If its entities are also the cascade-covered descendants of a parent
type, it names that type in `fqnParentType()`; without it, deleting such a parent still removes the
right rows, one descendant at a time. One case remains: an FQN built from its parents can still
equal another entity's field, and deleting it removes that field's rows. Examples are a test case or
child container named like a column of its parent, and schema `X.a.b` against the task `b` of
pipeline `X.a`. Recording the target's entity type on each row would make all of this exact, but
that schema change is still deferred.
