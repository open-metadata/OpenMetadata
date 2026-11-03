# Deleting your own user account requires an admin

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `UserResourceIT` (`test_selfDelete_forbiddenForNonAdmin`,
  `test_selfDeleteByQuotedName_forbiddenForNonAdmin`)
- **Related:** open-metadata/openmetadata-collate#8018

## Context
The three user delete endpoints (`DELETE /users/{id}`, `/users/async/{id}`, `/users/name/{name}`)
authorized through the generic path, where the owner rule lets a user act on its own record. So any
user could delete its own account, and then — with self sign-up on — create it again, shedding the
deny roles and team memberships that bound it.

## Decision
Each delete endpoint checks first: if the target is the caller, it requires an admin. Deleting another
user is unchanged (still the usual authorization). The by-name endpoint resolves the name as the delete
does, quoting and unquoting included, and compares that account's id with the caller's: `"john.doe"`
and `"john"` name the same accounts as `john.doe` and `john`.

## Consequences
Self-service account deletion is not available to non-admins. If it is wanted later, allow only the
soft delete for a non-admin and make the sign-up and login paths refuse a soft-deleted identity rather
than revive it.
