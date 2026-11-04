# ODCS preserves unmapped fields as generic JSON

- **Status:** Accepted
- **Revisions:** v1 2026-11-04 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `ODCSGenericPreservationTest`, `DataContractResourceIT`
- **Related:** [#33493](https://github.com/open-metadata/OpenMetadata/issues/33493), ADR:2026-11-03-odcs-io-follows-the-published-v3-1-0-schema

## Context

The typed `odcsElementExtensions` storage preserved only two attributes. Each additional ODCS
attribute required another storage-schema change. Reading an ODCS document successfully therefore
did not imply that its metadata would survive export.

## Decision

`DataContract.odcsPreservedFields` stores a generic JSON remainder of the imported document,
plus pointers identifying collection entries that were never applied natively. Those pointers refer
to the stored remainder; exported elements are matched by identity rather than their current index.
The remainder is encoded as JSON text inside this envelope so the general database JSON mapper
cannot round decimal values. Export parses that text with decimal precision enabled.
Capture uses the original JSON tree before lenient model repairs. Only mapped values actually
present in an import-time native export are removed; unknown fields, nested structures, explicit
nulls, arrays and scalar types remain. The mapping catalogue describes native capabilities, not an
allowlist of fields that may be preserved. Adding an unmapped ODCS field needs no storage change.

Exports combine this remainder with the current native contract. Native mapped fields win;
previously applied values are not restored after a user clears them. Schema properties are matched
by name within their parent, roles by role, team members by username and SLA properties by property.
Matching never uses a column's array position. Deleted mapped entries are not reintroduced;
originally unapplied entries remain metadata and do not grant access or create executable checks.
The selected table object's metadata follows the exported target table name. Unselected schema
objects remain outside the one-table contract and are reported as not imported.

The native contract owns identity, version and creation timestamp. New ODCS versions and new
executable semantics still require explicit support; generic preservation does not certify unknown
fields against an ODCS schema. Export continues to declare ODCS v3.1.0.

Ordinary PUT omission retains the payload; an explicit empty object clears it. ODCS merge combines
object keys recursively, with incoming arrays/scalars replacing prior values. Replace uses only the
incoming remainder. Changes are versioned with the contract. The payload is excluded from search indexing, as with
the existing free-form ODCS blocks, so arbitrary metadata keys cannot expand the search mapping. Existing typed extensions remain
readable without a database migration; the new field is additive and optional.

Preserved fields are reported as informational metadata, rather than warnings that they were lost.
Warnings still describe values that cannot be applied or declarations outside the selected table.

## Consequences

Future unmapped metadata can survive import/export without adding generated storage fields.
Operational meaning is still controlled by native mappings and authorization. Serialization uses
JSON trees at the export boundary so unknown fields are not reparsed through an older typed model.
YAML comments, anchors and formatting are not retained, since preservation starts after parsing.
