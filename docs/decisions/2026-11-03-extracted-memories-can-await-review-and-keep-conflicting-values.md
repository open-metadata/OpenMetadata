# Extracted memories can await review and keep every value a document gives for one fact

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextMemoryExtractorTest`, `ContextMemoryReconcilerTest`, `FileContextProcessingEngineTest`
- **Related:** ADR:2026-09-29-context-file-memory-reuse, ADR:2026-10-27-memory-reconciliation-resolves-comparisons-before-writes

## Context

Release testing uploaded documents that contradicted themselves, each other, and memories saved in
chat. Every extracted memory came out Approved. Extraction also settled each conflict silently: it
deduplicated pills by question alone, so a second answer to the same question was dropped, and the
model merged two values into one answer ("conflicting, confirm with HR") or kept the value under a
heading that looked newer. Nothing reached a reviewer, and Chat grounded on whichever value
survived.

## Decision

- `ContextMemoryExtractor` takes the status extracted memories start in. OSS has no reconciler,
  so its provider keeps `Approved`; a provider that reviews extracted memories (Collate's) passes
  `Unprocessed`.
- Re-extraction maintains `Approved` and `Unprocessed` pills. A pill whose content changes takes
  the status it was derived in, so under a reviewing provider a changed fact is reviewed again.
- Extracted memories are owned by their source's owners, so a pending memory has a reviewer and a
  conflict review has assignees.
- Two different answers a document gives to one question stay two memories. Extraction and
  re-extraction deduplicate by question and answer; the prompt asks for one candidate per value and
  forbids merging them or choosing one, even when a section says it is newer. Settling the conflict
  is the reviewer's job.

## Consequences

Under a reviewing provider, a document's memories ground answers only after review, and an edited
document's changed facts leave grounding until reviewed again. OSS behavior is unchanged except
that conflicting values are no longer dropped. Pills extracted before this change keep no owners.
