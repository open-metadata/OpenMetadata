# A save keeps an encrypted secret only where it is the value already stored for that field

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `StoredEncryptedSecretsTest`, `DatabaseServiceResourceIT#serviceAcceptsAnEncryptedPasswordOnlyAsItsOwnStoredValue`, `IngestionPipelineResourceIT#pipelineAcceptsAnEncryptedSecretOnlyAsItsOwnStoredValue`, `WorkflowResourceIT#testConnectionAcceptsAnEncryptedPasswordOnlyAsItsServicesStoredValue`
- **Related:** ADR:2026-10-23-alert-destination-secrets-are-encrypted-masked-and-restored; ADR:2026-10-24-a-masked-connection-secret-is-kept-only-while-the-endpoint-is-unchanged

## Context

Only the server encrypts secrets, and no response is meant to carry an encrypted value: a person
reads a secret masked, a bot reads it decrypted. Alert destinations and workflow definition sinks already
accept an encrypted value only as the value stored at the same field. This record applies the
same rule to service connections, ingestion pipelines and automations workflows, so every write
that can carry a connection secret follows it.

## Decision

- A save of a service connection, an ingestion pipeline or an automations workflow keeps a
  `fernet:` value in a secret field only when it is exactly the value stored for that same field
  of that same entity. Any other encrypted value is refused with a 400 that asks for the secret
  itself.
- A create has nothing stored, so it refuses every encrypted value. A test connection workflow
  compares against the stored workflow, with the connection of the service its request names when
  that service has one.
- The mask and a typed secret are accepted as before.
- The check runs where the server restores stored secrets into a write (`PasswordEntityMasker`'s
  unmask methods, used by PUT and PATCH) and, for creates, in the resources
  (`EntityMasker#requireNoEncryptedSecrets`). Server code that copies a stored value itself does not
  go through these paths.
- The server's own connection on a pipeline (`openMetadataServerConnection`) is not checked: the
  server builds it for every run and never stores the one it is sent.

## Consequences

- A stored secret can be used only by the entity and field it was saved for, without the server
  having to decrypt what a client sends.
- A client that sends back an encrypted value it obtained elsewhere gets a 400 and must send the
  secret itself.
- Revisit when secrets move into a codec or store that binds each value to its owner; the check
  then becomes a readable early error rather than the guarantee.
