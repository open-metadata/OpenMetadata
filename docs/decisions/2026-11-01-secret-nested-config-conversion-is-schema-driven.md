# Nested configuration conversion is schema-driven and fails closed for secret-bearing oneOf values

- **Status:** Accepted
- **Revisions:** v1 2026-11-01 (initial)
- **Deciders:** Harsha
- **Guard:** `NestedSecretConverterCoverageTest`, `DBSecretsManagerTest`, `PasswordEntityMaskerTest`, `ClassConverterFactoryTest`
- **Related:** #28299, #33193, ANT-2026-5GKK8L41

## Context

JSON Schema `oneOf` properties become `Object` fields that Jackson initially fills with maps. The
password encryptor and masker only traverse typed OpenMetadata objects, so a hand-maintained
converter registry had to re-type every secret-bearing branch. Registries repeatedly missed nested
children, newly allowed branches, inline definitions, and ingestion pipeline configurations.

## Decision

1. Conversion resolves `oneOf` branches from the packaged JSON schemas instead of requiring a new
   converter registration for every class. Discriminators select compatible branches when present;
   otherwise branches are tried in schema order. Conversion then recurses through typed children and
   collection elements.
2. Secret-bearing inline branches must have generated classes and explicit `javaType` metadata.
3. Empty maps and non-secret dynamic objects retain their existing behavior. A map that remains
   under a secret-bearing `oneOf` after all compatible branches fail is an error, never a value that
   encryption or masking may silently skip. The original conversion exception is preserved.
4. Existing bespoke converters remain for selection that needs external context. The schema-driven
   pass runs after them, so extending a schema does not require a compensating registry entry.

## Consequences

- Adding a secret-bearing branch requires schema type metadata, not a per-class converter.
- Existing rows are not rewritten by this change; affected entities must be saved again to encrypt
  values previously stored in cleartext, and exposed credentials should be rotated.
- Invalid secret-bearing configurations fail instead of being stored or returned unprotected, so
  schema authors must keep branch metadata and generated models current.
