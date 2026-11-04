# Nested configuration conversion is schema-driven and fails closed for secret-bearing oneOf values

- **Status:** Accepted
- **Revisions:** v1 2026-11-01 (initial); v2 2026-11-03 (branch selection, undeclared fields, pipeline configs, labels); v3 2026-11-04 (typed branches and required fields)
- **Deciders:** Harsha
- **Guard:** `NestedSecretConverterCoverageTest`, `JsonSchemaRepositoryTest`, `DBSecretsManagerTest`, `PasswordEntityMaskerTest`, `ClassConverterFactoryTest`, `IngestionPipelineBuilderTest`
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
3. Empty maps and non-secret dynamic objects retain their existing behavior. When every compatible
   branch of a secret-bearing `oneOf` rejects a map, the map is typed as the secret-bearing
   candidate branch that declares most of its fields, and the fields that branch does not declare
   are dropped. A stored value that carries a field its schema no longer declares therefore stays
   readable and its secrets stay protected. A map that no branch declares any field of is an error,
   never a value that encryption or masking may silently skip; the original conversion exception
   is preserved.
4. Existing bespoke converters remain for selection that needs external context. The schema-driven
   pass runs after them, so extending a schema does not require a compensating registry entry.
5. Branch selection: when a `oneOf` also has an open object branch, a typed branch is a candidate
   only if every one of its `required` properties is present. A matching closed branch that holds
   a secret disables the fallback to the open branch.
6. A root schema without `javaType` maps to the class jsonschema2pojo generates from its file
   name, never from its `title`.
7. `sourceConfig.config` of an ingestion pipeline is converted when it declares `type`. A config
   with no `type` is converted by its pipeline type for dbt pipelines, and by the storage rules of
   ADR:2026-10-24-a-masked-connection-secret-is-kept-only-while-the-endpoint-is-unchanged for
   storage metadata pipelines; any other config without `type` is left for validation.
8. When an inline branch moves to its own file, the form label it had stays on the `$ref` in the
   `oneOf` (`{"$ref": "...", "title": "Basic Auth"}`). The file's `title` names the generated
   Python and TypeScript models, and the generator keeps the previous Python names as aliases.

## Consequences

- Adding a secret-bearing branch requires schema type metadata, not a per-class converter.
- Existing rows are not rewritten by this change; affected entities must be saved again to encrypt
  values previously stored in cleartext, and exposed credentials should be rotated.
- Invalid secret-bearing configurations fail instead of being stored or returned unprotected, so
  schema authors must keep branch metadata and generated models current.

## Amendment v3

Typed inputs select the branch matching their runtime class before conversion visits their children.
The undeclared-field fallback in decision 3 applies only when every required property of the chosen
branch has a non-null value. Complete stored configurations may retain compatibility with obsolete
fields; incomplete credentials are rejected. `SchemaClassConverterTest` and `DBSecretsManagerTest`
enforce these rules.
