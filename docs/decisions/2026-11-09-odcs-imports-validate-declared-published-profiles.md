# ODCS imports validate the declared published profile before native conversion

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
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
forms still block import before test-case creation or contract persistence.

Adapters produce a canonical JSON view with name/path identities for metadata preservation. The
existing generic payload retains the declared version and pinned schema location. v2 qualified column
paths preserve quoted literal dots; v2 default nullability is made explicit. Native arrays retain
primitive item types. Only the selected schema object's quality rules enter its contract.

Quality compatibility annotations recover source IDs and parameters. External v2 check metadata uses
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
