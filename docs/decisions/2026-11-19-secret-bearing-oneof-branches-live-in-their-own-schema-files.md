# Secret-bearing oneOf branches live in their own schema files, and their converter is registered

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `NestedSecretConverterCoverageTest`; `PasswordEntityMaskerTest`; merge-order review
- **Related:** [OpenMetadata #28299](https://github.com/open-metadata/OpenMetadata/issues/28299), [OpenMetadata #33193](https://github.com/open-metadata/OpenMetadata/pull/33193), [OpenMetadata #37965](https://github.com/open-metadata/OpenMetadata/pull/37965), [OpenMetadata #38117](https://github.com/open-metadata/OpenMetadata/pull/38117), [Collate #8684](https://github.com/open-metadata/openmetadata-collate/pull/8684)

## Context

jsonschema2pojo turns a `oneOf` property into a bare `Object`, which holds a `LinkedHashMap` at
runtime. The masker and the secrets manager only walk generated classes, so a `format: password`
field below such a property was stored unencrypted and returned unmasked. When the branches are
inline `#/definitions`, no class is generated for them at all, so no converter can type them.
SFTP (#33193), the connections in #37965, and SSIS, Qlik Sense, NATS and SAP S/4HANA (#38117) hit
the same gap.

## Decision

A `oneOf` branch that holds a `format: password` field lives in its own schema file with a
`javaType`, keeping its `title`. The parent connection registers a converter in
`ClassConverterFactory` that lists every branch class; a branch nested deeper is typed with a
`NestedConfigClassConverter` entry. `NestedSecretConverterCoverageTest.KNOWN_UNCONVERTIBLE` may
only shrink.

Moving a branch changes the generated Python module path and class name, which Collate connectors
import. The OSS change merges first and the matching Collate import change merges right after it,
in the same release (SAP S/4HANA: #38117, then Collate #8684).

## Consequences

New secret-bearing branches fail the coverage test until they are split and converted. A split is
a breaking change to the generated Python names, so every downstream importer has to move with
it. Revisit if jsonschema2pojo starts generating classes for inline `oneOf` definitions, or if the
secrets code stops depending on generated classes.
