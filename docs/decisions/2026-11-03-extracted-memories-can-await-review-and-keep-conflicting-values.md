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
- Extracted memories stay owned by their writer. A conflict review over one is also assigned to
  whoever owns its source when the review opens; owning the memory would keep it readable after
  the source changes hands.
- Reuse of an identical file still requires its memories to be Approved, so under a reviewing
  provider a copy uploaded before review is extracted again.

## Consequences

Under a reviewing provider, a document's memories ground other users' answers only after review,
and an edited document's changed facts leave grounding until reviewed again. Two answers to one
question that differ without numbers are still deduplicated to the first. OSS keeps its
behavior, except that conflicting numbers are no longer dropped.
