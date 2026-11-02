# Secrets behind a oneOf are reached only through a registered converter, whose candidates are tried in order

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Mayur Singal
- **Guard:** `NestedSecretConverterCoverageTest` (every secret-bearing `oneOf` branch of every
  connection schema, and of every `sourceConfig.config` of `metadataIngestion/workflow.json`);
  `TestSuitePipelineClassConverterTest`; `DBSecretsManagerTest`
- **Related:** #28299, #33193

## Context

jsonschema2pojo generates a `oneOf` property as a bare `Object`, and Jackson leaves a
`LinkedHashMap` in it. `PasswordEntityMasker` and `SecretsManager` only descend into
`org.openmetadata.*` values, so every `format: password` field below such a map is stored as sent
and returned unmasked. The only thing that reaches it is a `ClassConverter`, registered in
`ClassConverterFactory`, that types the map before either walk runs. Several connection and
ingestion pipeline configs were still left untyped after #33193.

## Decision

- Every secret-bearing `oneOf` has a registered converter, and so does every class below it that
  has one of its own: Jackson builds a typed child without consulting the registry.
- A `oneOf` branch that is an inline `#/definitions` entry gets no generated class, so a
  secret-bearing branch lives in its own schema file.
- A converter tries its candidates in order and keeps the first that Jackson accepts. A branch that
  also matches another branch's payload is listed after it: MySQL tries `GcpCloudSqlConfig` last,
  because its password-only form is also a valid `basicAuth`, and QlikSense tries certificate
  values before paths, because neither forbids additional properties.
- `IngestionPipelineBuilder.addDefinedConfig` types the secret-bearing pipeline configs strictly:
  dbt, storage metadata (`METADATA` with config `type` `StorageMetadata`) and test suite. A config
  that does not match its schema fails the conversion, as dbt configs always have.
- A test suite service connection is typed by its config's `type`; one whose `type` is missing
  (the field is optional) or unknown is left untyped, so the stored pipeline stays readable.
- `applicationPipeline` is not typed: its `appConfig` and `appPrivateConfig` branches have no
  discriminator to choose a class by, and the application framework encrypts app configuration.

## Consequences

- A new connector or pipeline config with a secret behind a `oneOf` fails
  `NestedSecretConverterCoverageTest` until its converter is registered.
- Reordering a candidate list can re-type stored configs silently; the coverage test catches a
  secret left in a map, not a config typed as the wrong branch.
- Rows written before a converter existed keep their values as stored until the entity is saved
  again.
- Typing `applicationPipeline` needs a discriminator on the app config branches first.
