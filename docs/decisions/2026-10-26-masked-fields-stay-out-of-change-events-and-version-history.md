# A field the schema marks `mask: true` never appears in a stored change event or entity version

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `SecretFieldsAreMaskedTest`, `VersionHistoryArchitectureTest`, `ChangeEventMaskingTest`, `MaskedFieldsTest`, `UserSecretsIT`
- **Related:** [PR #36251](https://github.com/open-metadata/OpenMetadata/pull/36251), [PR #36344](https://github.com/open-metadata/OpenMetadata/pull/36344); `secrets.masker.MaskedFields`, `events.ChangeEventMasking`, `ChangeEventDAO.insert`, `EntityRepository.storeVersions`

## Context

A user's `authenticationMechanism` (a person's password hash, a bot's token) was copied into every
change event about that user and into every stored version of it. Every alert sends the stored
events, `GET /v1/events` returns them, and anyone who may view a user may read its versions and
history. Some writers masked the entity and others did not, so whether a secret was stored
depended on which code path made the event or the version.

## Decision

The schema is the one source of truth: a property marked `"mask": true` (generated as
`@MaskedField`) is secret.

- **Change events.** Every change event is written through `ChangeEventDAO.insert` /
  `insertBatch`, which store the event's entity without its masked fields, whether the entity is
  an object or a string of JSON. The raw `insertMaskedRow(s)` methods exist only for that path.
- **Versions.** `EntityRepository.storeVersions` is the only writer of entity versions. It leaves
  out one list of fields: the entity's fields masked as a whole (`MaskedFields.wholeFieldsOf`)
  plus the ones its repository names in `getFieldsHiddenFromHistory`. The same list is left out of
  every read of a version or of the entity history, older rows included, and is taken from the
  current entity when a session's edits are merged, so a merged change never reports it.
  Repositories add fields to the list; they do not replace how a version is written.
- A field that only holds secrets inside it, such as a service connection, stays in history; its
  resource masks those secrets for each caller, as before.
- **Where `mask` goes.** On a property that declares its own type, or on the root of the schema a
  property references. The generator replaces a property that has a `$ref` with the referenced
  schema, so a `mask` next to a `$ref` is dropped.

## Consequences

Marking a field `mask: true` is enough to keep it out of events and history; there is no second
list to update. A new change-event writer must use `insert` / `insertBatch`; a new version writer
must call `storeVersions`, and `VersionHistoryArchitectureTest` fails on any method that builds a
version key and writes an entity extension row itself. `SecretFieldsAreMaskedTest` fails when a
`mask` sits next to a `$ref`, or when a `format: password` field reachable from an entity through
fields with a single Java type sits in no masked field; the walk stops at fields with no single
Java type (`oneOf`, `anyOf`, maps), whose values are kept as plain maps.

Change events and versions can no longer show that a credential changed, so an audit of credential
changes needs its own record. Revisit if an alert or the activity feed ever needs a masked field's
value.
