# A force-sync merges connector-supplied custom properties rather than replacing them

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** Harsh Soni
- **Guard:** `EntityRepositoryExtensionTest`
  (`botPutWithOverrideMetadataKeepsPropertyTheConnectorDoesNotSend` fails if a force-sync drops a
  stored property the request omits; `botPutWithoutOverrideMetadataKeepsStoredExtension` fails if
  the opt-in stops being required)
- **Related:** #33324, #33333, #31467

## Context
`EntityRepository.updateExtension` reverted every bot PUT to the stored extension. Ingestion
authenticates as `ingestion-bot` and writes entities over the bulk PUT path, so a connector-supplied
custom property landed on an entity's first write and never changed again — a corrected source
value did not propagate and a newly added property never appeared (#33324).

The guard is there for a reason: it stops a scheduled re-sync from overwriting custom properties a
user curated in the UI. What it lacked was the opt-in that `description`, `displayName`, `tags` and
`certification` already honour, so there was no way for an operator to say "this run should refresh
what the connector owns".

Honouring `overrideMetadata` alone is not enough to be safe. The diff below the guard treats a
stored key the request omits as a deletion. Ingestion sends only the properties its own source
produces — Glue sends Glue parameters, dbt sends its own — so a plain replace would delete every
custom property a user had added in the UI the first time any connector force-synced a single
property of its own.

Tags can afford replace semantics under the same flag because `TagLabel` carries `LabelType` and the
update path filters on it. A custom property value carries no provenance at all: the server cannot
tell a connector-owned key from a hand-curated one.

## Decision
- The bot-PUT guard on `extension` applies unless `overrideMetadata` is set **and** the incoming
  extension is non-empty. Emptiness is tested with the `nullOrEmpty(JsonNode)` overload, so a `{}`
  payload counts as empty; the `(Object)` overload stringifies it to `"{}"` and would not.
- When the guard does not apply, the incoming extension is **merged over** the stored one: keys the
  request carries win, keys it omits are kept. It is never a wholesale replace.
- Default behaviour does not change. `overrideMetadata` defaults to `false`, so nothing moves until
  an operator turns on **Override Metadata** for that pipeline.

## Consequences
A connector can refresh and add the custom properties it owns, and a property a user set in the UI
survives any number of force-syncs.

The cost is that a property deleted at the source lingers until someone removes it by hand. Deleting
it automatically needs per-key provenance to distinguish a connector-owned property from a curated
one; that is the larger design #33324 raises as its alternative, and it is not attempted here.

Do not "simplify" the merge into a replace to match how tags behave under the same flag. Tags have
`LabelType` to protect manual labels and extensions have no equivalent, so the two are only
superficially alike. Revisit this once a custom property value records who wrote it — then a
force-sync can delete the connector-owned keys the source dropped, and this record is superseded.
