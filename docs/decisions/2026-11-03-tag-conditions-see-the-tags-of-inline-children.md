# Tag conditions see the tags of inline children

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `ListRowAuthorizationIT` (`aColumnTagDeniesTheTableWhateverFieldsAreRequested`,
  `aTaskTagDeniesThePipeline`)
- **Related:** open-metadata/openmetadata-collate#8018

## Context
`getAllTags` merges the tags of a table's columns, a pipeline's tasks, a topic's schema fields and
the like into what `matchAnyTag` and `matchAllTags` read. The entity a request returns is loaded
with the fields that request asked for, which need not include the children or their tags, and a
bulk request loads many entities at once. So tag conditions read from a copy loaded for
authorization, on every path, with children nested at any depth.

## Decision
- Each repository whose inline children carry tags declares the fields `getAllTags` needs
  (`getPolicyTagFields()`: `tags,columns`, `tags,tasks`, `tags,messageSchema`, ...).
- For those types, `ResourceContext.getTags()` reads policy tags from a copy loaded with that
  projection; a bulk request loads the copies for the whole batch at once
  (`BulkFieldHydrator.forTags`). The entity being authorized keeps its own projection, so a GET
  that returns it carries only what was asked for.
- `getAllTags` merges nested columns and schema fields at every depth.

## Consequences
A tag condition on a child applies on every read path. Evaluating one costs a load of the
entity's children with their tags, paid only when a policy has a tag condition. A new entity type
with tagged inline children overrides `getPolicyTagFields()` and `getAllTags`.
