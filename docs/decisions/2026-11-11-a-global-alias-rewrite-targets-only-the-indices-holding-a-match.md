# A global-alias rewrite targets only the indices holding a match, and skips the update when none do

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial)
- **Deciders:** anuj-kumary
- **Guard:** `OpenSearchEntityManagerUpdateByQueryRetryTest`, `ElasticSearchEntityManagerUpdateByQueryRetryTest`, reviewer for other global-alias helpers
- **Related:** #37466, #37467, ADR:2026-10-09-synchronous-update-by-query-retries-version-conflicts

## Context

A glossary term rename or move rewrites the tag FQN of every tagged asset with one update-by-query
over the global search alias. An update-by-query opens a scroll context on every shard it reaches,
whether or not anything on that shard matches. Across the global alias that means one per shard of
every index, and more during a reindex, when `*_rebuild_*` indices are aliased in. On a busy node
this exhausts `search.max_open_scroll_context` (500). The engine then retries the rejected scroll
with its built-in backoff (500 ms start, 11 retries, about 59.5 s) before failing with
`429 too many scroll contexts`. In nightly AUT, a reviewer accepting a held move of an untagged term
waited 61 s for a rewrite that had nothing to update.

## Decision

- Before the update-by-query, a size-0 search with the same query and a terms aggregation on `_index`
  finds the indices holding a match. A plain search opens no scroll contexts.
- When no index holds a match, the update-by-query does not run.
- Otherwise, the update-by-query, and the reconciler's refresh, target only those indices.
- The aggregation returns at most **1000** buckets, more than the indices behind the alias. If the
  page is full it may have been cut short, so the update targets the whole alias, as before.
- If the search reports any failed shard, the rewrite is not attempted. The failure is thrown, and
  the caller's existing handler puts the rename on `SearchIndexRetryQueue`.
- This applies to `updateGlossaryTermByFqnPrefix` in both engines. Any new update-by-query over the
  global alias follows it. Existing ones, such as `updateClassificationTagByFqnPrefix`, adopt it
  when next changed.

## Consequences

A rewrite with nothing to update costs one cheap search instead of a scroll on every shard, and a
rewrite with matches touches only the indices that hold them. Every rewrite now makes one extra
search round trip. A document tagged after the search and before the update can be missed, but it
would already have been missed before, because an update-by-query also only sees refreshed
documents. Revisit if the alias ever holds more than 1000 indices, or if the engine gains a cheaper
way to scope an update-by-query.
