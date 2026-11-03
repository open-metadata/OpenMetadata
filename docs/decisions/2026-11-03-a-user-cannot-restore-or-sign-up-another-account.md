# A PUT to /users authorizes the self case explicitly, and only an admin changes privileged fields

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `UserResourceIT` (`test_selfPut_keepsStoredRolesAndCannotChangeThem`,
  self sign-up tests), `UserResourceSignUpTest`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
`PUT /api/v1/users` skipped the authorizer whenever the body named the caller's own account. That let
a soft-deleted user PUT itself back to life, and let an unknown principal create an account while self
sign-up was off. Separately, a non-admin self PUT could shed roles (a PUT carries the whole user, and
omitting or emptying the role list replaced the stored set), reversing a deny role the point of which
is that the user cannot drop it (this had been loosened by #32323).

## Decision
- The self branch of `createOrUpdateUser` is explicit: a deleted self is refused with 404 (the
  answer the authorizer gives that principal elsewhere); an unknown self is a sign-up, allowed only on
  the same terms as POST (self sign-up on, own account, registration domain).
- A role change is admin-only in either direction: `grantsPrivileges` compares the requested role set
  to the stored one (`changesRoles`), not only additions.
- A non-admin PUT keeps the stored privileged fields: the admin and bot flags always, and the roles
  when the request omits them.
- A user CSV row from a non-admin is refused for a stored (or requested) admin or bot, or when it
  names roles.

## Consequences
Changing a user's roles, admin flag or bot flag requires an admin, through PUT, PATCH or CSV alike. A
user editing its own profile (description, display name, teams it may join) is unaffected. Reviving a
deleted account is an admin restore, not a self PUT.
