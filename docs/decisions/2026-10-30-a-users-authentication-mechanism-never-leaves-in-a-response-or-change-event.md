# A user's authentication mechanism never leaves in a response or a change event

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `UserResourceIT` (`test_writeResponsesNeverCarryAPersonsPasswordHash` and the
  `test_auditLogNeverShows*` tests), `JsonUtilsTest.testPojoToMaskedJsonLeavesOutAUsersAuthenticationMechanism`
- **Related:** [Service connection visibility](2026-10-26-service-connection-visibility-follows-edit-permission.md)

## Context

A stored user carries `authenticationMechanism`: a person's bcrypt password hash, or a bot's token.
User reads withhold it. A change event records the entity a write returns, and the stores that keep
events (the change-event list, the audit log, and the delivered and failed event records of alerts)
serve them to readers of their own, so a credential must not travel in either.

## Decision

- The `authenticationMechanism` definition in `user.json` carries `"mask": true`, so every change
  event serialized through `JsonUtils.pojoToMaskedJson` leaves it out. The marker sits on the
  definition because the generator resolves a `$ref` before it reads the property's keys, so a
  `"mask"` beside a `$ref` adds no annotation. The event written when the server seeds its users is
  serialized the masked way too.
- A user write (create, PUT, PATCH, delete, restore) returns no mechanism for a person. A bot's is
  returned as before; the bot-token endpoints, which require an admin, stay the way to read a token.
  Routing write responses through the read path's `decryptOrNullify` was rejected: its bot handling
  is meant for callers an admin check has already passed, and it would mask a non-admin's own email
  in their profile edits.
- The 2.0.8 post-data migration removes the mechanism from the user events already stored in
  `change_event`, `audit_log_event`, `successful_sent_change_events` and `consumers_dlq`, whether
  the event holds the entity as an object or as serialized JSON text.

## Consequences

- Nothing that consumes change events can read a user's credentials from them. Code that needs a
  bot's token loads the user from the repository.
