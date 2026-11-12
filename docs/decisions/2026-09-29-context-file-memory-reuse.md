# File extraction reuses an existing memory before it creates a duplicate

- **Status:** Accepted
- **Revisions:** v1 2026-09-29 (initial) · v2 2026-11-03 (deduplication keeps conflicting numbers) ·
  v3 2026-11-09 (a ranked lookup; candidates in every stage keep their decision; the AI provider
  supplies the judge; a restricted copy is never named on a memory)
- **Deciders:** Pere Miquel Brull
- **Guard:** `FileContextProcessingEngineTest`, `ContextMemoryExtractorTest`,
  `ContextMemoryReconcilerTest`, `SemanticMemoryDuplicateFinderTest`, `AiProviderHolderTest`,
  `MemorySourceDisclosureTest`, `ContextMemoryRepositoryTest`, `ContextMemoryIndexTest`,
  `ContextMemoryExtractionIT`, `ContextMemoryExtractedApprovalIT`
- **Related:** Context Center file upload and memory extraction; PR #34154

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
memories a document states. It uses vector search when available and, since v3, always queries the
regular memory search index too. The lookup examines up to five candidates.

Candidates are loaded from the repository and must still be entity-visible memories of the same
memory scope that a document states, in any stage (see v3). A candidate whose numbers conflict
with the fact never links. Identical normalized question and answer text is accepted directly. Otherwise, an
LLM selects a candidate only when the two question-and-answer pairs express the same factual
claim in both directions, preserving entities, numbers, units, qualifiers, and negation. When one
qualifies, reconciliation links its existing memory ID to the new file. Otherwise it creates a
new memory. The memory index lookup raises an error if it is unavailable, so a failed lookup
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
- Reuse is limited to eligible, entity-visible memories a document states: extracted from a file,
  or a person's correction of such a memory or note citing a document (v3). Page-derived memories,
  and manual memories citing no document, are outside this cross-file search.
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

## Amendment

v2 (2026-11-03): extraction no longer deduplicates by question alone. It keeps every answer whose
numbers conflict with each kept answer to the same question, and re-extraction matches exact
question and answer before similarity, never pairing conflicting numbers. See
ADR:2026-11-03-extracted-memories-can-await-review-and-keep-conflicting-values.

v3 (2026-11-09): §3 finds reworded facts and memories in any stage, and a person's decision on
a memory covers every document that states its fact.

- The memory index is asked for a ranked `multi_match` of type `cross_fields` over question,
  answer, title and summary, any 30% of the fact's terms (operator OR, `minimum_should_match`
  30%), instead of one all-terms query that no single field ever matched. It reads 20 hits and
  keeps, in rank order, the first five eligible ones. That lookup applies no subject visibility:
  the stages it returns are those of the caller's filter, and the duplicate check's filter names
  none.
- Vector search admits only Approved memories, so the memory index is queried on every fact, not
  only when vector search fails or finds nothing: with vector search on, each new fact costs one
  more index search. The eligible candidates of the two lookups alternate (v1, k1, v2, k2, …),
  each memory once, and the first five are compared. A failed index lookup fails the check even
  when vector search answered, so it never creates an unchecked duplicate.
- A candidate is a memory another document states, in any stage, that is not soft-deleted: a
  `FileExtraction` memory, or a `Manual` one whose source is a file or an article, which is a
  person's correction still linked to its document or a person's own note citing one. A note
  citing no document, or another kind of entity, is none. It must still be entity-visible, of the
  same memory scope and anchored org-wide. A memory linked to the document being extracted is that
  document's own, which re-extraction matches and holds (§2), so the check skips it. The memory
  index filter carries what it can of this rule, so no other memory takes one of the 20 ranked
  places: the scope, and for a `Manual` memory the file the index names as its source
  (`sourceFile.id`, indexed from the source each write carries); a note citing only an article is
  not found there. Memory type is no longer compared; the judge decides.
- A candidate whose numbers conflict with the fact never links. Identical question and answer link
  without the judge; otherwise one judge call weighs the fact against the other candidates. A
  linked memory keeps its stage, so the document takes the decision made on it: a rejected fact
  stays rejected.
