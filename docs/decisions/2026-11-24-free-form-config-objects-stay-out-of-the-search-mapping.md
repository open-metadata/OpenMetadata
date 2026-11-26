# Free-form config objects are stored in the search index but never mapped

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `FreeFormObjectIndexMappingTest` walks every entity schema for object fields with no declared properties and fails unless each one is excluded from its search document or declared non-dynamic in every language's index mapping
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

Every object field with no declared properties is either kept out of the search document, or
declared in the index mapping — in every language's copy — as
`{"type": "object", "enabled": false}`. The value is then stored in `_source` and returned by search
as before; the engine does not map, index or analyse anything inside it.

Keeping it out of the document is the existing mechanism, and most such fields already use it:
`SearchIndex.DEFAULT_EXCLUDED_FIELDS` drops `changeDescription`, `incrementalChangeDescription`,
`connection` and `changeSummary` everywhere, and an index's own `getExcludedFields()` drops
`profile.subscription` on users and teams, `odcsPreservedFields` on data contracts, and
`openMetadataServerConnection` on ingestion pipelines. The mapping declaration is for the rest —
fields the UI reads out of the document: `topicConfig`, `searchIndexSettings`,
`pipelineStatus.parameters`, `promptTemplate`'s `examples.variables`, the MCP server's
`connectionConfig.env`, `tools.inputSchema`, `tools.outputSchema` and `prompts.examples.arguments`,
and the MCP execution's `metadata`, `toolCalls.parameters` and `promptUses.arguments`.

The declaration goes on the free-form node itself, not on an ancestor, so a parent that is mapped
today keeps the mapping it has. This is only correct for a field that nothing searches, filters or
aggregates on, which holds for all of the above: `topicConfig`, for instance, is read from the
entity API and rendered as JSON in the topic's Config tab, and appears in no search query or
aggregation.

## Consequences

These fields cannot be searched or filtered. They never could in practice — the mapping each one got
depended on whichever document the engine saw first, so a query against it matched inconsistently
or failed the whole document. Making one searchable later means declaring the keys that matter, not
turning dynamic mapping back on.

A new free-form field added to a schema fails `FreeFormObjectIndexMappingTest` until it is excluded
or declared, so the class cannot grow back silently.

Existing indexes keep the mapping they were created with; the fix reaches a cluster when the index
is recreated, which `IndexMappingVersionTracker` schedules on upgrade because the mapping's hash
changed. An operator who needs it before then runs Search Indexing with Recreate Indexes.
