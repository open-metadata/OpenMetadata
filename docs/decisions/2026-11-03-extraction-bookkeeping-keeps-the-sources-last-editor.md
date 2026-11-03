# Extraction bookkeeping keeps a source's last editor, and a memory card leads with its owner

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `FileContextProcessingEngineTest`, `PageContextProcessingEngineTest`, `MemoriesView.test.tsx`
- **Related:** ADR:2026-09-29-context-file-memory-reuse

## Context

Release testing saw every document uploaded to Context Center show `admin` as its last editor once
extraction finished: the engine stamped its extraction stats and processing status as `admin`. A
memory list card likewise led with whoever changed the memory last, so reconciliation's app bot
appeared as the author of memories people own.

## Decision

- Extraction bookkeeping on a file or article (stats, processing status) is written as the source's
  current last editor, as file processing status already was; `admin` only when none is recorded.
- A memory card names its owner first, and adds "Updated by" with whoever changed it last only
  when that is someone else. A memory with no owner shows its last editor, as before.

## Consequences

A source's version history records extraction bookkeeping under its last editor rather than admin.
