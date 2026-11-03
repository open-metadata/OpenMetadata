# ODCS import/export follows the published v3.1.0 schema

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `ODCSConverterTest`, `ODCSSlaMapperTest`, `ODCSLenientReaderTest`,
  `ODCSLegacyShapeCompatTest`, `DataContractResourceIT`; reviewer
- **Related:** [#33493](https://github.com/open-metadata/OpenMetadata/issues/33493),
  [#36877](https://github.com/open-metadata/OpenMetadata/pull/36877)

## Context

OpenMetadata's Open Data Contract Standard (ODCS) model previously differed from the
[published v3.1.0 schema](https://github.com/bitol-io/open-data-contract-standard/blob/v3.1.0/schema/odcs-json-schema-v3.1.0.json).
Valid documents could fail import, and exports could use incompatible field shapes. Correcting
the shared JSON Schema also changes generated Java, Python and TypeScript models, so callers
and stored contracts need an explicit compatibility policy.

## Decision

- The [OpenMetadata ODCS schema](../../openmetadata-spec/src/main/resources/json/schema/entity/datacontract/odcs/odcsDataContract.json)
  is the source of truth for generated models. Exports use `team: {members: [...]}` and string
  `firstLevelApprovers` / `secondLevelApprovers`, rather than arrays. ODCS v3.1.0 also accepts the
  deprecated bare-array team; OpenMetadata emits the object form.
- Root and supported nested `customProperties` use arrays of `{property, value}` pairs.
  Custom-property `value` and SLA `value` / `valueExt` use Java `Object` so JSON scalar values
  retain their type instead of being coerced to text. Optional absent arrays remain absent.
  `contractCreatedTs` is represented as an ISO-8601 string in the generated model.
- [ODCSConverter](../../openmetadata-service/src/main/java/org/openmetadata/service/util/ODCSConverter.java)
  joins `Policy.identities` with commas into `firstLevelApprovers` on export. Import splits that
  field on commas, trims whitespace and drops empty entries. This delimiter convention is an
  OpenMetadata mapping choice, not an ODCS requirement. It provides no comma escaping, so an
  identity containing a comma cannot round-trip. `secondLevelApprovers` has no equivalent in
  `Policy.identities` and is not merged into it.
- Compatibility is applied on read, without a bulk data migration.
  [ODCSShapeNormalizer](../../openmetadata-service/src/main/java/org/openmetadata/service/datacontract/odcs/ODCSShapeNormalizer.java)
  wraps legacy bare-array teams, joins legacy approver arrays and converts supported nested
  map-form custom properties before import. The import report records these rewrites.
  [ODCSCustomPropertiesCompatModule](../../openmetadata-spec/src/main/java/org/openmetadata/schema/entity/datacontract/odcs/ODCSCustomPropertiesCompatModule.java),
  registered in `JsonUtils`, accepts map-form custom properties in stored contracts, preserving
  their values as it converts them to pairs. Reading does not rewrite the database row.
- SLA quantities that OpenMetadata represents as integers are imported only when they are whole
  numbers in the signed 32-bit range. Other values are omitted and reported as SLA warnings.

## Consequences

ODCS consumers receive the published field shapes, while legacy input and stored custom
properties remain readable. Clients expecting the former export shapes must adapt; compatibility
on input does not preserve those shapes on export. Supporting commas within approver identities
would require an explicit encoding change and compatibility tests. Future ODCS version changes
must update the schema, converters and compatibility tests together.
