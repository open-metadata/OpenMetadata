# ADR: Reuse context memories during file extraction

- **Status:** Accepted (implementation on this branch)
- **Date:** 2026-09-29
- **Branch:** `pmbrull/memphis`
- **Related:** Context Center file upload and memory extraction

## Context

Uploading the same document under two different file names produced two sets of memories with
identical questions and answers. The existing content-hash gate only compared a file with its own
previous extraction, and reconciliation only looked at memories linked to that source. Neither
check found information already extracted from another file.

File identity and fact identity are different. An identical upload can reuse the complete result
of a prior extraction without invoking the memory extraction model. A different document may still
contain facts that existing memories cover, so each newly derived fact needs a separate check
before persistence.

## Decision

### 1. Process the current file content

The upload stores the file and a SHA-256 checksum of its bytes. Asynchronous processing reads the
current content from object storage and extracts text. When memory extraction is enabled, a
persistent job processes the current head content. The file moves through `Uploaded`, `Analyzing`,
and `ExtractingContext` to `Processed`, or to `Failed` when a stage fails. A job for a superseded
content version does not process that older version.

The shared `ContextProcessingEngine` skips extraction when a source's checksum matches its last
successful `extractionStats.sourceHash`. For a new file, `FileContextProcessingEngine` also looks
for a processed, non-deleted file whose recorded extraction hash matches the new checksum. If all
of that file's linked memories are active, entity-visible, entity-scoped file extractions, the
new file links to those same memory IDs. It records the source hash and prior chunk counts with
`pillsCreated = 0`; it does not call the memory extraction model. If no eligible prior result
exists, normal extraction proceeds. In particular, an earlier result with no linked memories
cannot supply a reusable set.

### 2. Derive candidate facts for other content

`ContextMemoryExtractor` splits extracted text into paragraph-aligned chunks, at most eight, and
asks the LLM for candidate memories. It deduplicates repeated normalized questions within that
derivation. An incomplete or over-limit derivation fails the run so that a partial result is not
recorded as successfully extracted.

`ContextMemoryReconciler` first compares candidates with memories already linked to the same
source. Exact normalized questions and then weighted text similarity preserve memory IDs across
re-extractions, including retrieval telemetry. A human-edited memory is left unchanged. If a
shared memory's fact changes in one source, that source releases its link before reconciling the
new fact; the other source retains the old memory.

### 3. Check each unmatched fact against existing memories

Before creating an unmatched candidate, `SemanticMemoryDuplicateFinder` searches for existing
file-extracted memories. It uses vector search when available. If vector search fails or returns
no eligible candidates, it queries the regular memory search index. The lookup examines up to
five candidates; a nonempty vector result does not trigger a second keyword search.

Candidates are loaded from the repository and must still be active, entity-visible
`FILE_EXTRACTION` memories with the same memory scope and memory type. Conflicting numeric values
are rejected. Identical normalized question and answer text is accepted directly. Otherwise, an
LLM selects a candidate only when the two question-and-answer pairs express the same factual
claim in both directions, preserving entities, numbers, units, qualifiers, and negation. When one
qualifies, reconciliation links its existing memory ID to the new file. Otherwise it creates a
new memory. The search-index fallback raises an error if it is unavailable, so a failed lookup
does not silently create an unchecked duplicate.

### 4. Keep source links and extraction results consistent

A reused memory can be linked to multiple files. Releasing or deleting one source removes that
source's link and reassigns the primary source when needed; the memory is deleted only after its
last source is released. `extractionStats.pillsCreated` counts newly created memories, not reused
ones. The file is marked `Processed` only after the extraction and reconciliation path returns.

## Consequences

- An identical new upload can share memory IDs and skip memory extraction, provided a complete,
  eligible prior result exists.
- A document with different bytes still incurs derivation calls. Each unmatched derived fact may
  incur a search and an equivalence call before a memory is created.
- Semantic reuse is best effort within the retrieved candidate set. Search ranking, indexing
  delay, the five-candidate limit, and equivalence judgment can miss a duplicate. This is not a
  global uniqueness constraint or an atomic check across concurrent uploads.
- Reuse is limited to eligible file-extracted, entity-visible memories. Page-derived and manually
  authored memories are outside this cross-file search.
- Previously created duplicate memories are not merged retroactively by this decision.

## Implementation notes (2026-09-29)

The flow is implemented in `ContextFileProcessingService`, `ContextProcessingEngine`,
`FileContextProcessingEngine`, `ContextMemoryExtractor`, `ContextMemoryReconciler`, and
`SemanticMemoryDuplicateFinder`. `ContextFileRepository` finds prior matching extraction hashes;
`ContextMemoryRepository` manages multi-source links and release. The exact-hash path and semantic
finder have focused tests alongside reconciliation tests.

## Review log

- **2026-09-29:** Recorded the exact-content and per-fact reuse paths from the implementation,
  including shared-source lifecycle and the limits of search-based deduplication.

## Open items

- Repair vector search on the local instance: its current query fails because some indices in
  the queried alias expose `embedding` without the expected `knn_vector` mapping. The new code
  uses regular memory search as a fallback when deployed there.
- Decide whether existing duplicate memories need a separate backfill or consolidation job.
