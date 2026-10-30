# An owned credential's secret key is derived from its owner's id, never from a name

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `OwnedSecretsTest`
- **Related:** `SecretOwner`, `OwnedSecrets`

## Context

An external secrets manager stores each credential under a key, and the row that uses it keeps a
`secret:` reference to that key. A key built from a name changes when the name changes, can be taken
by another entity that later uses the same name, and passes through each provider's character rules
(lowercasing, replacing or stripping characters, truncating). A key has to identify exactly one
credential for as long as its owner exists, on every provider.

## Decision

- A credential stored through `OwnedSecrets` lives at
  `<managed namespace><owner segments><field key>`. The owner segments are code literals followed
  by the owner's ids, each id written as lowercase base32. The field key is the first 64 bits of the
  SHA-256 of the field's RFC 6901 path inside the owner, also in base32. Nothing a user chooses goes
  into a key, and every segment uses only `[a-z0-9]`, which no provider separator or replacement
  touches.
- Each save of a field writes the same key; the provider keeps the value's history.
- A `secret:` reference into the managed namespace is accepted only inside the owner's own
  namespace, or when the owner already holds it. References outside the managed namespace are left
  as they are.
- A delete removes only references inside the owner's namespace, and a failed delete is logged
  rather than failing the write it belongs to.
- `rekey` copies a secret from an older key to the owner's key and never deletes the older one,
  because copies of a configuration outside the database may still point at it.
- A key longer than the provider accepts fails before anything is written.

## Consequences

Renaming an owner never moves its secrets, and two owners can never share a key. Keys no longer
read as names: a key is mapped to its owner through the reference the owner holds. Callers of the
name-based methods keep their keys until they move to `OwnedSecrets`. Revisit if a provider's length
limit leaves too little room for a configured prefix and cluster name.
