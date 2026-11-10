# File extraction reuses an existing memory before it creates a duplicate

- **Status:** Accepted
- **Revisions:** v1 2026-09-29 (initial) · v2 2026-11-03 (deduplication keeps conflicting numbers) ·
  v3 2026-11-10 (§4: archiving, restoring and re-sharing a document move its memories)
- **Deciders:** Pere Miquel Brull
- **Guard:** `FileContextProcessingEngineTest`, `ContextMemoryExtractorTest`,
  `ContextMemoryReconcilerTest`, `SemanticMemoryDuplicateFinderTest`
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

#### §4 amended 2026-11-10: a document's archive, restore and sharing move its memories

Guarded by `MemorySourceLifecycleTest`, `SourceReadersTest`, `MemorySourceDisclosureTest`,
`ContextMemoryRepositoryTest`, `ContextMemoryExtractionIT` and `ContextFileIT`.

- **Archive.** Archiving (soft-deleting) a file soft-deletes each memory no other live source
  states; it keeps its links, so restoring the file can bring it back. A memory another live source
  states stays live. `hasOtherSources` counts archived sources, so a re-extraction that drops a fact
  from its last live source archives the memory for an archived copy that still states it. A
  permanent delete releases the file's links and deletes a memory nothing else states.
- **Anchor ranking.** When a memory's anchor goes, `chooseAnchor` takes a live source everyone may
  read (a live article, or a file shared with the whole organization), else a restricted live one,
  the current anchor first in both, else the first remaining source, so an archived memory keeps an
  anchor for its restore. An archived memory's anchor moves by its edges alone, because an update
  would restore it.
- **The archive mark.** After the soft delete, archiving writes the `entity_extension` row
  `contextMemory.archivedWithSources`. Every other delete or restore of the memory clears it, so a
  memory a person deleted stays deleted. The delete and the mark are two writes: a memory archived
  without its mark stays archived when its file is restored, which fails closed.
- **Restore.** Restoring the file brings back the same memories, with their ids, stage, approvals,
  edits and usage, and re-extracts nothing; a shared memory that stayed live names the file again.
  The anchor rule decides on the current anchor: it gives way to the restored file only when it is
  a file not everyone may read and everyone may read the restored one, and an archived anchor moves
  as ranked above. `restoredBy` is not carried; the system restores as admin. Restore runs only
  inside the restore's transaction and fails outside one. It locks the memory's row, then its mark,
  so a concurrent delete or restore cannot change its restore-or-skip decision. The reads after
  those two are not locking and, on MySQL, may see the transaction's earlier snapshot: the
  serialization covers that decision alone, within one transaction such as a folder's restore.
- **Accepted races,** each a concurrent action on the same memory in a narrow window:
  - a re-extraction that read the file's memories before it was archived can release one the archive
    kept, deleting it or dropping the archived link, so the restore cannot bring it back;
  - a person's delete that lands inside an archive, between its read and its mark, leaves a mark, and
    the restore brings that memory back;
  - a person's re-delete that lands after the restore read the mark is a no-op, because the soft
    delete is computed from an unlocked read of the archived row; the memory comes back and the
    person deletes it again;
  - restoring two copies of one memory in overlapping requests can, on MySQL, fail the second (a
    retry succeeds) or leave its file showing no source;
  - archiving copy S2 while copy S is restored can leave S live with its memory archived, because
    archive decides that every other source is archived from unlocked reads; archiving and restoring
    S again recovers it;
  - restoring a file while another archived copy of its memory is permanently deleted moves the
    memory's anchor by its edges alone, so its stored anchor can keep naming the deleted copy; reads
    follow the edge.
- **Content clock.** A lifecycle move of a memory's anchor changes who may read it, not what it
  says, so `lastContentUpdatedAt` stays
  (ADR:2026-10-10-memory-content-recency-and-usage-are-independent-of-review-writes). A copy is a
  new memory with its own clock.
- **Articles** have no Archive. `page.json` has no `deleted` field, so every article delete is
  permanent and releases its memories; `PUT /pages/restore` exists but has nothing to restore.
- **Where a restricted document is named.** A document not everyone may read is never added to a
  memory's related entities, and no lifecycle write after this change names it in the memory's
  history: such a write records it by id and type alone, in its change and in the version it
  stores. A memory shows it as its source only when it is the memory's anchor, whose readers are the
  memory's readers, or when no anchor and no document everyone may read is linked
  (`MemorySourceDisclosure`). History written while a file was org-wide can still name it, and so
  can a person's own edit of the memory.
- **Sharing changes.** Only a file's own share setting counts; a folder shares nothing of its own.
  Inside the write that turns a file from org-wide to restricted, every memory it is linked to stops
  naming it among its related entities, and one it anchors moves to a live source everyone may read,
  ranked as above. With none left the anchor stays, and the copy rule below runs. The file keeps its
  links, so its owners and admins see what they saw. When the file turns org-wide again, every memory
  it is linked to names it again and a restricted anchor gives way to it, as on restore; copies stay
  with their documents and nothing merges back. An edit that keeps a file restricted, or org-wide,
  moves nothing: a restricted copy whose readers such an edit changes is not copied again.
- **The copy rule.** A memory anchored on a restricted file gets a copy for each other live source
  not everyone may read, unless every reader of that source reads the anchor too. A file's readers
  are its user owners and, when it is Shared, the principals it names, matched by id: teams are not
  expanded, a team owner reads nothing it owns, and a Private file's leftover list names nobody. A
  wrong call costs a duplicate memory for people who read both files. The copy has the memory's
  title, summary, description, question, answer, machine representation, type, scope, source type,
  stage, status reason, successor and last review, and its owners and sharing. It is anchored on and
  linked to that source alone, which stops linking the original, and that move is why restricting
  the file again makes no second copy. Nothing extracts, reconciles or judges it, no glossary term is
  derived from it, and it is indexed as it is created (with vector search on, that embeds its text,
  as for every memory). It carries no disputes or review tasks, approval history, usage or related
  entities. Archiving runs the same rule, against the anchor `chooseAnchor` picked, when only
  restricted live sources remain.
- **Sharing limits.** A person's note with no anchor that cites the file only loses or regains it
  among its related entities. A memory a person deleted is left as it is. An extracted memory is
  named after the file it came from (`<file>-<uuid>`) and a name never changes, so a memory that moves
  to a copy keeps the original's name in its `name` and `fullyQualifiedName`. A permanent delete
  that skips the Archive, or a re-extraction that drops the fact from its anchor, moves the anchor
  by the same ranking but makes no copies. The share change and its moves commit together, and they
  run only inside a transaction.
- **Lifecycle writes are conditional** on the memory as they read it. A decision another user
  writes on it meanwhile fails the archive, restore or share change with 412, to be retried, instead
  of being overwritten; a write by the same user within an edit session is consolidated without that
  check.

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

## Amendment

v2 (2026-11-03): extraction no longer deduplicates by question alone. It keeps every answer whose
numbers conflict with each kept answer to the same question, and re-extraction matches exact
question and answer before similarity, never pairing conflicting numbers. See
ADR:2026-11-03-extracted-memories-can-await-review-and-keep-conflicting-values.