- The judge is the AI provider's, `AiProvider.duplicateJudge()`: the built-in LLM client unless
  the provider supplies its own, so OSS judges as before. A provider without one links only
  identical question and answer text, and a rewording becomes a new memory.
- A person decided a memory when it is Rejected, Superseded, Invalidated, Deprecated or Archived,
  or it is a person's own (`Manual`): a correction, or a note the person wrote citing the
  document. No field records a human approval (`lastReviewedAt` is
  stamped on every approval, ADR:2026-10-09-an-approved-memory-can-return-to-review-and-records-its-last-review),
  so Approved alone is no decision. A conflicting candidate a person decided holds the fact for
  review when re-extraction would pair the two as one question: the same question
  (`MemoryTextSimilarity.sameQuestion`) with the whole pair clearing the identity bar
  (`MemoryTextSimilarity.weighted`, 0.5). Beside a correction it also holds a value that may be the
  figure the person replaced, as re-extraction does (`MemoryReviewHolds.mayHaveBeenReplaced`): the
  edit modal saves a correction's text as both question and answer ("The refund window is 45
  days"), which a derived "What is the refund window?" / "30 days" matches by topic only. The new
  memory then starts `Unprocessed` under every provider: "billed on the 10th" waits beside a
  rejected "billed on the 5th", and a document's original figure waits beside a person's
  correction. A question for another year is another question, a correction's included (the two
  questions' own numbers conflict), so beside it, as beside a memory no one decided, a replaced
  number is a new memory in its derived stage.
- Approving from a document re-reads the memory index for memories a person decided in a document
  the pending value is not linked to, which hold it by the same rule, and leaves that value for an
  admin (ADR:2026-11-06-a-documents-extracted-memories-are-approved-from-the-document). A decision
  in a document the value is linked to is that document's own rule to apply, so beside a figure
  rejected in the document, its other figure stays approvable there. Only a value stating a
  number can be held, so only such values are looked up. Each approval preview, and each
  approval, costs one memory index search per pending value stating a number, each loading up to
  20 candidates from the database with their source links; one batch read of the document's
  pending memories' source links; and a listing of the memories of every other document those
  memories are linked to. It never asks vector search, which returns Approved memories alone.
- §1's identical upload links every memory of the earlier file that is not soft-deleted, whatever
  its stage, corrections included, provided each is entity-visible and entity-scoped.
- A linked document joins the memory's related entities only when everyone may read it: a live
  article, or a file shared with the whole organization. One shared with only some people, a
  private copy included, is linked by its source edge alone, so its name never reaches the memory,
  a listing of it or its history, and nobody approving the memory trips over a file they cannot
  read; its owners still list the memory from it. The memory's `sourceEntity` is its anchor among
  the documents linked to it, else the first one everyone may read, and a restricted one only when
  no other states it (`MemorySourceDisclosure`). So the duplicate check links a restricted
  document only to a memory whose shown source everyone may read, its live anchor or a linked
  document everyone may read, which stays the one shown (`MemorySourceDisclosure.mayLink`); its
  equivalent fact beside any other memory becomes a memory of its own. The rule governs linking
  only: a hold links nothing and names no document on the memory, so holds still follow the
  decision, and a decided memory holds a restricted document's other value whatever it shows. One
  case is left: a restricted document restating, with the same numbers, a memory it may not link
  to keeps its own memory in its derived stage, even when that memory was rejected or otherwise
  retired. Only a person's note showing a file not everyone may read meets it, unanchored or
  anchored to a file it does not cite, since an extracted memory shows the document it is anchored
  to. An identical upload's earlier file is one everyone may read and states every memory it
  lends, so a restricted copy is never the source shown there either. A link names a document
  with a write conditional on the memory as read, so a decision written meanwhile is read again,
  never reverted.
- Stop words count toward the 30%, so most new facts find some candidate: expect about one small
  judge call per new fact that has candidates, and none for a verbatim fact or an identical file.
