# Webhook secrets are encrypted with the server's Fernet keys, as every other stored secret is

- **Status:** Accepted
- **Revisions:** v1 2026-11-14 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `DestinationSecretsTest`, `ProfileWebhookSecretsTest`, `DestinationValidationTest`, `StoredWebhookSecretsTest`, `IngestionPipelineMigrationEntryPointTest`, `WebhookSecretsMigrationIT` (`#aStepThatStopsPartWayLeavesNothingBehind` among them), `WebhookSecretsIT`, `ProfileWebhookSecretsIT`
- **Related:** supersedes ADR:2026-11-03-a-webhook-secret-opens-only-where-it-was-written; ADR:2026-10-23-alert-destination-secrets-are-encrypted-masked-and-restored

## Context

ADR:2026-11-03-a-webhook-secret-opens-only-where-it-was-written encrypted each webhook secret with
a key derived from the alert destination or profile webhook holding it. No other stored secret
works that way. It made a destination's id part of its secrets, and it needed a 2.1.0 data step
that encrypted every stored alert credential again with the keys configured during the upgrade,
once, so a wrong key at that moment left those credentials unusable even after the key was fixed.

Since ADR:2026-10-23-alert-destination-secrets-are-encrypted-masked-and-restored, no response
carries a webhook secret, encrypted or not, and a save refuses an encrypted value that is not the
one already stored at that field. From 2.1 on, a stored secret therefore reaches a webhook's
configuration only through the server. Releases before 2.1 encrypted and decrypted only the bearer
signing key and the OAuth2 client id and secret; they stored and sent every other field, the
endpoint and header values included, as it was written.

## Decision

- The secrets of alert destinations and of user and team profile webhooks are encrypted with the
  server's Fernet keys, in the `fernet:` format every other stored secret uses. `ConfigSecrets`
  stays the only place that encrypts and decrypts them; `WebhookRequests` and `OAuth2TokenManager`
  use the configuration they are given and decrypt nothing.
- Masking, a mask standing for the stored value, and refusing an encrypted value that is not the
  stored one stay as ADR:2026-10-23-alert-destination-secrets-are-encrypted-masked-and-restored
  decides. They are what keep a stored secret where it was written.
- A value no configured key decrypts, one in the `fernet:bound:` format a 2.1 pre-release wrote
  included, is refused with a 400 that names the field to enter again. It stops no edit, and a
  profile webhook holding one is left out of the send while the profile's other webhooks still
  send.
- The 2.1.0 data steps `encryptAlertDestinationSecrets` and `encryptProfileWebhookSecrets`, whose
  rules are frozen in `StoredWebhookSecrets`:
  - keep Fernet ciphertext as stored at the fields releases before 2.1 encrypted;
  - encrypt every other value as it is stored, whatever it reads as, so a webhook is sent what
    those releases sent it;
  - encrypt again with the configured keys a value a 2.1 pre-release bound to its holder, when it
    opens for that holder; one that does not open stays as stored;
  - leave versions, change descriptions and stored change events with the mask.
- Encrypting again what a step wrote would change it, so each step runs once: in one transaction
  with the marker that records it, so a run that stops part way leaves nothing behind and the next
  run starts from what was stored.
- The steps carry names the pre-release did not record, so a database that ran its `bind*` steps
  runs them too. They run after the destination id step, because a bound value opens only for its
  destination's id.
- The upgrade does not check the Fernet keys first: no step depends on decrypting what is stored,
  except a pre-release value, which stays as stored when it does not open.

## Consequences

- An upgrade from 2.0 keeps every credential 2.0 stored encrypted as it was; nothing has to be
  entered again. Those credentials do not depend on the key configured during the upgrade: with a
  wrong one they fail with a reason until the right key is configured, then send again. A value the
  upgrade encrypts with a wrong key is entered again, as for any other secret the server encrypts.
- A destination's id carries no secret, so assigning or changing ids touches no stored value.
- A database that ran a 2.1 pre-release with a different key than the one it upgrades with keeps
  those values as stored, to be entered again.
- Each step's transaction holds every row it rewrites until it ends.
- Revisit if a response or a save could again carry a webhook secret's ciphertext: the guarantee
  rests on ADR:2026-10-23-alert-destination-secrets-are-encrypted-masked-and-restored.
