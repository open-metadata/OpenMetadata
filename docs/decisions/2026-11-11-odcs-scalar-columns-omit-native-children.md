# ODCS scalar columns retain their declared type and omit native children

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** ODCSVersionedExportTest#scalarColumnsWithChildrenRetainTheirDeclaredType; ODCSVersionedExportTest#structuredColumnsRetainChildrenAndOmitScalarGrandchildren; DataContractResourceIT#testODCSExportScalarColumnWithChildren
- **Related:** [#37450](https://github.com/open-metadata/OpenMetadata/pull/37450); ADR:2026-11-05-odcs-exports-use-versioned-schema-backed-mappers

## Context

Native column metadata can contain children on scalar types such as VARCHAR. Emitting both
`logicalType: string` and `properties` violates the published ODCS v3 schemas and rejects the
entire export. The declared scalar type does not describe an object even when children exist.

## Decision

The native export mapper emits children only for logical objects and arrays. Scalar columns keep
their declared logical and physical types, and omit children from the export at every nesting
level. STRUCT, MAP and JSON continue to map to objects; arrays retain their item properties.
All export profiles share this native mapping, including the flattened v2 column representation.

## Consequences

Scalar children remain in stored OpenMetadata metadata but are absent from the exported document
and cannot be recovered from that document alone. Export does not silently reinterpret a scalar
column as an object. Published-schema validation and preserved-source metadata handling remain
unchanged.
