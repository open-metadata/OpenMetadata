# Only an admin adds roles or policies to a team

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Sonika Shah
- **Guard:** `TeamResourceIT` (`test_ownerCannotAddRolesOrPoliciesToOwnTeam`,
  `test_ownerCannotAddRolesToOwnTeamThroughPut`, `test_ownerCanOnlyMoveOwnTeamUnderTeamTheyCanEdit`,
  `test_importCsv_ownerCannotAddRolesToTeams`), `UserResourceIT`
  (`test_patchUser_joinClosedTeamWithReplace_forbiddenForNonAdmin`)

## Context
Members hold a team's `defaultRoles` as inherited roles and are governed by its `policies`, and by
those of every team above it. Assigning a role to a user is admin-only, and so is joining a team
that is not open to everyone (ADR:2026-10-21-only-admins-change-a-users-domains lists the others).
A team's own fields were authorized as an ordinary edit of the team, so its owner could change what
its members inherit.

## Decision
- Adding a default role or a policy to a team needs an admin, on `POST`, `PUT`, `PATCH` and team CSV
  import. Removing one, or sending the ones the team already holds, does not.
- Adding a parent to a team needs the same permission as editing that parent directly. The
  organization is exempt, as every user already belongs to it.
- A user `PATCH` that changes team membership is judged on the teams the patch leaves the user in,
  whatever the operation, so a closed team needs an admin however the change is written.

## Consequences
A non-admin who manages a team keeps editing its name, description, owners and members. Letting
someone other than an admin manage a team's roles would need its own permission, not `EditAll` on
the team.
