# A schema property whose additionalProperties declare format: password is a map of secrets

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** backend security
- **Guard:** `PasswordEntityMaskerTest`, `SecretsManagerLifecycleTest`, `KafkaConnectionMapSecretsTest`
- **Related:** ADR:2026-10-24-a-masked-connection-secret-is-kept-only-while-the-endpoint-is-unchanged, #33477 (secrets inside arrays)

## Context

Map-valued connection properties — `consumerConfig` and `schemaRegistryConfig` on Kafka and
Redpanda, `dbtHttpHeaders` on a dbt HTTP pipeline, `headers` on a CustomLLM service — are the only
place for credentials such as `sasl.oauthbearer.client.secret`, `ssl.key.password` or a GitLab
`PRIVATE-TOKEN`. The secret framework had no notion of a map of secrets: `PasswordAnnotator` only
marked properties that are themselves `format: password`, and the walkers in `SecretsManager` and
`PasswordEntityMasker` had no branch for `java.util.Map`, so map entries were stored unencrypted,
never reached an external secrets manager, and were returned in clear to any authenticated user
(ANT-2026-INNF1N4V). #33477 closed the same gap for secrets inside arrays but not inside maps.

## Decision

- A JSON-schema property whose `additionalProperties` declare `format: password` is a **map of
  secrets**. `PasswordAnnotator` puts `@PasswordField` on the generated holder class's
  `getAdditionalProperties()`, and every walker handles the map entry by entry.
- Every **string** entry is masked on read, encrypted at rest, and — with an external secrets
  manager — stored as its own secret. Non-string entries (`session.timeout.ms: 6000`) keep their
  type and are neither encrypted nor masked: the maps also carry numbers and booleans that are not
  secrets.
- Each entry's secret id is `<entity secret path>/<field>/additionalproperties/<entry key>`,
  lowercased and cleaned by the provider's id rules (dots become `_` under the default
  configuration), and mask/unmask keys include the entry key, so a `*********` sent back by a
  client is restored for that exact entry and `deleteSecrets` derives the same id.
- Ingestion clients resolve `secret:` references inside such maps themselves; the server never
  fetches secrets. String-valued maps generate as `dict[str, CustomSecretStr]` and unwrap through
  `get_secret_value()` (dbt); untyped maps stay `dict[str, Any]` and the connector resolves
  references before use (`messaging/kafka/connection.py`).
- The mask is a **blanket**: harmless settings in the map (`security.protocol`, `group.id`) show
  as `*********` too, because JSON Schema cannot mark individual keys of a free-form map. This is
  the accepted cost of declaring the map at all; the alternative (typed fields for every possible
  key) does not exist for maps like `dbtHttpHeaders`.

## Consequences

- `connectionOptions`/`connectionArguments`, Trino `proxies` and NATS `additionalConfig` are
  deliberately **not** declared password maps: doing so would mask every option they carry, not
  only credentials. Declaring them needs a per-case decision.
- `ConnectionSecretsGuard` compares masked configs, and a masked map hides edits to non-secret
  entries (a token endpoint URL) — so the guard treats a typed value at a masked map entry as a
  retarget; see ADR:2026-10-24-a-masked-connection-secret-is-kept-only-while-the-endpoint-is-unchanged.
  Because a rotated map secret looks exactly like a retargeted setting, rotating one entry
  requires re-entering every secret of the connection.
- Rows saved before this record keep their map values in plaintext until the service or pipeline
  is saved again; credentials already stored this way should be rotated.
- Revisit if a per-key secret declaration (typed fields for known keys, refused in the map) is
  wanted for the Kafka maps, where masking harmless settings is the visible cost.
