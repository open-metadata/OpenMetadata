# Search lineage selects roots by type and FQN and traverses their edges by UUID

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** iamcsharper
- **Guard:** `AbstractLineageGraphBuilderTest`, `ESLineageGraphBuilderTest`, `OSLineageGraphBuilderTest`, `LineageCacheKeyTest`, `LineageRootTypeIT`
- **Related:** #38138, #38139, ADR:2026-10-27-a-missing-search-lineage-root-returns-404

## Context

A chart and dashboard can share an FQN while having different UUIDs. Looking up a root or its
first traversal frontier by FQN alone can select the other entity, mix edges, consume the selected
root's page, and authorize an entity different from the one returned. Treating ordinary untyped
ambiguity as an operational search failure also incorrectly reports HTTP 500.

## Decision

- `SearchLineageRequest` and `EntityCountLineageRequest` carry optional `entityType`. Root selection
uses FQN, entity type when supplied, and `includeDeleted`. An untyped request requires exactly one
eligible indexed entity: live by default, or including deleted entities when explicitly requested.
- No matching indexed root returns HTTP 404. Multiple eligible matches for an untyped request return
HTTP 400, naming the matching types and asking the caller to specify one. Multiple matches even
with a type, search timeouts, and backend or transport failures remain operational errors. This
supersedes the untyped-ambiguity rule in the earlier missing-root record and retains its other rules.
- Authorization and traversal use the same resolved root identity. Root frontier queries use its
UUID before pagination, through `_id`, `upstreamLineage.fromEntity.id.keyword` and, for connected-via
requests, `upstreamLineage.pipeline.id.keyword`. The latter keyword subfields currently come from
dynamic mapping; the index mappings do not explicitly declare them.
- Scene, export, count and pagination paths retain the type and deleted selection. Graph cache keys
include entity type and nullable `includeDeleted`, preserving null/false/true distinctions.

## Consequences

Existing indexed names and API URLs remain valid; callers with ambiguous FQNs must specify the
root type. This changes no persisted entity format and requires no data migration. It scopes root
identity, while the response's FQN-keyed representation can still collide for other graph nodes.
Changes to dynamic UUID keyword mapping must preserve the root traversal queries or update them
alongside the index mapping.
