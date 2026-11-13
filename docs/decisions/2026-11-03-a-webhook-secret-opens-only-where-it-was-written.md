# A webhook secret is encrypted for the destination or profile webhook that holds it, and opens only there

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial) · v2 2026-11-06 (a value waiting to be entered again stops no edit) · v3 2026-11-13 (every copy of an earlier credential is carried over; the step stops when the configured keys open none; a value that cannot be used is reported when read)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `BoundCiphertextTest`, `DestinationSecretsTest#decrypted_refusesCiphertextNotWrittenForTheDestination`, `ProfileWebhookSecretsTest#deliveryLeavesOutAWebhookWhoseSecretWasNotWrittenForIt`, `StoredWebhookSecretsTest`, `DestinationValidationTest#aStoredValueThatDoesNotOpenStopsNoEdit`, `AlertLimitsTest#receiversAreCountedWhenASecretDoesNotOpen`, `WebhookRequestsTest#theSigningKeyIsUsedAsGiven`, `OAuth2TokenManagerIT#getAccessToken_sendsTheCredentialsAsGiven`, `WebhookSecretOwnershipIT`, `WebhookSecretsMigrationIT`, `WebhookSecretsMigrationTest`, `IngestionPipelineMigrationEntryPointTest`, `AlertDiagnosticsStatusTest`, `ProfileWebhookSecretsIT#aProfileWebhookThatCannotSendIsReportedWhenReadAndNeverStored`, `ProfileWebhookSecretsTest#aReadReportsEachWebhookThatDoesNotSendAndAWriteNeverStoresIt`
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
    signing key and OAuth2 client id and secret, is encrypted for its owner again. (v3:2026-11-13)
    A credential stored there is carried over to that destination wherever else the same value
    is stored; from 2.1 on, a value opens only where it was written;
  - any other ciphertext stays as stored. It opens for no owner, so the destination stays enabled
    and reports the field to enter again, and a profile webhook is left out of the send, until the
    value is entered again.
  - (v3:2026-11-13) when such credentials are stored and none of them decrypts with the configured
    Fernet keys, the step stops before it writes anything (see Amendment v3).

  Versions, change descriptions and the stored change events of alerts, users and teams keep the
  mask, since nothing sends from them. Running the step again changes nothing. It runs after the 2.1.0
  destination id step, because each destination's id owns its secrets, and (v3:2026-11-13) the alert
  step runs before the profile step, so a stop leaves every webhook secret as it was.

## Consequences

- Upgrading to 2.1.0 keeps signing keys and OAuth2 credentials working. A value the step does not
  carry over is reported on its destination, in its recent events and by a test send, as a field to
  enter again. Releases before 2.1 stored endpoints, header values and profile webhooks in plain
  text, so only a server that ran a pre-release build after
  ADR:2026-10-23-alert-destination-secrets-are-encrypted-masked-and-restored has endpoints and
  header values saved there in that time to enter again.
- (v3:2026-11-13) A credential stored encrypted before 2.1 at an alert destination's credential
  fields keeps working after the upgrade, for that destination. An upgrade run with Fernet keys
  that open none of them stops and is run again with the right keys, or with the operator's
  choice to keep them as stored (see Amendment v3).
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

## Amendment (v3, 2026-11-13)

Credentials stored before 2.1 keep working after the upgrade, an upgrade run with the wrong Fernet
keys stops instead of leaving them unusable, and a value that cannot be used is shown where the user
looks, not only in the recent events of a send.

- A credential stored encrypted before 2.1 at an alert destination's credential fields (the
  bearer signing key, the OAuth2 client id and secret) is carried over to that destination,
  wherever else the same value is stored. From 2.1 on, a value opens only where it was written: a
  save accepts an encrypted value only where it is the value the same destination already stores
  at that field.
- Nothing opens a value in the format of releases before 2.1 (`fernet:`, not `fernet:bound:`) at
  send time; only the data step reads it. So the step checks the keys first: it rewrites the alert
  rows in memory, and when those credentials are stored and not one of them decrypts with any of
  the configured Fernet keys, it stops the upgrade before anything is written and records no
  marker, so `migrate` runs it again. The error names the alerts holding them and asks for the key
  the previous release used (a comma-separated list of keys is accepted). Values that could not be
  used before the upgrade either can be entered again or removed before upgrading, or the operator
  sets `MIGRATION_KEEP_UNREADABLE_WEBHOOK_CREDENTIALS=true`: the step then goes on, those values
  stay as stored, and their alerts show them as values to enter again. The default is to stop. When
  some open and some do not, the step goes on and the others stay as stored; when there are none,
  it goes on and binds what is stored with the configured keys, as any 2.1 save would. The alert
  step runs before the profile step, so a stop leaves every webhook secret as it was.
- A destination whose stored secrets do not open for it reads as `failed`, with
  `configurationUnusable` set and the field to enter again in `lastFailedReason`, whenever the
  alert is read with `fields=statusDetails`, one alert or a list, before any event reaches it. The
  read only decrypts, the way a send does, and reads the health of every listed alert in one
  query, so it builds no publisher and resolves no address. A failed send keeps reading as
  `failed` with its reason and without `configurationUnusable`, so only a stored configuration is
  shown as one to change. A user or team read by id or name, and a team's write responses, report
  each profile webhook that would be left out of a send in the profile's read-only
  `subscriptionStatus`, the same way. Both are computed when read: neither is stored, a value sent
  back is dropped on write, and the schema keeps the profile status out of change events.
