# A PUT to /users authorizes the self case explicitly, and only an admin changes privileged fields

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial); v2 2026-11-04 (the team page offers it only to admins)
- **Deciders:** Mohit Yadav
- **Guard:** `UserResourceIT` (`test_selfPut_keepsStoredRolesAndCannotChangeThem`,
  `test_patchUser_cannotJoinClosedTeamThroughAnyOperation`, `test_nonAdmin_cannotLeaveClosedTeam`,
  self sign-up tests), `UserResourceSignUpTest`,
  `UserTeamAssignmentPrivilegeIT.test_selfUpdate_namingOwnRolesWithoutTeams_keepsClosedTeam`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
`PUT /api/v1/users` creates or updates a user, and its body often names the caller's own account.
That self case covers a user that exists, one that is soft-deleted and one that does not exist yet,
so each is decided as the operation it amounts to: an update, a restore or a sign-up. A PUT carries
the whole user, so a non-admin's PUT is compared with the stored privileged fields, which only an
admin changes; a deny role binds only while its holder cannot drop it.

## Decision
- The self branch of `createOrUpdateUser` is explicit: a deleted self is refused with 404 (the
  answer the authorizer gives that principal elsewhere); an unknown self is a sign-up, allowed only on
  the same terms as POST (self sign-up on, own account, registration domain).
- A role change is admin-only in either direction: `grantsPrivileges` compares the requested role set
  to the stored one (`changesRoles`), not only additions.
- A non-admin PUT keeps the stored privileged fields: the admin and bot flags always, and the roles
  and teams when the request omits them.
- Joining or leaving a team that is not joinable is admin-only, like a role change, because members
  hold the team's default roles and policies, deny rules included. PUT compares the teams it names
  with the stored ones; PATCH compares the teams the patched user is left in, whatever operations
  produced them. The organization, which every user belongs to, is never left.
- A user CSV row from a non-admin is refused for a stored (or requested) admin or bot, or when it
  names roles.

## Consequences
Changing a user's roles, admin flag or bot flag requires an admin, through PUT, PATCH or CSV alike. A
user editing its own profile (description, display name, joining or leaving open teams) is
unaffected; leaving a closed team now takes an admin, and the team page offers joining or leaving
one only to admins (`TeamDetailsV1.test.tsx`). Reviving a deleted account is an admin restore,
not a self PUT.
