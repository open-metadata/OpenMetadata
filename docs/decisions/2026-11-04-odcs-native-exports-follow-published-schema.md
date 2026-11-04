# Native ODCS exports follow the published schema

- **Status:** Accepted
- **Revisions:** v1 2026-11-04 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `ODCSNativeExportTest`, `DataContractResourceIT`
- **Related:** [#33493](https://github.com/open-metadata/OpenMetadata/issues/33493), ADR:2026-11-04-odcs-preserves-unmapped-fields-as-generic-json

## Context

A native customers contract exposed export failures against the published ODCS v3.1.0 schema:
legacy logical types, internal quality-rule column anchors, generated column defaults on table
objects, and a generated timezone on string options. Its registered native custom properties
were omitted entirely. Validation against OpenMetadata's permissive reader model did not catch these.

## Decision

All HTTP exports use a normalized JSON document. The generated ODCS model remains a permissive,
legacy-compatible reader. Native logical types use the standard vocabulary, retaining their detailed
native type in `physicalType`. Reader-only defaults do not become declarations on table objects or
column timezones. Column lengths apply only to string logical types.

Quality rules are scoped to their table or property before internal `column` anchors are removed.
A quality-only contract gets the minimal table/property structure needed to represent that scope.
Structured array children are exported as `items.properties`.

Native `DataContract.extension` values are emitted as root ODCS `{property, value}` custom-property
entries using native JSON serialization. Native values override preserved properties of the same
name; unrelated preserved entries and their metadata remain. Clearing a native-only property removes
it from export. Export does not register custom-property definitions or apply preserved declarations.

Native normalization precedes generic preservation so imported metadata is not silently filtered.
Consequently retaining nonstandard input is distinct from certifying it as standard ODCS.

Tests validate raw JSON and YAML HTTP responses against an unmodified, pinned copy of Bitol's
published v3.1.0 schema. Serializing a typed SDK response again can reintroduce generated reader
defaults and is not a check of the original HTTP wire document.

## Consequences

Native custom properties and quality expectations can be exchanged without OpenMetadata-only wire
fields. Stored contracts and generated reader models need no migration. The schema fixture and its
provenance are versioned with tests, so validation is offline and changes only by explicit review.
