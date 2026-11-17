# Nested configuration conversion is schema-driven and fails closed for secret-bearing oneOf values

- **Status:** Accepted
- **Revisions:** v1 2026-11-01 (initial); v2 2026-11-03 (branch selection, undeclared fields, pipeline configs, labels); v3 2026-11-04 (typed branches and required fields); v4 2026-11-14 (strict writes, lossless reads, one converter, generated class identities); v5 2026-11-17 (NATS anonymous authentication)
- **Deciders:** Harsha
- **Guard:** `NestedSecretConverterCoverageTest`, `JsonSchemaRepositoryTest`, `SecretConversionBoundaryTest`, `DBSecretsManagerTest`, `PasswordEntityMaskerTest`, `ClassConverterFactoryTest`, `IngestionPipelineBuilderTest`, `MessagingServiceResourceIT`, `test_nats.py`
- **Related:** #28299, #33193, ANT-2026-5GKK8L41

## Context

JSON Schema `oneOf` properties become `Object` fields that Jackson initially fills with maps. The
password encryptor and masker only traverse typed OpenMetadata objects, so a hand-maintained
converter registry had to re-type every secret-bearing branch. Registries repeatedly missed nested
children, newly allowed branches, inline definitions, and ingestion pipeline configurations.

## Decision

1. One schema converter owns ordinary branch selection and recursive conversion. Typed inputs
   select their runtime branch. Raw inputs use declared discriminators and compatible shapes in
   schema order. Contextual adapters handle only selection that needs information outside the
   value, such as a workflow request or test-connection request. Per-connection candidate lists
   and a second schema pass are removed.
2. Writes are strict. Undeclared fields in a closed schema cause a 400 naming the field, including
   misspelled optional secrets. Conversion completes before encryption can write external secrets.
   Declared dynamic maps remain supported. A failed closed secret branch cannot escape validation
   through an open object alternative.
3. Reads try the same conversion. If the stored value cannot bind without losing data, the complete
   subtree remains a map with internal schema metadata. The secret walker visits password fields
   from every union branch, regardless of missing required fields or contradictory discriminators.
   It retains undeclared fields, visits each secret once, and masks a malformed scalar password
   containing an object or array as a whole. An old row therefore remains readable and repairable.
4. Generated class identity comes from jsonschema2pojo's actual output. The spec build packages a
   schema-location-to-class index. Runtime code does not infer a package or class name from a file
   name or title. Schema facts are finite immutable build inputs, initialized lazily with a resource
   path and cause on failure. Union branches, required fields, discriminators, open alternatives,
   and password reachability are computed once.
5. Secret paths retain existing getter, collection, and password-map identities. Raw fallback
   traversal follows the same identity rules as typed traversal. New credential sources in
   `sourceConfig.config` are discovered through password reachability in the schema, including
   nested objects, arrays, and password-valued additional properties.
6. Pipeline configs use the same property conversion as other unions. A missing `type` can be
   deduced from a unique shape such as `dbtConfigSource`; a default applies after branch selection.
   Defaults alone cannot distinguish otherwise ambiguous branches. Unspecified configs remain
   subject to the pipeline's normal validation.
7. When an inline branch moves to its own file, its form label stays on the `$ref` in the `oneOf`.
   Published Python imports remain available through a compatibility shim. The label is not an
   import identifier and must not be used to reconstruct one.

## Consequences

- Adding a secret-bearing branch requires a schema and generated class identity, not a converter
  registration or guard field-name entry.
- `SecretsManagerUpdateService` rewrites service and ingestion-pipeline rows during `migrate`.
  It decrypts stored values without dropping fields, then applies strict conversion before
  encryption and persistence. Valid rows are rewritten. Invalid rows remain unchanged and are
  reported for repair; migration must not claim that those rows were converted. This supersedes
  the destructive storage-manifest read and migration behavior in v4 of
  ADR:2026-10-24-a-masked-connection-secret-is-kept-only-while-the-endpoint-is-unchanged.
- A skipped row can still contain a previously stored plaintext credential. Response masking
  protects schema-declared secret fields while the row is repaired and migration is rerun.
  Credentials exposed before this fix should be rotated.
- Unknown historical fields are preserved, but only schema-declared password paths can be
  recognized as secrets. New closed-schema writes reject unknown fields.

## Amendment v3, superseded by v4

Typed inputs select the branch matching their runtime class before conversion visits their children.
The undeclared-field fallback in decision 3 applies only when every required property of the chosen
branch has a non-null value. Complete stored configurations may retain compatibility with obsolete
fields; incomplete credentials are rejected. `SchemaClassConverterTest` and `DBSecretsManagerTest`
enforce these rules.

## Amendment v5 (2026-11-17): NATS anonymous authentication

Anonymous NATS authentication accepts an absent or null `authType`, or `{}` through the closed
`#/definitions/anonymousAuth` definition in `natsConnection.json`. Any non-empty `authType` must fully
match the basic, token, or NKey branch. Writes reject partial or unknown credentials and never treat
them as anonymous. The anonymous choice remains a referenced, closed definition so its generated
Python model also rejects non-empty objects.

Guards: `SecretConversionBoundaryTest`, `MessagingServiceResourceIT`, `test_nats.py`.

## Python alias removal

The aliases in `scripts/datamodel_generation.py` are a frozen compatibility shim for imports that
existed before branches moved to files. Keep them through the current major release series.
Remove them only in a breaking model-package release after a release-note deprecation and migration
of downstream imports to the canonical modules. `test_generated_model_aliases.py` pins their identity.

The `$ref` titles cannot generate these aliases. NATS uses the label `Username and Password` for
the legacy name `BasicAuth`, and `NKey Seed` for `NkeyAuth`. Storage uses `No Global Manifest` for
`NoMetadataConfigurationSource`. Future moves must record an explicit legacy symbol if they need
an alias; form-label edits must never change published imports.

## Future generated unions

Typed unions generated consistently for Java, Python, and TypeScript would remove ordinary runtime
branch conversion. That is a separate compatibility change requiring deducible or discriminated
unions and a build rule that validates them. This change removes redundant bespoke converters now.
The remaining contextual adapters can be removed when their owner context is expressed in schema.
Conservative schema traversal remains necessary while malformed historical maps must stay readable.
