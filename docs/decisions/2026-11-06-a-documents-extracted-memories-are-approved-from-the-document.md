# A document's extracted memories are approved from the document, by admins or its owners

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial) · v2 2026-11-09 (a hold from another document needs an admin)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ExtractedMemoryApproverTest`, `ContextMemoryReconcilerTest`,
  `ContextMemoryRepositoryTest#aDocumentOwnersApprovalPassesReviewOnlyAsTheApproverWritesIt`,
  `ContextMemoryExtractedApprovalIT`, `ContextMemoryExtractionIT`, the Jest tests of `CreateMemoryModal`,
  `ContextCenterMemoriesPage` and `ExtractedMemoriesCard`, and the Playwright specs
  `ContextCenterMemoryLifecycle` and `ContextCenterDocument`
- **Related:** ADR:2026-11-03-extracted-memories-can-await-review-and-keep-conflicting-values,
  ADR:2026-11-05-oss-memories-are-approved-without-reconciliation,
  ADR:2026-10-13-a-memory-conflict-opens-a-review-task-and-approving-it-supersedes-the-disputed-memory,
  ADR:2026-11-03-context-center-listings-show-and-count-only-what-the-caller-may-read

## Context

With review required (Collate) and its AI platform off, a document's extracted memories stay
`Unprocessed`, and only a REST PATCH of `/entityStatus` approved them: in Context Center a memory's
stage was display-only, and a review task exists only for a Draft with disputes. The same held for
a non-admin's manual memory under review, and in OSS for the values extraction holds for review.

## Decision

- The memory panel offers **Approve** and **Reject** to admins on an `Unprocessed` memory or a
  `Draft` held for no dispute. A Draft with disputes is decided by its conflict review: approving it
  in the panel would release the disputes and leave both contradicting memories Approved
  (ADR:2026-10-13-a-memory-conflict-opens-a-review-task-and-approving-it-supersedes-the-disputed-memory).
  Each PATCHes `/entityStatus` to `Approved` or `Rejected`, moves `ContextMemoryRepository.LIFECYCLE`
  allows from both stages, after a `test` of `/updatedAt` against the memory the admin saw, so a
  memory edited or reviewed meanwhile fails the decision instead of being overwritten; the panel
  reads it again and, finding its `updatedAt` changed, says so instead of the patch error. The
  Memories list lets an admin approve the `Unprocessed` memories it shows in one action, one such
  PATCH each, and reports those that fail; Draft memories are left to the panel or their review.
- A document's extracted memories are approved from the document, its preview in Documents or an
  article's view, by an admin or an owner of the document as policies count owners (an owning
  team's members included). A document's owner is its uploader or author, who approves what the
  document says and already decides its conflict reviews
  (ADR:2026-11-03-extracted-memories-can-await-review-and-keep-conflicting-values).
  `GET /v1/contextCenter/memories/extractedApproval?sourceId&sourceType` previews what approval
  would do and `PUT` with `ApproveExtractedMemories` does it; both answer anyone else with 403 and
  accept only a context file or a page as the source.
- A person approves only what they were shown. The preview lists each memory approval would
  approve with when its claim last changed, as a conflict review records what its reviewer read
  (`comparedMemory`), and `PUT` carries that list back. Approval takes only the listed memories that
  are still approvable and unchanged since: a listed memory that changed, or that approval would no
  longer take, fails, and a memory the list does not name, one extracted after the preview included,
  is never touched.
  The UI intersects the preview's eligible IDs with the displayed list and sends the content
  timestamps from that list. A preview read later cannot approve a newer, unseen claim, a memory
  beyond the displayed page, or anything while the list is loading or failed to load.
- Document ownership does not override a memory's own visibility. Preview counts, IDs and decision
  references include only memories the caller may read, and approval checks visibility before
  each guarded write. Hidden memories still participate in conflict detection, so hiding a value
  does not allow a conflicting value to bypass review.
- Approval writes each memory it takes as a review decision does: as the person, impersonated by
  `governance-bot` and guarded on the version read, so a distribution that requires review accepts
  an owner's decision. A memory refused, changed or released meanwhile is not approved and is
  counted as failed; the others are still approved.
- A memory asking the question another `Unprocessed`, `Draft` or `Approved` memory of the same
  document asks needs a decision when their answers differ. Extraction can keep variants of one
  question with the same answer; those do not conflict, comparing answers without surrounding
  whitespace or case. Questions are compared pair by pair as re-extraction compares a correction's
  own question (`MemoryReviewHolds.sameQuestion`): case, punctuation and filler words aside, so
  "What's the refund window?" asks what "What is the refund window?" asks, and "UK" is not "US".
  So does one that re-extraction would hold for review beside a decided pill, by the predicate
  both share (`MemoryReviewHolds.holds`): a value agreeing with a Rejected or Superseded pill, or
  beside a correction a changed number whose question alone clears the bar, may be a value a
  reviewer rejected or a person replaced, reworded. Approval leaves such memories pending and
  returns them as needing a decision. It never touches a `Draft` memory, which is under conflict
  review, nor any other stage.
- This is the product path for approving a memory held for review that the earlier records
  pointed to the API for.

## Consequences

- A document's owner approves its extracted memories without an admin and without the AI platform,
  except the ones approval leaves for a decision. A held value needs an admin: a second value of a
  question, or a value held beside a decided memory, stays pending however often the document
  action runs, until an admin approves or rejects it in its memory panel.
- A memory extracted after the preview stays pending until a later preview lists it, and one that
  changed since the preview is counted as failed rather than approved as it now reads.
- Bulk approval in the Memories list treats the memories an admin sees as decided, including two
  values of one question; the document action is the one that leaves those for a decision.
- The panel offers Approve and Reject to admins only, as a distribution that requires review
  refuses an owner's own approval. An owner who is not an admin grounds a memory under review only
  through the document action, when approval takes it, or through its conflict review.

## Amendment

v2 (2026-11-09): one memory, one review. A memory several documents share (an identical copy, or a
fact two documents state) is approved from any of them by that document's owners, and one that a
linked document leaves for a decision stays pending from every other, so approving from one
document never bypasses another's hold. A value held because of a decision in another document
needs an admin exactly as a same-document hold does: preview and approval re-read the memory index
for decided memories that hold each pending value stating a number, by the rule the duplicate check
holds it with
(ADR:2026-09-29-context-file-memory-reuse, v3), and leave it pending for the document's owners.
Only a decision in a document the value is not linked to holds it that way; a decision in a
document the value is linked to keeps the rule above, so beside a figure an admin rejected in the
document, the other figure it states is its owner's to approve. Preview and approval therefore
depend on the memory search index: when it cannot be read they answer 503 and approve nothing,
rather than approve without the check. Rejecting stays with admins
(ADR:2026-11-03-extracted-memories-can-await-review-and-keep-conflicting-values, v3). Another
user's private copy never blocks an owner's approval, which is written as that owner: a restricted
copy is linked by its source edge alone, and only to a memory whose shown source everyone may
read, so it is never named on the memory, its source included.
