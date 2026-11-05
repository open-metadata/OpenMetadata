# A schema property whose additionalProperties declare format: password is a map of secrets

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial); v2 2026-11-04 (removed-entry cleanup); v3 2026-11-05 (durable ownership)
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

## Amendment (v2, 2026-11-04)

After a service or ingestion pipeline update is stored, reconcile its password-map secret IDs
against the config that was actually stored before the request, not the pre-session version used
for change consolidation. Dropping an entry or a whole map, or replacing a string with a non-string,
removes its entity-owned external secret. User-owned reference targets and secrets still referenced
elsewhere in the saved config are retained. The storage hooks lock the database row before secret writes. After commit, cleanup takes that
row lock again and compares the old map with the latest stored config while holding it. A later
update either finishes first and its credentials are retained, or waits until cleanup completes.
Approval-staged and rolled-back updates do not remove credentials. Cleanup failures are logged
through the existing post-commit queue; they cannot roll the database back to references whose
secrets were deleted. Secrets orphaned before this reconciliation was introduced are not recovered.

## Amendment (v3, 2026-11-05)

The current config cannot prove ownership after a key becomes an alias or disappears. Persist
owned map-secret IDs and each live entity's references in `entity_extension`, keyed by the normalized
vault namespace rather than the entity UUID. Register actual plaintext writes in the entity's
transaction. An existing pre-ledger config seeds only same-field canonical or ancestor-path references;
a reference supplied on a new entity never establishes ownership. Reference comparison unwraps
Fernet locally and never fetches a vault value.

A stable database mutex serializes external service/pipeline writes and reconciliation across nodes,
including creation of a new entity that reuses a deleted entity's namespace. Cleanup reads the latest
ownership state with `FOR UPDATE`, independent of whether the original entity row still exists.
Retained aliases protect owned targets until their last reference disappears. Namespace records
survive normal entity-extension deletion and are removed when no owners or pending secrets remain.
Services and ingestion pipelines do not permit renaming their secret-path name.

On hard deletion, including cascading and force pipeline deletion, commit owner removal before
attempting vault cleanup. A cleanup failure leaves pending IDs available to the next reconciliation
of that namespace. Scalar ownership is retained until hard deletion; normal scalar update semantics
are unchanged. Empty map values, including Fernet-wrapped empties, bypass vault storage and only
remove their backing credential during post-commit reconciliation. Failed entity writes therefore
leave the original credential available.

The mutex deliberately serializes low-volume service/pipeline configuration writes; a slow vault
cleanup can delay another configuration save. There is no background cleanup retry worker: a vault
failure requires another write/delete in the same namespace or an explicit retry. Credentials whose
ownership was already lost before these changes cannot be reconstructed safely from a path prefix.
