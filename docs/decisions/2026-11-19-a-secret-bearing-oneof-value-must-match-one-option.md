# A secret-bearing oneOf value that matches no option is refused on save and fully masked on read

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** manerow
- **Guard:** `UnmatchedOptionSecretsTest`, `UnmatchedOptionsTest`,
  `PasswordEntityMaskerTest#testEveryLeafOfAValueThatMatchesNoOptionIsMasked`,
  `NestedSecretConverterCoverageTest#everyOptionOfASecretBearingOneOfIsAcceptedWhenSaving`,
  `PipelineServiceResourceIT#post_databricksServiceWithAuthTypeMatchingNoOption_400`,
  `LocalPathOptionSecretsTest`, `GcpCredentialsPathSecretsTest`
- **Related:** ADR:2026-10-29-service-connection-secrets-are-written-only-during-storage

## Context

jsonschema2pojo generates a JSON Schema `oneOf` as a bare `Object` property. A `ClassConverter`
types its value by trying each option's class in turn, and the secrets code works on the typed
value. A connection must therefore match one of its options before it is stored.

A value that is already stored must stay readable, so a person can open the service and correct
it, and an ingestion bot can still receive its credentials.

## Decision

The service connection entry points pick what a converter does with a non-empty value that matches
none of its options, when at least one option can hold a secret (`UnmatchedOptions`):

- **Saving** (`SecretsManager.encryptServiceConnectionConfig` and
  `prepareServiceConnectionConfig`) refuses it with a 400 that names the property when known, the
  options and the keys no option declares. It never echoes a value.
- **Reading as a person** (`PasswordEntityMasker.maskServiceConnectionConfig`) replaces every
  scalar leaf of the value with the mask, at any depth, so a read never fails.
- **Reading as a bot** (`SecretsManager.decryptServiceConnectionConfig`) decrypts the leaves that
  are Fernet tokens and returns the rest as stored.

Every other conversion keeps the value as it is: values whose options cannot hold a secret, an
empty map (the "None" choice), and converter callers outside these entry points. The choice lives
in a thread-local for the length of one conversion, set and cleared by `SecretsUtil.convert`.

A converter's candidate list must name every option of its `oneOf`, so a valid value always
matches one of them. `NestedSecretConverterCoverageTest` builds a value for every option and fails
when saving refuses one.

## Consequences

- A stored service whose connection matches no option cannot be updated, by PUT or PATCH, until
  the connection is corrected. `SecretsManagerUpdateService` logs and skips such a row on migrate.
- Masking every leaf also hides fields that are not secrets in such a value. That only affects
  values that are already invalid.
- An option needs a generated class to be listed as a candidate, so an inline option gets a
  schema file of its own with a `javaType`. Each candidate list names one class per option.
- Test Connection workflows and ingestion pipelines convert through their own entry points and are
  not covered by this record.
