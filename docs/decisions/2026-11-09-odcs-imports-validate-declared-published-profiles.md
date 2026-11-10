# ODCS imports validate the declared published profile before native conversion

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial) · v2 2026-11-10 (cross-version metadata transport)
- **Deciders:** Teddy Crepineau
- **Guard:** ODCSVersionedImportTest; DataContractResourceIT#testVersionedODCSImportMatrix; DataContractResourceIT#testVersionedODCSInvalidDocumentsHaveNoSideEffects
- **Related:** [#37202](https://github.com/open-metadata/OpenMetadata/issues/37202); ADR:2026-11-05-odcs-exports-use-versioned-schema-backed-mappers

## Context

Export already selects a mapper backed by a pinned published schema. Import previously read every
version through the shared v3 model, which accepts compatibility fields but cannot identify a valid
v2 dataset. The v2 statuses emitted by export were rejected, and preview and parse followed different
normalization paths.

## Decision

`ODCSProfiles` owns the six adapters and pinned schema validators for both directions. Import requires
an explicit `apiVersion` and validates its wire document before invoking the adapter and native reader.
JSON/YAML create and update, YAML parse, and YAML validation share `ODCSImportService`.

| Declared version | Schema and import representation |
| --- | --- |
| v3.1.0 | schema objects/properties, team object, metric-based quality |
| v3.0.2, v3.0.1, v3.0.0 | schema objects/properties, team array, legacy library rule names |
| v2.2.2 | uuid, dataset/columns, stakeholders, legacy tool/template checks |
| v2.2.1 | v2 shape with dataset descriptions as string arrays and string primary-key flags |

v2.2.0 has no pinned published schema; v3.2.0 has no registered profile. Neither is accepted by the
import endpoints. Missing, malformed and unsupported declarations produce distinct errors. Native
conversion failures and target-table validation remain distinct from published-schema failures.

Known legacy OpenMetadata encodings are normalized deliberately, then validated against the same
declared version. This includes the existing description/team/approver/custom-property encodings,
root-level quality rules, and the finite set of historical library aliases. Legacy quality aliases
that the published format cannot express use a custom declaration containing their source rule.
Normalization is reported and never changes `apiVersion`. Invalid fields outside these compatibility
forms still block import before test-case creation or contract persistence. Neutral table defaults
are identified from the shared reader schema, rather than maintained as a second list of default
values. Old SQL declarations without comparisons remain non-executable; the historical implicit-zero
comparison on null/duplicate/missing/invalid-value checks is made explicit. Complete legacy quality
payloads are type-checked before encapsulation so a recognized alias cannot hide malformed fields.

Adapters produce a canonical JSON view with name/path identities for metadata preservation. The
existing generic payload retains the declared version and pinned schema location. v2 qualified column
paths preserve quoted literal dots; v2 default nullability is made explicit. Native arrays retain
primitive item types. Only the selected schema object's quality rules enter its contract.

Quality compatibility annotations recover source IDs and parameters. Only v3.0 profiles interpret
the final textual `odcsId` custom property as an ID annotation; preceding properties remain intact,
and embedded source IDs take precedence. A lone user property with that reserved name is inherently
ambiguous in that historical encoding. v3.1 properties with the same name are ordinary metadata. External v2 check metadata uses
a custom-property annotation so its tool/template/code and vendor fields survive version conversion.
Assertions containing arbitrary JSON or numbers that cannot be represented exactly by the native
numeric model are preserved and reported as not executable; they never become coerced native tests.
Native edits and deletions retain precedence, including registered custom-property ownership.

## Consequences

Import and export use one support matrix and the same validation authority. The generated POJOs remain
useful projections, rather than validators for conditional schema rules or arbitrary JSON assertions.
No network schema lookup or per-field preservation list is introduced.

Validation is stricter than the former reader. Published-schema validity does not imply a native
mapping or an executable test: reports describe those separately. Only explicitly recognized legacy
encodings are repaired. Adding a published version requires a registered adapter, pinned schema,
and round-trip fixtures; new versions are never accepted solely because the permissive reader can
parse them. Changing a quality rule's execution can supersede its old source representation, while
unrelated source metadata remains hidden and preserved.


## Amendment — lossless metadata across published export profiles

Preserved source fields can be valid in their original profile and invalid in another: v2 root
`type`/`datasetName` have no v3 root representation, while v2.2.1 dataset descriptions are arrays
and the newer profiles require text. Same-version validation alone did not cover these conversions.

Versioned export now normalizes the preserved remainder before overlay, using the pinned canonical
schema to discover unsupported contract/table/column/item keys. These fields travel in a scoped
`customProperties` entry named `https://open-metadata.org/odcs/source-metadata`, with a format version
and generic field/value records. No per-field preservation list or storage/model change is needed.
The original stored remainder is left intact, so existing contracts benefit without migration.

Description arrays get a text projection and retain their exact original array in the annotation.
After target serialization, each carried value is checked against that profile's published field
schema. Representable fields are restored; the rest remain annotated. A projection changed or
deleted since import cannot resurrect its original value. Native fields and legacy native aliases
cannot be overwritten by annotations. Ordinary properties sharing the reserved name without the
annotation shape are retained as user metadata.

The metadata stays attached to its schema element, preserving identity through column reordering
and deletion. The final complete document still passes the unchanged published validator; this
transport does not hide malformed native fields or relax import validation. Compatibility helpers
that expose raw metadata keep their existing behavior. The tradeoff is a visible compatibility
annotation in exported ODCS when the target has no direct representation for source metadata.

`ODCSCrossVersionRoundTripTest` covers all 36 source/target combinations and reverse imports,
including arbitrary future metadata, multi-part descriptions, native edits/deletions and annotation
identity protection. The HTTP matrix validates all six export targets after each versioned import.
