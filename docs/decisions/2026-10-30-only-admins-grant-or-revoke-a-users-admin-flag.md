# Only admins grant or revoke a user's admin flag

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `UserResourceIT` (`test_nonAdminPutCannotRevokeAdmin`, `test_usersImportCannotRevokeAdmin`)
- **Related:** open-metadata/openmetadata-collate#7797, ADR:2026-10-21-only-admins-change-a-users-domains

## Context
Granting `isAdmin` through PUT, PATCH or a user CSV row already needed an admin. Revoking did not. A
PUT carries the whole user, and `CreateUser.isAdmin` defaults to false, so a principal with
`EditAll` on users who left the flag out of a PUT demoted an admin. A CSV row carries the flag too,
so a non-admin importer could demote an admin by writing `false`.

## Decision
- `PUT /v1/users` by anyone but a non-impersonated admin keeps the stored `isAdmin` of an existing
  user, whatever the request says.
- A user CSV row from a non-admin importer is refused for an existing admin, as it already was for a
  row that sets `isAdmin` to true.
- Admins may still grant and revoke the flag; impersonated requests may do neither.

## Consequences
Clients that PUT a user without `isAdmin` no longer change it unless they are an admin. An admin who
wants to revoke the flag still sends `isAdmin: false` explicitly.
