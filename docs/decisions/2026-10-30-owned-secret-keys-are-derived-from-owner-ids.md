# An owned credential's secret key is derived from its owner's id

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `OwnedSecretsTest`
- **Related:** `SecretOwner`, `OwnedSecrets`

## Context

An external secrets manager stores each credential under a key, and the row that uses it keeps a
`secret:` reference to that key. The key has to identify one credential of one owner for the owner's
whole life, and it has to be valid as it is on every supported provider.

## Decision

- A credential stored through `OwnedSecrets` lives at
  `<managed namespace><owner segments><field key>`. The owner segments are code literals followed
  by the owner's ids, each id written as lowercase base32. The field key is the first 64 bits of the
  SHA-256 of the field's RFC 6901 path inside the owner, also in base32. Every segment uses only
  `[a-z0-9]`, which every provider accepts as it is.
- Each save of a field writes the same key; the provider keeps the value's history.
- A `secret:` reference into the managed namespace is kept when it lies in the owner's own
  namespace, or when the owner already holds it. References outside the managed namespace are left
  as they are.
- A delete removes only references inside the owner's namespace, and a failed delete is logged
  rather than failing the write it belongs to.
- `rekey` copies a secret from another key of the managed namespace to the owner's key and never
  deletes the source, because copies of a configuration outside the database may still point at it.
- A key longer than the provider accepts fails before anything is written.

## Consequences

A key stays the same for its owner's whole life and is read back through the reference the owner
holds. Callers of the earlier methods keep their keys until they move to `OwnedSecrets`. Revisit if
a provider's length limit leaves too little room for a configured prefix and cluster name.
