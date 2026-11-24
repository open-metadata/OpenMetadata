# MCP service server names are unique, and a masked value is kept only where a stored value exists

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial); v2 2026-11-14 (checked on any server change, order included); v3 2026-11-19 (secret ids of list elements stay distinct once cleaned)
- **Deciders:** backend
- **Guard:** `PasswordEntityMaskerTest.testMaskedSecretWithNoStoredValueIsRejected`, `PasswordEntityMaskerTest.testNamesSharingASecretIdKeepTheirOwnKeysWhenReordered`; `ReflectionUtilCollectionKeysTest`, `SecretMapEntriesExternalStoreTest.reorderingServersThatShareACleanedNameThenReplacingOneKeyKeepsTheOther`; `McpServiceResourceIT.post_mcpServiceWithDuplicateServerNames_400`, `McpServiceResourceIT.put_renamedServerWithMaskedApiKey_400_keepsStoredKey`, `McpServiceResourceIT.put_reorderedStoredServersWithSameName_400_otherEditsStillSave`
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
