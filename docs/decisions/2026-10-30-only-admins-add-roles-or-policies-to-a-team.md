# Only an admin adds roles or policies to a team

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial) · v2 2026-11-13 (MCP `create_entity` applies the same check)
- **Deciders:** Sonika Shah
- **Guard:** `TeamResourceIT` (`test_ownerCannotAddRolesOrPoliciesToOwnTeam`,
  `test_ownerCannotAddRolesToOwnTeamThroughPut`, `test_ownerCanOnlyMoveOwnTeamUnderTeamTheyCanEdit`,
  `test_importCsv_ownerCannotAddRolesToTeams`, `test_importCsv_ownerCannotPlaceTeamUnderTeamTheyCannotEdit`,
  `test_importCsv_ownerDryRunReimportsNestedHierarchy`),
  `BotImpersonationIT.test_impersonatedAdmin_cannotAddTeamRolesOrImportTeams`,
  `UserResourceIT`
  (`test_patchUser_joinClosedTeamWithReplace_forbiddenForNonAdmin`),
  `CreateEntityToolTest#aNonAdminCannotCreateATeamWithDefaultRoles`

## Context
Members hold a team's `defaultRoles` as inherited roles and are governed by its `policies`, and by
those of every team above it. Assigning a role to a user is admin-only, and so is joining a team
that is not open to everyone (ADR:2026-10-21-only-admins-change-a-users-domains lists the others).
A team's roles, policies and place in the hierarchy decide what its members inherit, so they follow
the same rule as a user's roles rather than the rules for an ordinary team edit.

## Decision
- Adding a default role or a policy to a team needs an admin, on `POST`, `PUT`, `PATCH` and team CSV
  import. Removing one, or sending the ones the team already holds, does not.
- Adding a parent to a team needs the same permission as editing that parent directly, on the REST
  paths and in team CSV import. The organization is exempt, as every user already belongs to it.
- An impersonated request cannot add a role or policy to a team, as for user privileges, and team CSV
  import is not available to impersonated callers.
- A user `PATCH` that changes team membership is judged on the teams the patch leaves the user in,
  whatever the operation, so a closed team needs an admin however the change is written.

## Consequences
A non-admin who manages a team keeps editing its name, description, owners and members. Letting
someone other than an admin manage a team's roles would need its own permission, not `EditAll` on
the team.

## Amendment: MCP create_entity applies the same check (v2)

MCP `create_entity` built teams without this check, so anyone with Create Team could hand a new
team's members an Admin default role. The check now lives in `TeamGrantAuthorizer`, which
`TeamResource` and `create_entity` both call, so the two cannot drift. An impersonated request is
detected from the request's impersonated user on MCP, which passes its own security context, and
from `ImpersonationContext` on REST, where Jersey wraps the context.
