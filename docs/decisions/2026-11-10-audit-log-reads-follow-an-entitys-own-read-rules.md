# Audit log reads follow an entity's own read rules

- **Status:** Accepted
- **Revisions:** v1 2026-11-10 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `AuditLogResourceTest`, `MemoryAuditProjectionTest`, `ContextMemoryDocumentAccessTest`, `AuditLogEntityAccessIT`
- **Related:** ADR:2026-09-29-context-file-memory-reuse

## Context

Memories and drive files have sharing rules in addition to their policy permissions.
Entity announcements require permission to read their linked asset. An audit entry contains
an earlier entity image and the values recorded by its changes, rather than the entity as read now.

## Decision

A single-entity audit read applies `ViewBasic` and the entity's current read rules. The
decision loads the fields those rules need, including owners and a memory's primary entity,
and includes soft-deleted entities. A hard-deleted entity of these types has no current
read decision for an ordinary reader; admins and bots retain their audit access.

Collection reads of these types, unfiltered collection reads, and audit exports require an
admin or bot as well as the existing audit permission. Service-level queries for other types
retain their existing service permission check. Export status and download apply the same rule
as requesting an export.

A memory's audit images and change values apply the memory's existing query-evidence rules
and file-sharing rules to their references. A file the reader cannot read now retains only its
id and type. The structured event, raw JSON fallback and summary use the same projected values;
stored audit records remain whole. Admins and bots retain the complete memory audit payload.

## Consequences

Sharing changes take effect for audit reads as soon as they take effect for entity reads.
An ordinary reader supplies both entity type and fully qualified name for types with their
own visibility rules. No per-row filtering is needed, so paging and counts remain consistent.
Memory audit responses resolve each distinct file at most once per response, up to the
existing 500-entry bound used for memory history.
