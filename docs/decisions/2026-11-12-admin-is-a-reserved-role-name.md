# Admin is a reserved role name, and the UI labels the admin flag apart from roles

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `RoleResourceIT.test_roleNamedAdminIsRejected`, `RolesCard.test.tsx`
- **Related:** `Entity.ADMIN_ROLE`, `UserUtil.reSyncUserRolesFromToken`

## Context
Admin access is the `isAdmin` flag on a user or bot, not a role. The server already treats the name
`Admin` as that flag in two places: SSO role sync reads an `Admin` claim as `isAdmin` and never maps
it to a role, and minted JWTs list `Admin` in their roles claim when the flag is set. The role
editors also list the flag as an "Admin" option next to the real roles.

Nothing stopped anyone from creating a role named `Admin`. Once one existed, the role editor showed
two identical "Admin" options with different power: one bypasses every policy, the other grants only
its policies. Picking the wrong one by mistake makes a bot or user a superuser. A role with that
name also can never be assigned through SSO role mapping.

## Decision
- The server rejects a **new** role whose name equals `Admin`, ignoring case, with a 400. The check
  is in `RoleRepository.createNewEntity`, which POST and PUT-create both go through. Roles cannot
  be renamed, so create is the only way in.
- Roles that already have the name stay valid and editable. No migration renames them, because
  policy conditions and integrations may refer to them by name.
- Wherever the UI shows the `isAdmin` flag among roles, it uses the label `label.admin-superuser`
  ("Admin (superuser)"), never the bare word "Admin". That keeps the flag distinct from an existing
  role named `Admin` and from any role whose display name is "Admin".

## Consequences
- An instance that already has an `Admin` role keeps it. The role editors now show it next to a
  clearly different "Admin (superuser)" option. It still cannot be mapped through SSO. An admin who
  wants that has to create a role with another name and move the role's users over.
- A new surface that lists roles together with the admin flag must use `label.admin-superuser`.
- Revisit only if admin access stops being a flag and becomes a seeded role.
