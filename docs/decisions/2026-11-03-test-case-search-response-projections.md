# Test case search applies the same response projection as entity reads

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** PIIMaskerTest, TestCaseSearchMaskerTest, TestCaseResourceIT.test_piiColumnLinksAreMaskedAcrossReadPaths
- **Related:** https://github.com/open-metadata/OpenMetadata/pull/36938

## Context

Entity reads and search return several representations of a test case and its results. Their
field projections must agree, including embedded documents, derived text and pagination values.
Search facets can also represent field values without returning an entity document.

## Decision

The existing PII authorization decides the projection of a column test case using its table's
owners and the tags along its resolved column path. REST and MCP share this decision. Admins and
bots bypass response parsing and linked-entity lookups; indexes containing other entity types
also bypass the test case projection.

A masked test case omits description, parameter values, the latest result, incident details,
change descriptions, and their derived search text. Content-only MCP reads follow the same
decision before rendering text or retrieving passages. Masked standalone results retain only `id`, `testCaseFQN`, and
`timestamp`; search documents may also retain `entityType`. Search metadata containing document
values is omitted. A search page containing a masked document returns HTTP 400 when sorted by a
field its projection removes; supported sort values remain intact for pagination.

Automatically included facets on filtered fields, or backed by scripts, are omitted for callers
without unrestricted PII authorization. Explicit GET and POST aggregations can retain those
fields when every matching document permits the caller full access. Their scope is checked
using the same aggregation query, subject filters and deletion setting, grouped by document ID.
The check is limited to 1,000 documents and fails closed with HTTP 400 for a larger or incomplete
scope, including timed-out or incomplete shards, missing IDs or IDs shared by several matching documents. This bounds the extra
work on these requests; ordinary facets need no scope check.
Documents embedded in aggregation buckets always receive the shared projection.

After authorization, bucket calculation is constrained to the exact physical index and document-ID
pairs returned by the probe, with an empty scope becoming `match_none`. The original query is
evaluated once; repeating a query, especially one using random scoring, could otherwise authorize
different documents from those contributing bucket values.

Linked-table and test-case caches live for one response and hold at most 1,000 entries each,
including absent entities. This reuses metadata within typical pages without growing with the
catalog or preserving authorization decisions between requests.

Wildcard, comma-separated and unknown index selections use the conservative combined projection;
the fast path requires a selection proven to contain only unrelated entity types.

## Consequences

Existing sort cursors and ordinary facet responses retain their formats. Owners can use explicit
aggregations scoped to their accessible documents. Large aggregations on filtered fields need
a narrower query or unrestricted authorization. Automatic facets intentionally use the stricter
projection because individual bucket keys do not identify their contributing documents.

The 1,000-document scope limit and cache capacities are independent bounds with the same default;
changing either requires updating this record and the corresponding regression checks.
