# An encoded credential is only accepted on a user path when the entity already holds it, or it points outside the managed namespace

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** reviewers of the foreign-credential-rejection PR
- **Guard:** `DBSecretsManagerTest#testEncryptRejectsAForeignFernetToken`,
  `ExternalSecretsManagerTest#testEncryptRejectsAReferenceToAnotherEntitysSecret`,
  `PasswordEntityMaskerForeignCredentialTest` (all fail if the guards are removed);
  `SecretsManagerCredentialValidationIT` and `SecretsManagerNullSecretIT` (end-to-end over the
  service API)
- **Related:** `SecretsManager#requireOwnCredential`, `PasswordEntityMasker#requireOwnStoredValue`

## Context

The encrypt walk accepted any value a password field arrived with. A Fernet token submitted on a
user path was decrypted with the server's own key and re-stored as the submitting entity's
credential, and a `secret:` reference was stored verbatim. Either way the entity ends up owning a
value that was never handed to it as a plain credential: the stored field resolves, at use time,
whatever the token or the reference points at — a secret stored under another entity's path — and
the hard delete follows a reference under its own base while leaving a user-supplied one, so the
entity and the vault disagree about which secrets belong to it.

No legitimate round trip feeds an encoded value into the encrypt walk from a user path: the masker
restores a masked field from the stored original, and an unmask-permitted user echoes back what the
unmask handed them — the stored value's *resolved* form. Values the server itself re-stores
(secrets-manager migrations, patch restores) are copies it already holds.

## Decision

Two layers validate, and a third classifies the callers:

1. **Encrypt (`SecretsManager#requireOwnCredential`)** — on a *strict* path (user create, bulk
   create) a Fernet token is always rejected, and a `secret:` reference only when it falls inside
   the deployment's managed namespace (`buildSecretId(true)`) and outside the entity's own
   accepted bases. A reference outside the namespace points into a vault the submitter manages
   themselves — the ingestion framework resolves those at runtime and the delete walker leaves
   them alone — so it stays allowed. *Internal re-storage* paths (`CredentialPolicy` with
   `internalReStorage`) store copies the server already holds and are exempt.
2. **Unmask (`PasswordEntityMasker#requireOwnStoredValue`)** — every user update is validated
   against the original's stored value before it reaches the internal re-storage cell: an encoded
   field survives only byte-equal to the value the field already holds, as stored or as resolved.
   The unmask walk covers what the encrypt walk encrypts (`DO_NOT_UNMASK_CLASSES` mirrors the
   encrypter's skip set), so a bot's JWT token — visible through the mask — is validated too.
3. **Callers pick the policy** — `storeEntity(update=true)` and the `SecretsManagerUpdateService`
   migrations pass internal re-storage (the update cells are safe only because the masker
   validated first); creates and bulk creates stay strict.
4. **A second prepare pass in the same request is a re-storage, not a submission** — the PUT
   create-or-update path prepares the entity twice: once at the resource boundary on the user's
   submission, and once more in the create pipeline on what the first pass encrypted. The second
   pass cannot be strict — it would reject the first pass's own encrypted output as a foreign
   credential — so `EntityRepository#createPrepared` marks it (`prepare(entity, update,
   alreadyPrepared)`) and the service connection is re-stored under internal re-storage. A
   repository whose `prepare` encrypts must thread the flag; the default delegates to the
   2-argument `prepare` unchanged.

The comparison is lower-cased: `buildSecretId` lower-cases every id it builds, and Azure Key Vault
resolves names case-insensitively, so a case variant of a stored reference must not slip out of the
namespace. A rejection names the field and never echoes the submitted value — the value may be a
credential, and it does not belong in the logs.

## Consequences

An entity can no longer be given another entity's Fernet token or managed reference: the store
fails with a 400 naming the field. User-supplied references into the deployment's own namespace
are only accepted by the entity whose base they fall under — so a cross-cluster import that carries
references still resolves nothing in the target and is rejected; export with secrets visible and
re-import as plaintext still works. The test-before-save corner (a TEST_CONNECTION workflow with
no stored service behind it) accepts plaintext and external references and rejects managed ones,
since there is nothing to compare against. Collate-side re-storage call sites (query runner config,
context plugin connections) must use the new internal re-storage overloads or strict defaults will
reject their stored copies.