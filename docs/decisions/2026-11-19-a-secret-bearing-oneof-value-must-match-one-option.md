# A secret-bearing oneOf value that matches no option is refused on save and fully masked on read

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** manerow
- **Guard:** `UnmatchedOptionSecretsTest`, `UnmatchedOptionsTest`,
  `PasswordEntityMaskerTest#testEveryLeafOfAValueThatMatchesNoOptionIsMasked`,
  `NestedSecretConverterCoverageTest#everyOptionOfASecretBearingOneOfIsAcceptedWhenSaving`,
  `PipelineServiceResourceIT#post_databricksServiceWithAuthTypeMatchingNoOption_400`,
  `LocalPathOptionSecretsTest`, `GcpCredentialsPathSecretsTest`,
  `UnmatchedOptionWorkflowSecretsTest`, `UnmatchedOptionPipelineSecretsTest`,
  `WorkflowResourceIT#post_testConnectionWithAuthTypeMatchingNoOption_400`
- **Related:** ADR:2026-10-29-service-connection-secrets-are-written-only-during-storage

## Context

jsonschema2pojo generates a JSON Schema `oneOf` as a bare `Object` property. A `ClassConverter`
types its value by trying each option's class in turn, and the secrets code works on the typed
value. A connection must therefore match one of its options before it is stored.

A value that is already stored must stay readable, so a person can open the service and correct
it, and an ingestion bot can still receive its credentials.

## Decision

The secrets entry points pick what a converter does with a non-empty value that matches none of
its options, when at least one option can hold a secret (`UnmatchedOptions`):

- **Saving** refuses it with a 400 that names the property when known, the options and the keys
  no option declares. It never echoes a value.
- **Reading as a person** replaces every scalar leaf of the value with the mask, at any depth, so
  a read never fails.
- **Reading as a bot** decrypts the leaves that are Fernet tokens and returns the rest as stored.

| Entity | Save | Read as a person | Read as a bot |
|---|---|---|---|
| Service connection | `SecretsManager.encryptServiceConnectionConfig`, `prepareServiceConnectionConfig` | `PasswordEntityMasker.maskServiceConnectionConfig` | `SecretsManager.decryptServiceConnectionConfig` |
| Test Connection workflow | `SecretsManager.encryptWorkflow` | `PasswordEntityMasker.maskWorkflow` | `SecretsManager.decryptWorkflow` |
| Ingestion pipeline | `SecretsManager.encryptIngestionPipeline` | `PasswordEntityMasker.maskIngestionPipeline` | `SecretsManager.decryptIngestionPipeline` |

Unmasking keeps the value as it is, because every save then goes through the save entry point.
Every other conversion keeps the value as it is: values whose options cannot hold a secret, an
empty map (the "None" choice), and converter callers outside these entry points. The choice lives
in a thread-local for the length of one conversion, set and cleared by `SecretsUtil.convert`.

A converter's candidate list names one generated class per option of its `oneOf`, so a valid
value always matches one of them. An inline option gets a schema file of its own with a
`javaType` so that it has a class to list. `NestedSecretConverterCoverageTest` builds a value for
every option and fails when saving refuses one.

## Consequences

- A stored entity whose connection matches no option cannot be updated, by PUT or PATCH, until
  the connection is corrected. `SecretsManagerUpdateService` logs and skips such a row on migrate.
- Masking every leaf also hides fields that are not secrets in such a value. That only affects
  values that are already invalid.
- Adding an option to a secret-bearing `oneOf` means adding its class to the converter's
  candidate list; the coverage test fails until it is there.
