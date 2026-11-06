# Extracted memories can await review and keep every value a document gives for one fact

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextMemoryExtractorTest`, `ContextMemoryReconcilerTest`, `MemoryConflictReviewTasksTest`
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
- The prompt asks for one candidate per value and forbids merging them or choosing one, even when
  a section says it is newer. Deduplication keeps one pill per question, plus every answer whose
  numbers conflict with each kept one: a second value is a conflict for a reviewer, any other
  answer to the same question is a rewording. Cross-source duplicate linking uses the same number
  rule.
- Re-extraction maintains `Approved` and `Unprocessed` pills. It matches an existing pill by exact
  question and answer first, for every pill, then by similarity, never pairing two pills whose
  numbers conflict. Numbers conflict only when one answer replaces a number of the other, compared
  as written, grouping commas, leading zeros and a zero fraction aside (1,500.00 is 1500, 3.10 is
  not 3.1); an added
  or dropped number (a year) is a rewording, and a parenthesized citation ("(section 3)", "(Table
  4)") is no number at all, so renumbering them changes no claim. The prompt names a value's
  section in its summary, never in its question or answer. A replaced number is a new claim, created
  in the stage it was derived in, and the old pill is released. Extracted pills claim their
  rewordings before a pill a person corrected (Manual) does; the corrected pill then claims the
  document's value for its own question (significant words retain their order: "What's" is "What is",
  "UK" is not "US", and "USD to EUR" is not "EUR to USD") when exactly
  one is left, so that value is never recreated
  beside the correction and the correction never takes another fact's value. A reviewed pill
  outside Approved or Unprocessed also claims only its own question's rewording: its decision must
  never hide another question's equal answer. A pill whose
  question or answer changes takes the stage it was derived in; a reworded title or summary keeps
  its stage. Its writes are stamped when they run and updates are conditional, so a review decided
  during re-extraction wins.
- Re-extraction never releases a pill a person decided: a Manual correction, or a pill a review
  moved to `Rejected`, `Superseded`, `Invalidated`, `Archived` or `Deprecated`. Its review decides
  it. A `Draft` pill awaits a review instead: it is never rewritten either, but when nothing derived
  claims it, it is released like an `Approved` or `Unprocessed` pill, and deleting it with its last
  source closes its review.
- A derived value that no pill claims and that resembles a Draft or decided pill starts
  `Unprocessed`, so a value a reviewer rejected or replaced never returns to grounding unreviewed.
  The hold runs after both matching passes, for every such pill, matched exactly or not. A value
  resembles the pill when it clears the similarity bar without a conflicting number, its own
  question's second rewording included. Beside a correction, a value with a conflicting number
  resembles it too when the two questions alone clear the bar, however low the whole pair scores,
  since it may be the very value the person replaced: the edit modal stores the corrected text as
  both question and answer ("The refund window is 45 days"), which a derived "What is the refund
  window?" / "30 days" matches by topic only. So a correction holds any such value it does not
  claim, both values when two are left for its question. The question test
  (`MemoryTextSimilarity.questionSimilarity`) compares topic words, without filler, question words
  or a plural's "s", because number-only answers agree word for word: "window for refunds" asks
  about the "refund window", "discount rate" not about the "VAT rate". A question naming no topic
  word the test reads (another script, "What is Q3?") is alike to none, so beside such a correction
  a changed number is not held.
- Extracted memories stay owned by their writer. A conflict review over one is also assigned to
  whoever owns its source when the review opens; owning the memory would keep it readable after
  the source changes hands.
- Reuse of an identical file still requires its memories to be Approved, so under a reviewing
  provider a copy uploaded before review is extracted again.

## Consequences

Under a reviewing provider, a document's memories ground other users' answers only after review,
and an edited document's changed facts leave grounding until reviewed again. Two answers to one
question that differ without numbers are still deduplicated to the first. A pill a person decided
stays linked to its source while the source exists, whatever re-extraction derives; a Draft leaves
with its fact, and its review closes with it.

A held value starts `Unprocessed` under every provider. Under OSS that keeps it out of grounding:
search admits only `Approved` memories (`ContextMemorySearchVisibility.SEARCHABLE_STATUSES`),
except a memory's pending ones to its own owners when a caller asks for them
(ADR:2026-10-15-search-admits-a-subjects-own-pending-memories-on-request). The Context Center lists
it as Unprocessed to its owners and admins, and it grounds answers once an admin approves it
through the API, `PATCH /v1/contextCenter/memories/{id}` setting `/entityStatus` to `Approved` (a
move `ContextMemoryRepository.LIFECYCLE` allows); the OSS memory panel shows a memory's stage but
cannot change it. A look-alike for another question (a US rate equal to a rejected UK one) is held
the same way. A rewording too loose to clear the similarity bar is still a new fact, created in its
derived stage. OSS otherwise keeps its behavior, except that conflicting numbers are no longer
dropped.
