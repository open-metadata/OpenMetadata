# Memory reconciliation resolves comparisons before writing memories

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextMemoryReconcilerTest`, `LLMCompletionClientTest`, `ContextMemoryExtractionIT`
- **Related:** ADR:2026-09-29-context-file-memory-reuse

## Context

A duplicate-equivalence completion returned prose instead of JSON after reconciliation had
already created nine memories from a document. The failed comparison marked the document Failed,
but those memories and their downstream glossary derivations remained. Re-extraction could also
update or detach existing memories before encountering the same failure.

## Decision

Reconciliation plans updates, source-link releases, creates, and reuse links without applying
them. All search and LLM duplicate comparisons must succeed before the planned writes run.
An existing memory scheduled to change or lose its source link is not reused against its old
content during planning. Duplicate checks inspect the persisted catalog before this run's writes;
the existing normalized-question deduplication still applies to the derived set.

Structured completions retain their existing one-retry budget. The retry adds an explicit JSON
format correction to the system instructions without replaying the invalid response as an
instruction. A second invalid response still fails the run; unknown equivalence never becomes
a successful no-match result.

## Consequences

- A failed comparison leaves this run's memory content and source links unchanged.
- This protects both file and article reconciliation without provider-specific behavior.
- Planning does not make concurrent uploads unique or database writes transactional. A persistence
  failure during the apply phase can still leave partial writes; the repository's existing
  concurrency and retry behavior continues to apply.
- Memories created by this run become searchable after the apply phase, rather than between
  comparisons. Cross-source semantic reuse remains bounded and best effort as previously recorded.
