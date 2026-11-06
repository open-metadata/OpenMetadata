# Only Approved glossary terms can be newly applied to an asset

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `GlossaryTermApprovedTaggingIT`, `ApprovedGlossaryTermGuardTest`
- **Related:** open-metadata/OpenMetadata#37164

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
- An ingestion run, a dbt model, or an automation that applies a non-Approved term now fails
  that entity's write with a 400 instead of storing the label.
- Terms are looked up once per write. Stored labels are read from `tag_usage` only when a
  non-Approved term reaches a target the loaded entity does not show holding it, so a partial
  projection cannot make a stored term look new, and writes with only Approved terms pay no
  extra read.
- `/columns/bulk-update-preview` has no per-column error, so a rejected term fails the whole
  preview with a 400.
- CSV import keeps its stricter per-row check, which also rejects a non-Approved term the asset
  already holds.
