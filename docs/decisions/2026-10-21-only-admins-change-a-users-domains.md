# Only an admin changes a user's domains

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `UserResourceIT` (`test_patchUser_ownDomains_forbiddenForNonAdmin`,
  `test_putUser_ownDomains_forbiddenForNonAdmin`, `test_createUser_selfSignUpWithDomains_forbidden`,
  `test_updateUser_crossUserDomains_forbidden`)
- **Related:** #35840, #33420, #30019

## Context
`hasDomain()` grants access by the domains a user holds, so a user's domains decide what a rule
such as "allow `EditAll` when `hasDomain()`" lets them touch. Every user owns their own profile, and
the default owner rule lets them edit any field of it, so any user could add a domain to themselves
and widen their own access. A non-admin with `EditAll` on users, which domain-scoped rules hand out,
could give a colleague any domain the same way. Roles, `isAdmin`, `isBot` and closed teams were
already admin-only for the same reason.

## Decision
- Changing a user's domains needs an admin, whoever the user is, on every path of `UserResource`:
  a `PATCH` operation on `/domains`, a `PUT` that adds a domain the user does not hold as their own,
  and a `POST` or self sign-up that names domains.
- A domain the user inherits from a team does not count as held, since it goes when they leave the
  team. Sending the domains a user already holds, or none, is not a change that needs an admin.
- Bots are not admins here: a bot with `EditAll` on users cannot change their domains.

## Consequences
The user profile page already shows the domain control to admins only. Letting someone other than
an admin manage who belongs to a domain (#30019) must be authorized on the domain itself, not by
`EditAll` on users. Who may change a team's domains, which its members inherit, is not covered.
