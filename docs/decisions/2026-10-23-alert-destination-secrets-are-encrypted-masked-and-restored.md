# An alert destination's endpoint, header values and credentials are encrypted at rest, masked in every response, and restored from the stored alert when the mask is sent back

- **Status:** Accepted
- **Revisions:** v1 2026-10-23 (initial); v2 2026-10-26 (bind stored OAuth2 test credentials to their token URL); v3 2026-10-27 (a stored secret does not follow a moved target; a destination keeps its served channel)
- **Deciders:** Teddy Crepineau
- **Guard:** `DestinationSecretsTest`, `DestinationSecretGuardsTest`, `EventSubscriptionResourceIT#test_destinationSecretsAreMaskedEncryptedAndRestored`
- **Related:** ADR:2026-10-20-mcp-responses-mask-stored-credentials

## Context

A webhook destination's configuration is read by anyone who may view the alert. The bearer and
OAuth2 credentials were stored encrypted, but an incoming-webhook URL (Slack, Teams, Google Chat
and many generic webhooks) is itself the credential, and a custom header is where an
`Authorization` or API-key value goes. Both were stored and returned as written. The governance
workflow sinks already follow a complete model (`WorkflowDefinitionMasker`, `WorkflowSinkSecrets`):
encrypt before the store, mask on every read, restore the stored value when a caller sends the
mask back, decrypt only at the point of use.

## Decision

- A channel names its secrets in one place, `ConfigRules.secretFields`. For every webhook-family
  channel (`SecretWebhookConfigRules`) that is the `endpoint`, every value under `headers`, and
  `authType.secretKey`, `authType.clientId`, `authType.clientSecret`. `queryParams` and a
  destination's `receivers` are not secrets.
- `DestinationSecrets` encrypts those fields before an alert is stored (create and every update
  path, before the diff, so the change description holds ciphertext too), decrypts them only where
  a configuration is read to send (`WebhookConfigRules.stored` / `submitted`), and masks them with
  `PasswordEntityMasker.PASSWORD_MASK` in every response of `EventSubscriptionResource` and of the
  MCP tools — for every caller, bots included — including version history and change descriptions.
- A request that sends the mask back keeps the stored value: by destination id, or, for a PUT that
  carries no ids, by position when type and channel match. A plaintext secret equal to what the
  stored ciphertext decrypts to keeps the stored ciphertext, so re-sending a configuration changes
  nothing. A mask with no stored value, ciphertext that is not the stored value, and a PATCH `copy`
  or `move` of a stored secret into another field are refused with 400.
- A test send of a destination that carries masks uses the stored secrets, only for a caller
  allowed to edit the alert that holds them, and only when every secret and the OAuth2 token URL
  are the stored ones; a destination whose credentials or token URL changed is tested once all
  credentials are entered.
- A stored secret is restored from the mask only while the destination still sends where it is
  stored: its `endpoint` and, for OAuth2 credentials, `tokenUrl`. A request (v3:2026-10-27) that
  moves either, and keeps any stored or masked value at another secret field, is refused with 400
  and asked to enter every credential again — a caller who only ever read the mask may not choose
  where someone else's credentials are delivered. Re-entering every secret, the stored values
  included, moves the destination as it reads them fresh.
- A destination an update keeps by its id serves through the channel it is stored under; the
  update that names another channel is refused, since the channel's rules would no longer name
  the secrets its configuration carries. A replacement destination carries a new id and chooses
  its channel when it is added.
- Changed destinations are compared with their secrets decrypted, so a stored destination an
  earlier release accepted is still not re-validated when the alert is otherwise edited; a
  destination the users do not configure (`Owners`, `Teams`, …) is judged from its configuration
  as it would be sent, decrypted, so an update of one stays editable while its endpoint sits
  encrypted at rest.

## Consequences

- The alert form and the SDK round-trip an alert unchanged: unchanged fields come back as the
  mask and are restored. The form shows the mask where it showed the URL or header value, and a
  save that changes one or more destinations sends that list in one whole-list move, so an edit
  or removal of one destination is never mis-paired with its neighbour.
- Moving a destination's endpoint or token URL asks for every credential again; keeping a
  destination otherwise edits it as the masks round-trip.
- A client that re-creates an alert from a read copy must supply the real values; that is the
  same contract as a service connection.
- Rows stored before this change keep plaintext until their alert is next saved; reads are masked
  either way. A migration encrypting existing rows is a separate change.
- A new channel with secrets implements `secretFields` and gets storage, masking and restoring
  without touching the resource or repository.
