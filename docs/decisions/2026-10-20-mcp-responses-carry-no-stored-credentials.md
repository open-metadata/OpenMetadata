# MCP responses carry no stored credentials for any caller, and patch_entity does not reach a service's connection

- **Status:** Accepted
- **Revisions:** v1 2026-10-20 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `McpResponseUtilsTest`, `PatchEntityToolTest#execute_rejectsPatchesThatReachAServiceConnection`
- **Related:** #34566

## Context

MCP tools read entities by a runtime entity type with `fields="*"`, so they skip the masking each
REST resource applies (`ServiceEntityResource`, `IngestionPipelineSecrets`, `UserResource`,
`WorkflowResource`). `get_entity` returned the stored secrets: encrypted values or secrets-manager
references, a bot's token, and a basic-auth user's password hash. REST itself hands a bot caller
the decrypted values.

## Decision

- Every MCP entity response and change event goes through `McpResponseUtils.maskSecrets`. It masks
  with `PasswordEntityMasker` for every caller, bots included: a service's connection config, an
  ingestion pipeline's source config, an automations workflow's request and a workflow
  definition's sink credentials. A user's `authenticationMechanism` is dropped.
- Masking runs on the stored value without decrypting it first, and on a copy of the entity.
- `get_entity` hides a user's email from callers without PII access, as `UserResource` does.
- `patch_entity` refuses an operation whose `path` or `from` is a service's `/connection`,
  anything under it, or the document root.

## Consequences

- An agent still reads a service's host, account and username, never a password, token or hash.
- An agent cannot change a service's connection through MCP, `hostPort` included; that goes
  through the service's REST API. This is stricter than REST PATCH on purpose: the repository
  restores the stored password over a masked value, so a new host would receive it on the next
  connection test, and `copy`, `move` and `test` read the stored value.
- A new entity type that stores credentials needs its own branch in `maskSecrets`.
