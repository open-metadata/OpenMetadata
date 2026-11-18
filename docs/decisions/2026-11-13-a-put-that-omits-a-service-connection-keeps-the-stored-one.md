# A PUT that omits a service connection keeps the stored one

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `DatabaseServiceResourceIT#put_updateWithoutConnection_preservesExistingConnection_200`,
  `SecretsManagerNullSecretIT#aPutWithoutAConnectionKeepsTheStoredConnectionAndItsSecrets`,
  `SecretsManagerNullSecretIT#aHeldPutWithoutAConnectionStagesNoConnectionChange`
- **Related:** #29494, #32920,
  ADR:2026-10-26-service-connection-visibility-follows-edit-permission,
  ADR:2026-10-24-a-masked-connection-secret-is-kept-only-while-the-endpoint-is-unchanged,
  ADR:2026-10-29-service-connection-secrets-are-written-only-during-storage

## Context

Until #32920, a PUT on an existing service with no `connection` failed: `ServiceEntityResource.unmask`
threw a NullPointerException, returned as a 400, and nothing was written. #32920 removed the NPE and
stated that the stored connection is preserved, but `ServiceEntityRepository.updateConnection`
skipped a null connection and the update stored the service with none. A PUT without `connection`
therefore succeeded and removed the service's connection: on the database secrets manager its
encrypted credentials are gone from the row; on an external manager the row loses its references, so
the vault entries are left unreferenced and the service cannot connect until someone re-enters them.

Clients send that PUT in ordinary operation. Ingestion with `storeServiceConnection: false` and
`forceEntityOverwriting: true` PUTs the service without a connection on every run. SDK users upsert
a service by name, as the #29494 reporter did. The flag's schema scopes it to what ingestion stores
"when creating a service"; it is not a request to delete credentials an admin stored.

## Decision

- A PUT that omits `connection` keeps the stored connection, as it already keeps `serviceAttributes`.
  Clearing a connection takes an explicit PATCH, as the review bar requires for every field: an
  omitted PUT field keeps the stored value; an explicit `null` in a PATCH clears it.
- The approval gate treats both fields as kept by a PUT (`getFieldsKeptByPut`), so a PUT held for
  approval never stages `connection: null` and approving it cannot clear the connection.
- The kept value is the stored one: Fernet ciphertext or vault references. Storage re-wraps it
  without a vault write, as for any write that leaves the connection unchanged, and no connection
  change is recorded.

## Why this is safe

- Updating a service by PUT requires `EDIT_ALL` (`EntityUtil.createOrUpdateOperation`). Callers
  without it receive `connection: null` on reads, and that null means "not visible", never
  "cleared" (ADR:2026-10-26-service-connection-visibility-follows-edit-permission).
- Omitting the connection cannot retarget a stored secret: the endpoint fields live in the
  connection, so the stored secret stays bound to the stored endpoint
  (ADR:2026-10-24-a-masked-connection-secret-is-kept-only-while-the-endpoint-is-unchanged).
- Responses still pass through `decryptOrNullify`, so a PUT response masks or withholds the kept
  connection exactly as a GET does.

## Consequences

- An integration that relied on a PUT without `connection` to remove stored credentials must send a
  PATCH that removes `/connection`.
- #32920 shipped in 2.1.0-rc2, so this fix belongs in 2.1 as well.
