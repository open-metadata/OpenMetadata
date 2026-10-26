# A field the schema marks `mask: true` never appears in a stored change event or entity version

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `ChangeEventMaskingTest`, `MaskedFieldsTest`, `UserSecretsIT`
- **Related:** [PR #36251](https://github.com/open-metadata/OpenMetadata/pull/36251), [PR #36252](https://github.com/open-metadata/OpenMetadata/pull/36252); `secrets.masker.MaskedFields`, `events.ChangeEventMasking`, `ChangeEventDAO.insert`, `EntityRepository` version reads

## Context

A user's `authenticationMechanism` (a person's password hash, a bot's token) was copied into every
change event about that user and into every stored version of it. Every alert sends the stored
events, `GET /v1/events` returns them, and anyone who may view a user may read its versions and
history. Some writers masked the entity and others did not, so whether a secret was stored
depended on which code path made the event.

## Decision

The schema is the one source of truth: a property marked `"mask": true` (generated as
`@MaskedField`) is secret.

- Every change event is written through `ChangeEventDAO.insert` / `insertBatch`, which store the
  event's entity without its masked fields, whether the entity is an object or a string of JSON.
  The raw `insertMaskedRow(s)` methods exist only for that path.
- A field masked as a whole (`MaskedFields.wholeFieldsOf`, today only
  `User.authenticationMechanism`) is left out of every stored entity version and of every read of
  a version or of the entity history, older rows included.
- A field that only holds secrets inside it, such as a service connection, stays in history; its
  resource masks those secrets for each caller, as before.
- The `mask` flag goes on the schema definition, not beside a `$ref`, because the generator ignores
  it there.

## Consequences

Marking a field `mask: true` is enough to keep it out of events and history; there is no second
list to update. A new change-event writer must use `insert` / `insertBatch`. Change events and
versions can no longer show that a credential changed, so an audit of credential changes needs its
own record. Revisit if an alert or the activity feed ever needs a masked field's value.
