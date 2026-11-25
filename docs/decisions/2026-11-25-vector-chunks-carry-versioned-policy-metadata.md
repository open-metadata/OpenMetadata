# Vector chunks carry versioned policy metadata and reads recheck memory access

- **Status:** Accepted
- **Revisions:** v1 2026-11-25 (initial)
- **Deciders:** Search maintainers
- **Guard:** ChunkSecurityMetadataTest, EntityPolicyTagsTest, HybridSearchAccessFilterTest, VectorMemoryAdmissionTest

## Context

Shared-index chunks do not match entity index aliases in resource policies. Older chunks also lack
the identifiers and inline policy tags needed for conditional rules. Embedding fingerprints omit
some permission metadata, and failed vector writes can retain old memory visibility and content.

## Decision

Chunk document version 9 adds policy fields and an independent access metadata fingerprint. A
metadata-only change selects the existing stored-vector restamping path. Mapping upgrades are
additive; they do not prove that existing documents have been backfilled. Restricted hybrid queries
therefore require the per-document access metadata version and fingerprint on chunks. Resource
conditions match entity aliases or the corresponding chunk `entityType`, with chunk identity checks.
The existing compiler constructor retains entity-only behavior.

Direct vector memory reads reload nondeleted parents in batches before grouping and paging. Current
sharing, status, anchor, memory kind and content fingerprint must agree. Pending memories require
an explicitly requested pending status and actual ownership, including for admins. Raw engine
offsets advance over rejected hits; only admitted parents fill result pages. Stored content is never
a fallback when current access cannot be established. Document links are redacted against current
access. Non-admin vector responses do not disclose raw candidate totals.

## Consequences

After upgrading, run Search Indexing to restamp legacy chunks; stored embeddings can be reused when
content is unchanged. Legacy chunks remain available to administrators but are excluded by the
restricted hybrid policy gate until migrated. Rollback writers can produce old metadata again, so
the document gate must remain. Chunk metadata is a retrieval filter, not an authoritative permission
join: consumers still validate current parents before exposing content or global counts.
