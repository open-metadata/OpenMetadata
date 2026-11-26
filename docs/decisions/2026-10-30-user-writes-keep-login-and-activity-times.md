# User writes keep the stored login and activity times

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial) · v2 2026-11-24 (login writes `lastLoginTime` with direct SQL)
- **Deciders:** Vishnu Jain
- **Guard:** `UserResourceIT#test_updateUser_keepsLoginAndActivityTimes`,
  `UserResourceIT#test_login_recordsLoginAndActivityTimes`
- **Related:** issue #36697, PR #36703, issue #37793, PR #37794, open-metadata/openmetadata-collate#8062

## Context

`lastLoginTime` and `lastActivityTime` are written by the server with direct SQL updates: on login,
and by `UserActivityTracker` on each authenticated request. A PATCH loaded the
user without them and a PUT saved a body that never carries them, so any edit, PUT or soft delete
cleared both. Online users, the `last_activity` metric and Collate's User Adoption page then read an
active user as never seen.

## Decision

A user PATCH, PUT or soft delete keeps the stored `lastLoginTime` and `lastActivityTime`. Both are in
the PATCH and PUT field lists, and on a PUT a missing value means "keep the stored one". A PATCH
that explicitly removes either field still clears it.

A login writes both times with a single-row direct SQL update and evicts the user's entity cache. It
does not go through the entity update path: a patch inside the EntityUpdater session window reloads
the user with every field, including `owns`, at one lookup per asset the user's teams own (#37793).

## Consequences

A PUT reads the stored user through the 30-second entity cache, which the tracker's direct SQL write
does not clear, so a PUT inside that window can write back an older `lastActivityTime`. Older is
accepted; empty is not, and the next tracker flush writes the current time again. PATCH and soft
delete read the row fresh, so they are not affected. A login evicts the cache, so a read after a
login sees its `lastLoginTime`. Revisit if the tracker starts writing through the repository or
evicting the entity cache.

A login emits no change event and does not reindex the user, so the search document's
`lastLoginTime` is stale until the next user update or reindex. Only the Online Users name search
reads it; the users API and the online-users filter read the database.
