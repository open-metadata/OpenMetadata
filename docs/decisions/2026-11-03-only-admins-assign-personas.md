# Only an admin assigns personas

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Sriharsha Chintalapani, Pere Miquel Brull
- **Guard:** `UserResourceIT` (`test_patchUser_ownPersonas_forbiddenForNonAdmin`,
  `test_patchUser_ownDefaultPersonaNotHeld_forbiddenForNonAdmin`,
  `test_putUser_ownPersonas_forbiddenForNonAdmin`), `TeamDefaultPersonaIT`
  (`test_groupOwnerCannotSetDefaultPersonaViaPatch`, `test_groupOwnerCannotSetDefaultPersonaViaPut`),
  `CreateEntityToolTest.aTeamThatNamesADefaultPersonaNeedsAnAdmin`, `BotImpersonationIT`
  (`test_impersonation_cannotSetTeamDefaultPersona`)
- **Related:** ADR:2026-10-21-only-admins-change-a-users-domains,
  ADR:2026-10-26-impersonated-requests-never-reach-credentials-or-grant-privileges

## Context
Holding a persona is what lets a user read the persona's AI context, which is compiled once per
persona and does not depend on who reads it. A user holds a persona when it is in their `personas`,
when it is their `defaultPersona`, or when it is the `defaultPersona` of a Group they belong to.
`PersonaResource` already kept writes to a persona's users for admins, but a user's own record and
a Group's `defaultPersona` were open to anyone who could edit them: every user owns their own
profile, and the owner rule gives a team's owner every operation on it.

## Decision
- Changing a user's `personas` needs an admin on every path of `UserResource`: a `PATCH` operation
  on `/personas`, a `PUT` that adds a persona the user is not assigned, and a `POST` or self sign-up
  that names personas.
- A user may set their own `defaultPersona` to a persona they already hold, directly, through a
  team, or as their current default. Any other default persona needs an admin.
- Setting a team's `defaultPersona` needs an admin: `POST` with one, `PUT` that names a different
  one, any `PATCH` operation on `/defaultPersona`, and the MCP `create_entity` / `patch_entity`
  tools (`patch_entity` no longer patches teams).
- An impersonated request cannot do any of the above, even as an admin: the persona outlives the
  request (ADR:2026-10-26-impersonated-requests-never-reach-credentials-or-grant-privileges).
- Who belongs to a Group is unchanged. Its owner still manages members, and a joinable Group still
  lets anyone join; an admin who sets a default persona on a Group decides whether it stays
  joinable and who owns it.

## Consequences
The UI shows the persona controls on users and teams to admins only. Membership remains the one
way a non-admin can come to hold a persona, through a Group an admin configured. Revisit this if
persona contexts are ever built per reader, which would make holding a persona no longer grant
data on its own.
