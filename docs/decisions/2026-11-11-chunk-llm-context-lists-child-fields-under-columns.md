# Vector chunks list a table's columns and a topic's schema fields under one `columns:` section

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial)
- **Deciders:** Search and AI context maintainers
- **Guard:** `VectorDocBuilderTopicFieldsTest` (topic format, chunk boundary) and
  `VectorDocBuilderTest` (`tableChunkText_isByteIdenticalToTheFormatBeforeTopicFields`,
  `wideTableChunks_areByteIdenticalToTheFormatBeforeTopicFields`)
- **Related:** open-metadata/OpenMetadata#37523, open-metadata/OpenMetadata#37522

## Context

Each vector chunk document carries two texts that `VectorDocBuilder` builds from the entity body:

- `textToLLMContext` is what Ask Collate reads for a hit.
- `textToEmbed` is what the embedding model sees.

Tables already listed their columns in both. Topics listed nothing from their message schema, so a
topic whose only match was a schema field, top-level or nested, could not be found by semantic or
hybrid search.

The AI platform's hybrid search tool (`HybridSearchTool.contextColumns` in ai-platform) parses a
`columns:` section out of `textToLLMContext` for any entity type. It uses that section to trim an
over-long hit down to its column list instead of cutting it blindly. So the section's label and
entry format are a contract with that repository.

## Decision

- **One child-field format.** In `textToLLMContext`, a topic's schema fields go in the same
  `columns:` section as a table's columns: `name (description)` entries separated by `, `. An entry
  is the bare name when its description is null, blank or `"null"`.
  - Nested fields are flattened depth-first as dotted paths (`payload.ratio`).
  - Table columns keep their existing format, byte for byte, and are still not flattened.
- **Embedding labels.** In `textToEmbed`, the list is introduced by `Fields include` for topics and
  `Columns include` for tables. Both labels are two words, the same as the context side's
  `description:` and `columns:`, so the two bodies chunk alike.
- **No embedded text is dropped.** One chunk document is written per `textToLLMContext` chunk. If
  the separately chunked `textToEmbed` body needs more chunks, the last document's `textToEmbed`
  carries the overflow (`VectorDocBuilder.semanticChunkFor`).
- **Unchanged topics stay unchanged.** A topic without schema fields gets no section, so its text
  and fingerprint are unchanged.
- **Refresh is driven by the fingerprint.** Topics with fields get a new fingerprint, and the next
  Search Indexing run re-embeds their chunks. `CHUNK_DOC_VERSION` is not bumped.

## Consequences

- **No AI-platform change needed.** Topic hits are trimmed to their fields the same way table hits
  are. Renaming `columns:`, or adding a dedicated marker, needs a matching change in ai-platform's
  `contextColumns`.
- **Any format change is paid.** Changing an entry format or label changes the fingerprint of every
  entity that uses it, and the next reindex re-embeds them all, one paid embedding call per chunk.
- **Upgrading.**
  - OpenSearch: run Search Indexing for `topic` to rebuild the chunk index.
  - Elasticsearch: existing topics pick up the fields only when they are edited, because the
    reindex reuses an embedding whose `updatedAt` is unchanged. Elasticsearch embeds chunk 0 only.
- **No cap on fields.** Flattened fields are not capped, matching table columns. A cap would be a
  new decision, recorded here as an amendment.
