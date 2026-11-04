# A webhook secret is encrypted for the destination or profile webhook that holds it, and opens only there

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `OwnedCiphertextTest`, `DestinationSecretsTest#decrypted_refusesCiphertextNotWrittenForTheDestination`, `DestinationSecretsTest#bindStoredAlert_bindsWhatWasEnteredAndRemovesWhatCannotBeShownToBeItsOwn`, `ProfileWebhookSecretsTest#deliveryRefusesASecretNotWrittenForItsWebhook`, `ProfileWebhookSecretsTest#bindingAStoredRowKeepsWhatIsItsOwnAndRemovesTheRest`, `WebhookRequestsTest#theSigningKeyIsUsedAsGiven`, `OAuth2TokenManagerIT#getAccessToken_sendsTheCredentialsAsGiven`, `WebhookSecretOwnershipIT`, `WebhookSecretsMigrationIT`
- **Related:** ADR:2026-10-23-alert-destination-secrets-are-encrypted-masked-and-restored, ADR:2026-10-30-owned-secret-keys-are-derived-from-owner-ids

## Context

Every Fernet ciphertext the server writes uses the same keys and the same `fernet:` format,
whatever it protects. Delivery decrypted any `fernet:` value found in a webhook's secret fields,
and the webhook request code decrypted the signing key and the OAuth2 credentials a second time.
Since ADR:2026-10-23-alert-destination-secrets-are-encrypted-masked-and-restored a request may only
send back the ciphertext already stored for the same field, but a row stored by an earlier release
may hold any ciphertext, and nothing in the value says what it was written for. A value the server
encrypted for anything else could therefore be decrypted for a webhook.

## Decision

- `OwnedCiphertext` encrypts a secret for an owner (`SecretOwner`) and a field, the JSON pointer of
  the value inside the owner's configuration. Each owner and field has its own Fernet key, derived
  with HKDF-SHA256 (RFC 5869) from each configured Fernet key, so key rotation works as before. The
  value is written as `fernet:owned:<token>`, which every existing check still reads as ciphertext.
- A value opens only for the owner and field it was written for. Ciphertext from anywhere else, plain
  `Fernet` ciphertext included, does not open, and `Fernet.decrypt` does not open an owned value.
- The owner of an alert destination's secrets is the destination (`alertdestination` and its id).
  The owner of a profile webhook's secrets is the user or team and the webhook's slot (`user` or
  `team`, its id, `webhook`, the slot).
- `ConfigSecrets` is the only place webhook secrets are encrypted or decrypted, at the fields
  `WebhookSecrets.fieldsIn` names. A stored value that does not open is refused with a 400, so a
  test send answers 400, a real send records the destination as not usable, and a profile webhook
  is left out of the send. `WebhookRequests` and `OAuth2TokenManager` use the configuration they
  are given and decrypt nothing.
- The 2.1.0 data step (`WebhookSecretsMigration`) binds what is stored: plaintext is encrypted for
  its owner; ciphertext is kept only in the signing key (`authType.secretKey`), which only ever
  keys an HMAC and is never sent, where it is encrypted for its owner again; any other ciphertext is
  removed, and its destination is disabled, or its profile webhook removed, until the values are
  entered again. Versions, change descriptions and the stored change events of users and teams keep
  the mask, since nothing sends from them. Running the step again changes nothing. It runs after
  the 2.1.0 destination id step, because each destination's id owns its secrets.

## Consequences

- A value copied into a webhook from anywhere else is never sent, whatever path stored it.
- Upgrading to 2.1.0 removes an OAuth2 client id and secret, a header value or an endpoint that a
  release before it stored as ciphertext; administrators enter them again and enable the
  destination. A signing key keeps working. A server that ran a pre-release build after
  ADR:2026-10-23-alert-destination-secrets-are-encrypted-masked-and-restored also gets back
  endpoints and header values saved there in that time to enter again.
- Destination ids must stay unique and stable, because they own their secrets. A destination given
  a new id has its secrets entered again.
- Other Fernet stores (service connections, bots, settings) can adopt `OwnedCiphertext` with an
  owner of their own and a data step of their own.
