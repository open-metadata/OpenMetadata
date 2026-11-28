# An unreadable secret reference stops ingestion; under the DB provider a secret: value is literal

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `TestUnresolvableSecretReference`, `TestSecretPrefixUnderDbProvider`, `TestNullSecretResolution`, the secret tests in `tests/unit/source/messaging/kafka/test_connection.py`
- **Related:** ADR:2026-10-30-password-format-on-additionalproperties-makes-a-map-of-secrets

## Context

With an external secrets manager the server hands ingestion `secret:<id>` references instead of
credentials. When the manager could not return one, ingestion logged the failure and used the
reference text itself as the credential, so the run reached the source with a wrong password and
failed there with a misleading error. Under the default DB provider ingestion stripped the
`secret:` prefix from any value, while the server's `DBSecretsManager.isSecret()` treats such a
value as an ordinary password. Typed password fields and the Kafka config maps resolved references
through two separate functions that disagreed on these cases.

## Decision

Every `secret:` value in ingestion resolves through `resolve_secret_reference` in
`metadata/ingestion/models/custom_pydantic.py`:

- **DB provider:** the value is the literal secret and is returned unchanged, as the server treats it.
- **External provider:** only the leading `secret:` is removed, and the rest is the id asked of the
  manager. A reference the manager cannot return raises `SecretReferenceError`, naming the reference
  and the provider, with the manager's error as its cause. The reference is never used as the
  credential.
- **A secret stored as `null`** is a credential cleared by an older server, which reads that
  placeholder as absent. A typed password field resolves it to `""`, since callers need a string; a
  Kafka config map leaves the entry out, as the server leaves out a cleared entry.

## Consequences

A run whose reference cannot be read stops when it builds the connection, with the cause in the
error, instead of failing later at the source. Any new place that reads a `secret:` value calls
`resolve_secret_reference` rather than a secrets manager directly, so the cases above cannot drift
apart again. Using a reference as a fallback credential would need a reversal of this record.
