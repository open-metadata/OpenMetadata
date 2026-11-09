# A webhook secret is encrypted for the destination or profile webhook that holds it, and opens only there

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial) · v2 2026-11-06 (a value waiting to be entered again stops no edit)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `BoundCiphertextTest`, `DestinationSecretsTest#decrypted_refusesCiphertextNotWrittenForTheDestination`, `ProfileWebhookSecretsTest#deliveryLeavesOutAWebhookWhoseSecretWasNotWrittenForIt`, `StoredWebhookSecretsTest`, `DestinationValidationTest#aStoredValueThatDoesNotOpenStopsNoEdit`, `AlertLimitsTest#receiversAreCountedWhenASecretDoesNotOpen`, `WebhookRequestsTest#theSigningKeyIsUsedAsGiven`, `OAuth2TokenManagerIT#getAccessToken_sendsTheCredentialsAsGiven`, `WebhookSecretOwnershipIT`, `WebhookSecretsMigrationIT`
- **Related:** ADR:2026-10-23-alert-destination-secrets-are-encrypted-masked-and-restored, ADR:2026-10-30-owned-secret-keys-are-derived-from-owner-ids (owned vault keys, a different mechanism that shares `SecretOwner`)

## Context

Every Fernet ciphertext the server writes uses the same keys and the same `fernet:` format,
whatever it protects, so a stored value does not say which secret it is or where it belongs.
Webhook secrets are used at one place only, the destination or profile webhook that holds them,
so they can have keys of their own and open only there.

## Decision

- `BoundCiphertext` encrypts a secret for an owner (`SecretOwner`) and a field, the JSON pointer of
  the value inside the owner's configuration. Each owner and field has its own Fernet key, derived
  with HKDF-SHA256 (RFC 5869) from each configured Fernet key, so key rotation works as before. The
  value is written as `fernet:bound:<token>`, which every existing check still reads as ciphertext.
- A value opens only for the owner and field it was written for. Plain `Fernet` ciphertext does not
  open, and `Fernet.decrypt` does not open a bound value.
- The owner of an alert destination's secrets is the destination (`alertdestination` and its id).
  The owner of a profile webhook's secrets is the user or team and the webhook's slot (`user` or
  `team`, its id, `webhook`, the slot).
- `ConfigSecrets` is the only place webhook secrets are encrypted or decrypted, at the fields
  `WebhookSecrets.fieldsIn` names. A stored value that does not open is refused with a 400 that
  names the field to enter again: a test send answers 400, a real send records the destination as
  not usable with that reason, and a profile webhook whose value does not open is left out of the
  send while the profile's other webhooks still send.
  `WebhookRequests` and `OAuth2TokenManager` use the configuration they are given and decrypt
  nothing.
- The 2.1.0 data step (`WebhookSecretsMigration`) binds what is stored. Its rules are frozen in
  `StoredWebhookSecrets`, beside it: the secret fields, the channels that hold them, the owner
  shapes and the key derivation. It calls no live alerting or secrets code, only the Fernet token
  format, BouncyCastle and the configured Fernet keys, so it writes what 2.1 writes whatever later
  releases change. A row it cannot read stops the step with an error that names the row.
  - plaintext is encrypted for its owner;
  - ciphertext at the fields releases before 2.1 stored encrypted, an alert destination's bearer
    signing key and OAuth2 client id and secret, is encrypted for its owner again, unless the same
    ciphertext is stored anywhere else (`StoredCiphertextCopies`: another field or alert, any
    other table with a `json` column, or a version of an entity of those tables). Fernet
    encryption is randomized, so a value the server wrote for one field is stored at that field
    only, and in the versions of the alert that holds it. Only a frozen list of large tables that
    cannot hold a secret is left out: data assets, event and execution logs, relationships, stored
    documents and time series. A table the list does not name, such as one a distribution adds, is read, so a
    store nobody listed is never missed. Versions are found by their entity's id, through the
    primary key of the versions table, so the cost does not follow the number of data assets or
    events;
  - any other ciphertext stays as stored. It opens for no owner, so the destination stays enabled
    and reports the field to enter again, and a profile webhook is left out of the send, until the
    value is entered again.

  Versions, change descriptions and the stored change events of alerts, users and teams keep the
  mask, since nothing sends from them. Running the step again changes nothing. It runs after the 2.1.0
  destination id step, because each destination's id owns its secrets.

## Consequences

- Upgrading to 2.1.0 keeps signing keys and OAuth2 credentials working. A value the step does not
  carry over is reported on its destination, in its recent events and by a test send, as a field to
  enter again. Releases before 2.1 stored endpoints, header values and profile webhooks in plain
  text, so only a server that ran a pre-release build after
  ADR:2026-10-23-alert-destination-secrets-are-encrypted-masked-and-restored has endpoints and
  header values saved there in that time to enter again.
- A value is carried over when nothing else stored holds the same ciphertext any more: its other
  copy belonged to an entity that was hard-deleted, or was replaced, re-encrypted included, without
  a version keeping it. Such a value cannot be told apart from one the server wrote.
- Destination ids must stay unique and stable, because they own their secrets. A destination given
  a new id has its secrets entered again.
- Webhooks are the first secrets bound to their owner. The intended end state is one shared secret
  codec that binds every stored secret this way, with the owner from `SecretOwner` and the field
  from a stable field id rather than its JSON pointer; `ConfigSecrets` and the field list in
  `WebhookSecrets` then fold into it. Until then, renaming a webhook secret field needs a data step
  that binds its values again.

## Amendment (v2, 2026-11-06)

Only sending opens a stored secret. Saving an alert also reads its stored destinations, to compare
them and to count their receivers, and neither needs a secret, so a value that does not open stops
neither: an alert holding one can be edited and switched off, and the value can be entered again,
which is the only way to repair it. A destination changed while it still holds such a value is
refused with a 400 that names the field, and the same value is still never sent.
