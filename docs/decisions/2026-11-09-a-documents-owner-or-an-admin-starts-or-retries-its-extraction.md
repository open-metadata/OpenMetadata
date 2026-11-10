# A document's owner or an admin starts or retries its extraction, and nothing backfills it

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `MemoryExtractionAccessTest`, `MemoryExtractionStateTest`, `ContextMemoryResourceTest`,
  `ContextFileProcessingServiceTest`, `PageContextProcessingEngineTest`,
  `KnowledgePageRepositoryTest`, `ContextFileRepositoryTest`, `ContextFileIndexTest`,
  `ContextMemoryExtractionRequestIT`, the Jest tests of `memoryExtraction.utils`,
  `MemoryExtractionButton`, `DocumentsView`, `DocumentPreviewPanel`, `KnowledgePageDetailRightPanel`
  and `ContextCenterDocumentsPage`, and the Playwright specs `ContextCenterDocument` and
  `ContextCenterArticles`
- **Related:** ADR:2026-10-30-context-center-processing-writes-use-current-snapshots,
  ADR:2026-11-03-extraction-bookkeeping-keeps-the-sources-last-editor,
  ADR:2026-11-06-a-documents-extracted-memories-are-approved-from-the-document

## Context

Release testing found documents that never had their memories extracted (uploaded or written while
extraction was off, or before 2.1) and documents left Failed, with nothing to recover either, and no
sign in the UI that extraction was off. A backfill on upgrade or startup would spend a model call on
every such document without anyone asking for it.

## Decision

- **Nothing backfills.** No migration or startup pass extracts existing content. A document is
  extracted when it is uploaded or created, when its content or body changes, when restart recovery
  resumes a run a stop interrupted, or when a person asks:
  `POST /v1/contextCenter/drive/files/{id}/extract` and `POST /v1/contextCenter/pages/{id}/extract`.
- **Who asks.** The document's owners, the members of an owning team included as `SubjectContext`
  counts them, and admins. No policy grants it, since each run can cost a model call; anyone else
  gets 403. The UI offers the action only to them, treats owners a read did not load as not the
  user's, and hides the action once the server answers 403.
- **Availability.** `GET /v1/contextCenter/memories/extractionAvailability` answers `{available}`
  or `{available: false, reason}`, from `AiProvider.extractionAvailability()`, the one gate uploads,
  article edits and requests share. `ExtractionDisabled`: the LLM or memory extraction is switched
  off. `ProviderUnavailable`: extraction is switched on but its LLM failed to build, or, in Collate,
  the AI platform is off or its extraction agent is missing. A switch that is off wins over a failed
  build. The UI reads it once, shows the action disabled with the reason, and reads it again after a
  409; an unread availability disables nothing, as the server checks every request.
- **Not processed is derived, never stored.** `neverExtracted` on `ContextFile` and `Page` is
  computed on each read that asks for it (and for the file search document), stripped from storage
  and hidden from history.
  - A file: Processed, no extraction stats, a head content snapshot and non-blank extracted text. A
    file's content is fixed at upload, so its stats always describe its current content. A Collate
    chat attachment has no snapshot, so it is never Not processed and has nothing to retry.
  - An article: a page of type Article with a non-blank body, whose status is null or Processed and
    whose stats are absent or name another body's source hash. Quick links are not articles.
  - The UI offers Extract while `neverExtracted` holds, and Retry on Failed (for a file, only with a
    content snapshot). Unsupported files and documents extracted to no memories offer neither.
- **What a request does.** It stamps the document with a conditional write on a fresh snapshot,
  written as the source's last editor, and the stamp refuses a second request until the run
  settles. A file's stage comes from its snapshot: with text, ExtractingContext and memory
  extraction on the kept text; without, Uploaded and text extraction. On this path the memory job
  is queued with `includeRunning=false`, so a failed run still finishing cannot absorb the retry. An
  article is stamped Queued and its run waits out the article's 5-minute quiet period, as after any
  write; it reads Queued meanwhile. On an article, a status change carries its own error, so a
  retried article never keeps its last failure's.
- **409** leaves the document as it was: extraction is unavailable (with the reason), the document
  is already queued or being extracted, it is neither Failed nor Not processed or has no content
  snapshot, or it changed while the request was stamped (every conditional write lost).
- **503** when the queue refuses the run: the document is first recorded Failed with the queue's
  message, then the request answers `{code: 503, message}`, and the UI shows the message and reads
  the document again, which offers Retry. No job is left to record the failure, so it gets up to
  `FAILURE_RECORD_ROUNDS = 3` full conditional-write budgets rather than one. If every round loses,
  the document keeps the in-progress stamp, an error is logged and the request still answers 503;
  a retry then gets 409 until the document is recovered: a file by restart recovery, an article by
  its next body edit.
- **200** carries the document in its new state. A file's carries the fields the Documents list
  reads (`owners,folder,memoryCount,neverExtracted`), so the UI replaces the row with it rather
  than merging it the way a metadata write's response is merged; the two field lists change
  together.

## Consequences

- Content from before 2.1, or written while extraction was off, stays Not processed until an owner
  or an admin extracts it; nothing spends on it otherwise.
- A team member who cannot read a team-owned private file cannot extract it, and members of a
  sub-team are not owners: both follow the existing ownership and visibility models.
- An article's Retry takes effect after its quiet period, not at once. An immediate run would need
  the engine to tell bookkeeping writes from body edits.
- Three record budgets depart from the ten-attempt budget of
  ADR:2026-10-30-context-center-processing-writes-use-current-snapshots, for this one write; that
  record is amended to say so.
- A provider's `extractionAvailability()` runs in article prepare and update, so an override must be
  cheap, must never throw or return null, and must answer the same way throughout a request.
