# The Data Insights custom-property twin holds only values of the property's current type

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** Vamsi-klu
- **Guard:** `CustomPropertiesStepTest#everyCustomPropertyTypeHasATwinShape`, `DataInsightsCustomPropertyIndexingIT`
- **Related:** [#36819](https://github.com/open-metadata/OpenMetadata/issues/36819), #29643, #17350

## Context

Data Insights copies each asset's custom properties into `<entityType>CustomProperty` (for example
`dashboardCustomProperty`). The Data Insights templates do not map that field, so Elasticsearch and
OpenSearch type each sub-field from the first snapshot a backing index receives. OpenMetadata 1.x
stored plain strings in Team (`entityReference`) properties, and 2.0 keeps those rows and the
`<entity>.version.*` snapshots that hold them. One such string mapped the sub-field as `text`, every
later Team object was rejected with `document_parsing_exception`, and the rejection stopped the rest
of that entity type's run. Values of a deleted or re-typed property in version snapshots do the same.
Group By chart fields (`fetchDIChartFields`) and Collate read the twin's paths, so its shape cannot
change.

## Decision

`CustomPropertiesStep` copies a value into the twin only when its JSON shape matches the property's
current built-in type: an object for `entityReference`, `timeInterval`, `hyperlink-cp` and
`table-cp`; a list of objects for `entityReferenceList`; text or a list of text for `enum`; a number
for `integer`, `number` and `timestamp`; text for the other built-in types. Built-in types declare
their shape in `TWIN_SHAPE_BY_TYPE`. A user-created field type (created through `/v1/metadata/types`)
has no declared shape, so its values are copied as before, whatever the type is called. Values of
properties that are no longer defined are left out; a missing property is told apart from a defined
one by the lookup coming back empty (`SearchIndexUtils.findPropertyType`), not by a reserved type
name. The raw `extension` and `customPropertiesTyped` are unchanged, and field paths
stay the same for valid values.

## Consequences

A legacy or stale value no longer decides the twin's mapping, but it is not Group By-able either; it
stays in `extension`. Numeric strings in numeric properties are left out of the twin. Values of
user-created field types are not checked, as before this change. A write index that was mapped
wrongly before this change keeps that mapping until the stream rolls over (`POST <stream>/_rollover`,
which keeps history). A property deleted and re-added under the same name with another type also
finds the old mapping in the current write index, so that stream needs one more `_rollover`. Adding a
built-in custom-property type requires adding its shape, or `everyCustomPropertyTypeHasATwinShape`
fails.
