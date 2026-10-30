# A user's authentication mechanism never leaves in a response or a change event

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `UserResourceIT`, `JsonUtilsTest.testPojoToMaskedJsonLeavesOutAUsersAuthenticationMechanism`
- **Related:** [Service connection visibility](2026-10-26-service-connection-visibility-follows-edit-permission.md)

## Context

A stored user carries `authenticationMechanism`: a person's password hash, or a bot's token. User
reads leave it out.

## Decision

- Change events never carry a user's `authenticationMechanism`. The definition in `user.json` is
  marked `"mask": true`, so `JsonUtils.pojoToMaskedJson` leaves it out. The marker sits on the
  definition because the generator resolves a `$ref` before it reads the property's keys, so a
  `"mask"` beside a `$ref` adds no annotation.
- User writes (create, PUT, PATCH, delete, restore) return no mechanism for a person. A bot's token
  is read through the bot-token endpoints.
- The 2.0.8 post-data migration applies the first rule to events stored before it.

## Consequences

- Code that needs a bot's token loads the user from the repository, not from a change event.
