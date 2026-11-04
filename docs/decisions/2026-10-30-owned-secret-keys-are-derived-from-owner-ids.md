# An owned credential's secret key is derived from its owner's id

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial); v2 2026-11-04 (references compared by resolved name)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `OwnedSecretsTest`, `AzureKVSecretsManagerTest`, `AWSSecretsManagerTest`
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
- A field keeps one key for its whole life, and each save writes to it; the provider keeps the
  value's history. The key a field holds is found among the references the caller keeps for the
  owner: the one that starts with the field's key and that no other field of the value refers to.
- A field that holds no key yet gets its own field key, unless that key is not free. A key is not
  free when another field of the value still refers to it (a list element keyed by its position
  can take a removed element's place), or when the provider keeps the name for a secret deleted
  earlier (Azure Key Vault soft delete refuses it with a 409). Then the field gets a fresh key: its
  field key followed by a random suffix of the same length, which later saves keep updating. A
  deleted secret is never recovered: a credential an owner cleared stays deleted, with its history,
  until the provider purges it.
- A `secret:` reference into the managed namespace is kept when it lies in the owner's own
  namespace, or when the owner already holds it. References outside the managed namespace are left
  as they are.
- A delete removes only references inside the owner's namespace, and a failed delete is logged
  rather than failing the write it belongs to.
- References are compared by the name the provider resolves them to, never as text: Azure Key
  Vault names are case-insensitive, and AWS reads a secret by its ARN as well as its name, with or
  without the ARN's random suffix. `retire` deletes what a write stopped referring to by that
  comparison, so a secret the write still reads under another spelling stays, and `resolvedName`
  gives callers the same comparison.
- `rekey` copies a secret from another key of the managed namespace to the owner's key and never
  deletes the source, because copies of a configuration outside the database may still point at it.
  It copies whatever value the reference holds and does not check who wrote it, so a caller passes
  only references it knows belong to the owner. When that is uncertain, a credential that works on
  its own, such as an access token, is dropped rather than rekeyed, and its owner signs in again.
- A key longer than the provider accepts, counting the fresh suffix, fails before anything is
  written.

## Consequences

A key stays the same for its owner's whole life and is read back through the reference the owner
holds. Callers of the earlier methods keep their keys until they move to `OwnedSecrets`. Revisit if
a provider's length limit leaves too little room for a configured prefix and cluster name.
