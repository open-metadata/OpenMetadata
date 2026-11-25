# Only Approved glossary terms can be newly applied to an asset

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial) · v2 2026-11-17 (held edits are checked when staged;
  only newly applied terms are looked up) · v3 2026-11-19 (a term that is not Approved is kept as
  pending instead of refused, and shown when it is approved)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `GlossaryTermApprovedTaggingIT`, `ChangeRequestUnapprovedTermIT`,
  `ApprovedGlossaryTermGuardTest`
- **Related:** open-metadata/OpenMetadata#37164, open-metadata/OpenMetadata#37256

## Context
The UI only lets a user pick Approved glossary terms when tagging an asset, and it disables
"Add assets" on any term that is not Approved. The API had no such rule: create, PUT, PATCH,
bulk PUT, the term's `assets/add` and a table's `dataModel` all accepted a Draft, In Review,
Rejected or Deprecated term. So the same governance rule held or failed depending on which
client applied the term. CSV import already rejected a non-Approved term on every row.

## Decision
- A write that **newly applies** a glossary term to a target is rejected with a 400 unless the
  term is Approved. A target is the asset or one of its inline fields (columns, schema fields,
  tasks, features), addressed by FQN. A term with no `entityStatus` predates the approval
  lifecycle and counts as Approved, the same as in the UI.
- A repository names its tagged inline fields through `EntityRepository.taggedFieldContainers`
  (the `ChildFieldResolver` registry by default; `FileRepository` adds its columns). Terms are
  compared by FQN hash, so quoting a segment cannot disguise a term.
- "Newly" is judged per target against the stored state before the write. Only a term the
  target holds in its own right counts as held there. A term held on another column, or one the
  target only inherits from its parent, is new on it. A term that leaves Approved after it was
  applied stays, and writes that carry it back to the same target still succeed.
- `ApprovedGlossaryTermGuard` holds the rule. It runs on both create funnels, at the start of
  every `EntityUpdater` flush (before session consolidation rebases `original`), in
  `TableRepository.addDataModel`, before the bulk `assets/add` edit, and in the column bulk-update
  and column CSV dry-runs, so a preview reports what the apply would reject. Classification tags
  are not affected.

## Consequences
- Bots get no exemption: an automation or ingestion write that applies a non-Approved term
  fails that entity's write with a 400. Ingestion follows the same rule on the client side
  instead: dbt, the only connector that applies glossary terms, skips a non-Approved term with a
  warning and ingests the rest (open-metadata/OpenMetadata#37256). That change ships with or
  before this one, so dbt runs do not start failing.
- Terms are looked up once per write. Stored labels are read from `tag_usage` only when a
  non-Approved term reaches a target the loaded entity does not show holding it, so a partial
  projection cannot make a stored term look new, and writes with only Approved terms pay no
  extra read.
- `/columns/bulk-update-preview` has no per-column error, so a rejected term fails the whole
  preview with a 400.
- CSV import keeps its stricter per-row check, which also rejects a non-Approved term the asset
  already holds. So does a term's `assets/add`: it exists only to apply the term, so a term that is
  not Approved is rejected for every asset in the request, whether or not one already holds it.

## Amendment — held edits are checked when staged; only newly applied terms are looked up

An approval workflow in Enforce mode holds an edit before it is written, so the write-time check
never saw it: the request answered 202 and opened a change request for a term the write would
refuse. `ApprovalGate.stage` now runs the same check before it opens a change request, so a held
edit that newly applies a non-Approved term gets the 400 an unheld write gets, and bulk PUT fails
only that item. The check is not narrowed to a change of `tags`, because a field's labels change
under its container (`columns`, ...). The write-time check stays as the backstop: a term demoted
after its edit was held is caught when the approved edit is applied, and the request stays Pending
with that reason (`ChangeRequestService.flagConflicts`).

A request still runs the check once: a held edit is staged instead of written. Terms a target
already holds are now dropped before the lookup, so a write or held edit that applies no new
glossary term reads nothing, and one that does looks up only the new terms, in one batch.

## Amendment — a term that is not Approved is kept as pending, and shown once it is approved

This replaces the refusal in the initial decision and in v2. Customers that sync glossary terms
onto assets from their own systems apply a term as soon as they create it, before a reviewer
approves it. A 400 broke those syncs, and nothing applied the term once it was approved, so each
sync would have had to watch for approvals and run again.

A write that newly applies a term that is not Approved now succeeds. The term is taken out of the
write, so it is not in the entity's answer, its change description, its search document or its
cache, and it is stored in `tag_usage` with the `state` value 2. Pending is a storage state only
the tag DAO knows (`TagUsageDAO.PENDING_STATE`), one past the public `TagLabel.State` values, so no
client can send or receive it. Every tag read
leaves pending rows out (`TagUsageDAO.NOT_PENDING`): entity and column reads, the list API's tag
filter, tag and term usage counts, ontology and knowledge center reads. No table or join is added.
Because a pending row is an ordinary `tag_usage` row, renames, moves and deletes of the asset, its
fields or the term already carry it. Writes that clear an asset's tags to write them again (CSV
import, data model, bulk re-store) keep pending rows. A client never sees a pending term, so no
write of the asset's labels removes one, by any user: a pending term leaves an asset only when the
term is removed from it through the term's `assets/remove`, or when the term is rejected.
`assets/remove` drops the term's pending labels on the asset and its own inline fields, not on other
entities nested under its FQN; since no visible label changes, it checks that the caller may edit
the asset's glossary terms and reports an asset they may not edit as failed. `GET
/v1/glossaryTerms/{id}/pendingAssets` lists the assets a term is pending on, paged by an `after`
cursor over target FQN hashes, leaving out assets the caller may not view.

When the term moves to Approved, after the term is stored (`GlossaryTermRepository.postUpdate`, so
a bulk update's status change is acted on only once it is saved), `GlossaryTermPendingLabels` adds
the term to each asset holding pending labels, in batches of 500 targets, as an ordinary PATCH by
the governance bot. The asset therefore records a version and a change event, and its cache,
search document and RDF are updated by the same pipeline as any edit; a document that fails to
index goes on the search retry queue. The PATCH's upsert turns the pending rows into shown ones: an
automated label, as ingestion sends, comes back Suggested, any other Confirmed, and `appliedBy`
keeps the user who applied it. A PATCH the pipeline refuses, as when the term would be mutually
exclusive with a tag the asset shows, leaves the asset's labels pending. When the term is
rejected, its pending rows are deleted.

Pending labels of an Approved term are shown again whenever they are found. An asset whose edit
fails is retried, up to three times. A write that held a term checks the term once the write commits, so a
term approved while the write ran is not missed. The server sweeps for them when it starts, so a
restart does not leave them hidden.

The approval gate no longer refuses such an edit when it is staged (v2): the edit is reviewed like
any other, and when it is published the term is held back as above. dbt no longer skips a term
that is not Approved (#37256); the server holds it. CSV import, of entities and of columns, keeps
its per-row refusal. Labels a
term already had before this change are left as they are.
