# A staged index takes its shard count from the live index settings

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** Search Indexing maintainers
- **Guard:** `DefaultRecreateHandlerTest.StagedIndexShardsTests`
- **Related:** #37416, #37418

## Context
The shard count of an index can only be set when the index is created. The Search Indexing app had no
setting for it, so every staged index took the cluster default: 5 on AWS OpenSearch. With about 80
indexes that is about 400 primary shards for catalogs that fit in one shard per index. A reindex builds
a full staged copy next to the live indexes, so on a single node the shard count doubles during the
run and passes `cluster.max_shards_per_node` (1000). The schema used to say the setting was omitted
because staged indexes are created from the static mapping JSON.

## Decision
A reindex creates each staged index with `liveIndexSettingsByEntity[entity].numberOfShards`, or with
`liveIndexSettings.numberOfShards` when the entity has no override object, written to
`settings.index.number_of_shards` in the creation body.

- The configured value replaces any `number_of_shards` the mapping JSON pins (for example
  `pipeline_status_index_mapping.json` pins 1). An explicit admin setting wins over a built-in default.
- A per-entity override object replaces the global object as a whole, as it already does for
  `numberOfReplicas` and the other live settings. An override without `numberOfShards` therefore keeps
  the mapping or cluster default; it does not inherit the global value.
- Unset leaves the creation body unchanged: the mapping's pin or the cluster default.

## Consequences
Admins can size shards per catalog, and a reindex is the moment a new value takes effect. The value
is not applied to live indexes in place, since shards cannot change there. Revisit if per-entity
overrides move to field-by-field merging, which would also change the replica and refresh semantics.
