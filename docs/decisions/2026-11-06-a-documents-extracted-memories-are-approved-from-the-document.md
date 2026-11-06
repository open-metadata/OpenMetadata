# A document's extracted memories are approved from the document, by admins or its owners

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ExtractedMemoryApproverTest`, `ContextMemoryExtractedApprovalIT`, and the Jest tests of
  `CreateMemoryModal`, `ContextCenterMemoriesPage` and `ExtractedMemoriesCard`
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

- The memory panel offers **Approve** and **Reject** to admins on an `Unprocessed` or `Draft`
  memory. Each PATCHes `/entityStatus` to `Approved` or `Rejected`, moves
  `ContextMemoryRepository.LIFECYCLE` allows from both stages. The Memories list lets an admin
  approve the `Unprocessed` memories it shows in one action, one PATCH each, and reports those that
  fail; Draft memories are left to the panel or their conflict review.
- A document's extracted memories are approved from the document, its preview in Documents or an
  article's view, by an admin or an owner of the document as policies count owners (an owning
  team's members included). They already decide the document's conflict reviews
  (ADR:2026-11-03-extracted-memories-can-await-review-and-keep-conflicting-values).
  `GET /v1/contextCenter/memories/extractedApproval?sourceId&sourceType` previews what approval
  would do and `PUT` with `ApproveExtractedMemories` does it; both answer anyone else with 403 and
  accept only a context file or a page as the source.
- Approval writes each of the document's `Unprocessed` extracted memories as a review decision
  does: as the person, impersonated by `governance-bot` and guarded on the version read, so a
  distribution that requires review accepts an owner's decision. A memory refused or changed
  meanwhile stays pending and is counted as failed; the others are still approved.
- A memory whose normalized question (`ContextMemoryExtractor.questionKey`) another `Unprocessed`,
  `Draft` or `Approved` memory of the same document shares is a second value of that question, as
  extraction keeps two pills for one question only when their values conflict. Approval leaves it
  pending and returns it as needing a decision. It never touches a `Draft` memory, which is under
  conflict review, nor any other stage.
- This is the product path for approving a memory held for review that the earlier records
  pointed to the API for.

## Consequences

- A document's owner approves its memories without an admin and without the AI platform; values
  in conflict still need a person to choose one, in the memory panel or a conflict review.
- Bulk approval in the Memories list treats the memories an admin sees as decided, including two
  values of one question; the document action is the one that leaves those for a decision.
- An owner of a memory under review who is not an admin approves it through its document or a
  conflict review only: the panel offers Approve and Reject to admins, as a distribution that
  requires review refuses an owner's own approval.
