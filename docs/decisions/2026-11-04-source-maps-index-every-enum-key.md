# Source maps stay non-dynamic and declare every source enum value as an integer key

- **Status:** Accepted
- **Revisions:** v1 2026-11-04 (initial)
- **Deciders:** Harshit Shah
- **Guard:** `SourcesIndexMappingTest` (every key, every mapping, every `IndexMappingLanguage`); `SearchConsumerFieldBehaviorIT` (`exists` probes on a real engine)
- **Related:** open-metadata/openmetadata-collate#7441, open-metadata/OpenMetadata#37020, #25627

## Context
#25627 set `descriptionSources`, `tagSources` and `tierSources` to `{"type": "object", "dynamic": false}`
to stop custom-property field explosion. With no declared properties, no key under these maps was
indexed: documents kept the counts in `_source`, but `exists` on `descriptionSources.Suggested`
matched nothing. The Collate AI insights widget drills into Explore with exactly those `exists`
filters, so its drill-downs returned empty results.

## Decision
In every entity index mapping, in every language, the three maps stay `dynamic: false` and declare
each key explicitly as `integer`:

- `descriptionSources`: every `ChangeSource` value.
- `tagSources` and `tierSources`: every `TagLabel.LabelType` value.

The field paths `<map>.<enumValue>` are a contract with Collate, whose AI-insight drill-downs query
them directly.

## Consequences
- The key set is closed by the enums, so the maps cannot explode the field count.
- Adding a `ChangeSource` or `LabelType` value requires adding it to every mapping, which
  `SourcesIndexMappingTest` enforces, and a reindex before existing documents match.
- Switching the maps to `dynamic: true` or renaming a key breaks the Collate drill-downs.
- Documents indexed before the mapping change match only after the reindex that the
  mapping-hash drift triggers.
