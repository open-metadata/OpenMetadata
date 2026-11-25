# Free-form config objects are stored in the search index but never mapped

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `TopicConfigIndexMappingTest` reads every language's `topic_index_mapping.json` and fails unless `topicConfig` is declared with `"enabled": false`
- **Related:** [#35796](https://github.com/open-metadata/OpenMetadata/issues/35796) (the same failure on `searchIndexSettings`)

## Context

A few entity fields hold configuration copied verbatim from the source system: a topic's
`topicConfig`, a search index's `searchIndexSettings`. Their schema is `"type": "object"` with no
properties, because the keys belong to Kafka or to OpenSearch, not to us.

None of them were declared in the index mappings, so the search engine mapped them dynamically. It
expands a dot in a field name into another level of object, and broker and index settings are keyed
with dots. One topic configured with `confluent.key.schema.validation` makes `validation` a value;
another configured with a key under that prefix needs it to be an object, and the second document
is rejected:

```
can't merge a non object mapping [topicConfig.confluent.key.schema.validation] with an object mapping
```

The run reports a failed entity type, and nothing about the error points at the broker setting that
caused it. Unbounded dynamic keys also grow the mapping towards the index's field limit, which fails
every later document in that index rather than one.

## Decision

Declare each such field in the index mapping as `{"type": "object", "enabled": false}`, in every
language's copy. The value is stored in `_source` and returned by search as before; the engine does
not map, index or analyse anything inside it.

This is only correct for a field that nothing searches, filters or aggregates on. `topicConfig` is
read from the entity API and rendered as JSON in the topic's Config tab, and is not in any search
query or aggregation.

## Consequences

The field cannot be searched or filtered. It never could in practice — the mapping it got depended
on whichever document the engine saw first, so a query against it matched inconsistently or failed
the whole document. Making one searchable later means declaring the keys that matter, not turning
dynamic mapping back on.

Existing indexes keep the mapping they were created with; the fix reaches a cluster when the index
is recreated, which `IndexMappingVersionTracker` schedules on upgrade because the mapping's hash
changed. An operator who needs it before then runs Search Indexing with Recreate Indexes.
