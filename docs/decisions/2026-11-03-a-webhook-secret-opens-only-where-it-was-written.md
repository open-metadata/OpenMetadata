# A webhook secret is encrypted for the destination or profile webhook that holds it, and opens only there

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `OwnedCiphertextTest`, `DestinationSecretsTest#decrypted_refusesCiphertextNotWrittenForTheDestination`, `DestinationSecretsTest#bindStoredAlert_carriesOverEarlierCredentialsAndLeavesAnyOtherCiphertextToEnterAgain`, `ProfileWebhookSecretsTest#deliveryLeavesOutAWebhookWhoseSecretWasNotWrittenForIt`, `ProfileWebhookSecretsTest#bindingAStoredRowEncryptsWhatWasEnteredAndCarriesNoCiphertextOver`, `WebhookRequestsTest#theSigningKeyIsUsedAsGiven`, `OAuth2TokenManagerIT#getAccessToken_sendsTheCredentialsAsGiven`, `WebhookSecretOwnershipIT`, `WebhookSecretsMigrationIT`
- **Related:** ADR:2026-10-23-alert-destination-secrets-are-encrypted-masked-and-restored, ADR:2026-10-30-owned-secret-keys-are-derived-from-owner-ids

## Context

Every Fernet ciphertext the server writes uses the same keys and the same `fernet:` format,
whatever it protects, so a stored value does not say which secret it is or where it belongs.
Webhook secrets are used at one place only, the destination or profile webhook that holds them,
so they can have keys of their own and open only there.

## Decision

- `OwnedCiphertext` encrypts a secret for an owner (`SecretOwner`) and a field, the JSON pointer of
  the value inside the owner's configuration. Each owner and field has its own Fernet key, derived
  with HKDF-SHA256 (RFC 5869) from each configured Fernet key, so key rotation works as before. The
  value is written as `fernet:owned:<token>`, which every existing check still reads as ciphertext.
- A value opens only for the owner and field it was written for. Plain `Fernet` ciphertext does not
  open, and `Fernet.decrypt` does not open an owned value.
- The owner of an alert destination's secrets is the destination (`alertdestination` and its id).
  The owner of a profile webhook's secrets is the user or team and the webhook's slot (`user` or
  `team`, its id, `webhook`, the slot).
- `ConfigSecrets` is the only place webhook secrets are encrypted or decrypted, at the fields
  `WebhookSecrets.fieldsIn` names. A stored value that does not open is refused with a 400 that
  names the field to enter again: a test send answers 400, a real send records the destination as
  not usable with that reason, and a profile webhook is left out of the send.
  `WebhookRequests` and `OAuth2TokenManager` use the configuration they are given and decrypt
  nothing.
- The 2.1.0 data step (`WebhookSecretsMigration`) binds what is stored:
  - plaintext is encrypted for its owner;
  - ciphertext at the fields releases before 2.1 stored encrypted, an alert destination's bearer
    signing key and OAuth2 client id and secret, is encrypted for its owner again, unless the same
    ciphertext is stored anywhere else (`StoredCiphertextCopies`: another field or alert, or any
    other row of any table with a `json` column). Fernet encryption is randomized, so a value the
    server wrote for one field is stored at that field only, and in the history of the alert that
    holds it: its versions, its change descriptions and the change events recorded for it;
  - any other ciphertext stays as stored. It opens for no owner, so the destination stays enabled
    and reports the field to enter again, and a profile webhook is left out of the send, until the
    value is entered again.

  Versions, change descriptions and the stored change events of users and teams keep the mask,
  since nothing sends from them. Running the step again changes nothing. It runs after the 2.1.0
  destination id step, because each destination's id owns its secrets.

## Consequences

- Upgrading to 2.1.0 keeps signing keys and OAuth2 credentials working. A value the step does not
  carry over is reported on its destination, in its recent events and by a test send, as a field to
  enter again. Releases before 2.1 stored endpoints, header values and profile webhooks in plain
  text, so only a server that ran a pre-release build after
  ADR:2026-10-23-alert-destination-secrets-are-encrypted-masked-and-restored has endpoints and
  header values saved there in that time to enter again.
- Destination ids must stay unique and stable, because they own their secrets. A destination given
  a new id has its secrets entered again.
- Other Fernet stores (service connections, bots, settings) can adopt `OwnedCiphertext` with an
  owner of their own and a data step of their own.
