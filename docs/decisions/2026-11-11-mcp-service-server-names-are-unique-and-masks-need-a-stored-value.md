# MCP service server names are unique, and a masked value is kept only where a stored value exists

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial); v2 2026-11-14 (checked on any server change, order included); v3 2026-11-19 (secret ids of list elements stay distinct once cleaned); v4 2026-11-23 (allocate a fresh id when another element still references a list element's default id); v5 2026-11-27 (stage replacements for committed fresh ids and retire them after commit); v6 2026-11-27 (retain references shared between configurations)
- **Deciders:** backend
- **Guard:** `PasswordEntityMaskerTest.testMaskedSecretWithNoStoredValueIsRejected`, `PasswordEntityMaskerTest.testNamesSharingASecretIdKeepTheirOwnKeysWhenReordered`; `ReflectionUtilCollectionKeysTest`, `SecretMapEntriesExternalStoreTest.reorderingServersThatShareACleanedNameThenReplacingOneKeyKeepsTheOther`, `SecretMapEntriesExternalStoreTest.renamingAServerThenReusingItsOldNameInALaterSaveKeepsBothKeys`, `ListSecretReferenceAllocationTest`, `SecretsManagerNullSecretIT.renamedMcpServerKeepsItsApiKeyWhenOldNameIsReusedAndSwapped`, `SecretsManagerNullSecretIT.replacingACommittedFreshReferenceStagesItsValueUntilCommit`, `SecretsManagerNullSecretIT.clearingARenamedFreshReferenceRetainsItUntilItsLastAliasCommits`, `SecretsManagerNullSecretIT.anotherServiceCanResolveTheCredentialAfterItsOwnerChanges`, `SecretsManagerNullSecretIT.anExistingPipelineReferenceProtectsADeletedServicesCredential`, `SecretsManagerNullSecretIT.aStoredTestConnectionWorkflowKeepsItsCredentialUntilHardDeletion`; `McpServiceResourceIT.post_mcpServiceWithDuplicateServerNames_400`, `McpServiceResourceIT.put_renamedServerWithMaskedApiKey_400_keepsStoredKey`, `McpServiceResourceIT.put_reorderedStoredServersWithSameName_400_otherEditsStillSave`
- **Related:** open-metadata/openmetadata-collate#7962, ADR:2026-10-24-a-masked-connection-secret-is-kept-only-while-the-endpoint-is-unchanged

## Context

A list element's stored settings are matched back to it by its `name` when that name occurs once
in the list, and by position otherwise. An MCP service's `servers[].name` is required but was not
unique, so two entries with the same name could only be matched by position. And on update, a
masked value is replaced with the stored value under the same key; when no stored value exists
there (e.g. the element was renamed), the placeholder itself was kept.

## Decision

- Creating an MCP service whose `servers` repeat a `name`, or updating one so that its `servers`
  change in anything but their keys (order included) and repeat a name, is refused with 400. An
  update that leaves `servers` as stored, apart from their keys, is not checked.
- On a service connection update, a field that arrives masked but has no stored value under the
  same key is refused with 400, asking for the actual value.

## Consequences

A full-body update (PUT) that renames an MCP server sends that server's settings again in the same
request; a PATCH that changes only the name keeps them. Existing services with repeated server
names, saved before this rule, stay editable outside `servers`; reordering or editing their
servers asks for unique names first, since repeated names could only be matched by position. The
masked-value rule applies to every service connection, where a masked value can only come from a
stored one.

## Amendment (v3, 2026-11-19)

Matching a masked value back to its stored one and naming an element inside a secrets manager's
secret id are now two keys (`ReflectionUtil.getCollectionElementIdentities` and
`getCollectionElementKeys`).

- **Matching a masked value:** unchanged. An element is matched by its exact `name` when it occurs
  once in the list, and by position (`#<index>`) otherwise. A name starting with `#` gets one more
  `#`, so it never equals a position key.
- **Secret id:** an element with a unique exact `name` is named by that name when it, lowercased
  and reduced to ASCII letters and digits, contains a letter, is still unique and does not itself look like a hashed id; otherwise by `h`
  and the first 16 hex characters of the SHA-256 of the exact name. Secrets managers lowercase an id
  and drop or replace other characters, so `Prod` and `prod`, or `prod-1` and `prod_1`, would
  otherwise share one stored secret. Only unnamed elements and exact duplicates are named by
  `#<index>`.

A secret id must not move with the element's position: a new or cleared value is written to, or
deleted from, the id computed for the element on that save. With position ids, swapping two servers
and then editing one key overwrote, or deleted, the secret the other server still referenced.
Server names are still only refused when they repeat exactly: `Prod` and `prod` are accepted, keep
their own keys through a reorder, and get distinct, stable secret ids.

## Amendment (v4, 2026-11-23)

Renaming a list element (or deleting a position-keyed element so a later element shifts down) keeps
the element's existing `secret:` reference pointing at its old id. Writing a new secret under that
old name or position previously overwrote (or, when cleared, deleted) the secret the renamed or
shifted element still referenced.

- **Reference-based allocation:** before writing or clearing a password field inside a collection
  element on an external secrets manager, `SecretsManager` collects every `secret:` reference from
  both the locked stored config (passed by `ServiceEntityRepository` / `IngestionPipelineRepository`)
  and the incoming config — never probing the vault. References are compared by the provider's
  `canonicalSecretName`.
- **Overwrite vs. fresh id:** a new value writes to the element's default id or reuses a fresh id
  already held by that exact slot and recorded in the ownership ledger. Either id can be used
  only when no other slot in the stored or incoming config references it. Otherwise, or if the
  provider refuses a soft-deleted name (such as Azure Key Vault 409), it tries up to eight fresh id
  candidates. The standard form is `<defaultId><sep><13-char base32 suffix>`. If that exceeds the
  provider limit, use `<root><sep>f<first 16 hex digits of SHA-256(canonical default id)><sep><suffix>`.
  Both formats are recognized when reusing owned ids.
- **Clearing:** clearing a list element's secret preserves ids referenced by another slot and
  fresh-shaped references absent from the ownership ledger. Clearing a recorded fresh id schedules
  cleanup after the updated config commits, when the ledger no longer shows a live reference.
- **Ownership and rollback safety:** checking the stored config prevents a save that later fails in
  the database from overwriting a secret another slot in the committed entity still references. `SecretMapOwnership`
  records the actual secret id written for each plaintext slot (including fresh ids), so hard delete
  removes owned secrets while leaving user-supplied references untouched. When the database rolls
  back, its rollback callback attempts to remove each confirmed fresh creation from that transaction.

## Amendment (v5, 2026-11-27)

When a list slot contains a committed, ledger-owned fresh reference, stage a replacement under
a new id. A failed entity write discards the staged value and
preserves the committed reference and its value. The ledger records generated keys for reference-based
cleanup, including keys written before this change. Whether an edit clears, omits or replaces
a renamed key, cleanup checks all remaining references after commit before deleting its value.
Passing through a reference unchanged keeps its id.

## Amendment (v6, 2026-11-27)

A key owned by a service or ingestion pipeline may also be referenced by another service, pipeline,
or automation workflow. When the last known local reference disappears, check their current rows,
including soft-deleted rows, under the existing database lock. Read bounded pages and stop as
soon as every candidate has a reference. This also covers configurations written before the ownership ledger and references
wrapped in Fernet. The check reads local references without fetching provider values. If a key
is still in use, keep its ownership and record its namespace against the normalized key. When
another config releases the key, revisit the recorded owner after commit. Workflow writes share
the same lock as service and pipeline writes, including bulk writes. A soft-deleted workflow can
be restored and continues to hold its reference.

Before a workflow is hard-deleted, record its owned credentials and the service or pipeline
namespaces whose references it releases. Commit that record and a retry marker with the row
deletion, including bulk deletes. After commit, check remaining references before removing
provider credentials. If the process stops or a provider fails, a subsequent service or pipeline
write retries up to 100 pending workflow namespaces after its own cleanup commits. A persisted
cursor advances independently of individual retries. Each retry commits separately, so a provider
error for one key leaves its marker in place and other namespaces can finish. Rolling back the
delete retains the workflow and discards its cleanup record.
