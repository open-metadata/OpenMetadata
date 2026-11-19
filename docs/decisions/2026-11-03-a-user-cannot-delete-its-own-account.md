# Deleting your own user account requires an admin

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `UserResourceIT` (`test_selfDelete_forbiddenForNonAdmin`,
  `test_selfDeleteByName_forbiddenForNonAdmin`)
- **Related:** open-metadata/openmetadata-collate#8018

## Context
The user delete endpoints (`DELETE /users/{id}`, `/users/async/{id}`, `/users/name/{name}`)
authorize through the generic path, where the owner rule lets a user act on its own record. A
user's roles and team memberships, deny roles included, are an admin's to change, and deleting the
account changes all of them at once. So deleting one's own account is an admin action, as changing
those grants is.

## Decision
Each delete endpoint checks first: if the target is the caller, it requires an admin. Deleting another
user goes through the usual authorization. The by-name endpoint resolves the name as the delete
does, quoting and unquoting included, and compares that account's id with the caller's.

## Consequences
Self-service account deletion is not available to non-admins. If it is wanted later, allow only the
soft delete for a non-admin and make the sign-up and login paths refuse a soft-deleted identity rather
than revive it.
